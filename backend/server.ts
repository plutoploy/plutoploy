import { Hono } from "hono";
import { cors } from "hono/cors";
import { createServer } from 'http';
import { deployRoutes } from "./src/routes/deploy.routes.ts";
import { authRoutes } from "./src/routes/auth.routes.ts";
import { githubRoutes } from "./src/routes/github.routes.ts";
import { webhookRoutes } from "./src/routes/webhook.routes.ts";

const app = new Hono();

// Enable CORS with credentials support
app.use("/*", cors({
  origin: process.env.FRONTEND_BASE_URL || '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Health check endpoints
app.get("/", (c) => {
  return c.json({
    message: "Deployment Platform API",
    status: "running",
    version: "1.0.0"
  });
});

app.get("/health", (c) => {
  return c.json({ status: "healthy" });
});

// Test POST endpoint
app.post("/test", async (c) => {
  const body = await c.req.json();
  return c.json({ received: body, success: true });
});

// Mount auth routes (GitHub App OAuth)
app.route('/api/auth', authRoutes);

// Mount GitHub App routes (repos, etc.)
app.route('/api', githubRoutes);

// Mount GitHub Webhook routes
app.route('/api/webhooks', webhookRoutes);

// Mount deployment routes
app.route('/api', deployRoutes);

const port = parseInt(process.env.PORT || '3000');

export function startServer() {
  console.log('Initializing server...');
  process.stdout.write(''); // Flush stdout

  const server = createServer(async (req, res) => {
    try {
      // Read body for POST/PUT/PATCH requests
      let requestBody: Buffer | undefined;
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        requestBody = await new Promise<Buffer>((resolve) => {
          const chunks: Buffer[] = [];
          req.on('data', (chunk) => chunks.push(chunk));
          req.on('end', () => resolve(Buffer.concat(chunks)));
          req.on('error', () => resolve(Buffer.from('')));
        });
      }

      const response = await app.fetch(
        new Request(`http://localhost:${port}${req.url}`, {
          method: req.method,
          headers: req.headers as any,
          body: requestBody
        })
      );

      res.statusCode = response.status;
      response.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });

      if (response.body) {
        const reader = response.body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) res.write(value);
          }
        } finally {
          res.end();
        }
      } else {
        res.end();
      }
    } catch (error) {
      console.error('Request error:', error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  });

  server.listen(port, () => {
    console.log(`🚀 Deployment API running on port ${port}`);
    console.log(`📍 Auth Endpoints:`);
    console.log(`   GET    /api/auth/github            (start GitHub App install+login)`);
    console.log(`   GET    /api/auth/github/callback   (GitHub App callback)`);
    console.log(`   GET    /api/auth/me                (current user)`);
    console.log(`   POST   /api/auth/logout             (logout)`);
    console.log(`   POST   /api/auth/logout/all         (logout all devices)`);
    console.log(`📍 GitHub App Endpoints:`);
    console.log(`   GET    /api/repos                  (list user repos)`);
    console.log(`   POST   /api/inject-workflow        (inject workflow)`);
    console.log(`📍 Deploy Endpoints:`);
    console.log(`   POST   /api/deploy`);
    console.log(`   GET    /api/deployments`);
    console.log(`   GET    /api/deployments/:id`);
    console.log(`   DELETE /api/deployments/:id`);
    process.stdout.write(''); // Flush stdout
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n👋 Shutting down gracefully...');
    server.close(() => {
      process.exit(0);
    });
  });

  process.on('SIGTERM', () => {
    console.log('\n👋 Shutting down gracefully...');
    server.close(() => {
      process.exit(0);
    });
  });

  return server;
}

export { app };
