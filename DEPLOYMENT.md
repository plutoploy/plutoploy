# Plutoploy Deployment Guide

## Prerequisites on Oracle Server

1. **Podman** installed and configured (rootless mode)
2. **Node.js** v20+ and npm
3. **PM2** for process management
4. **Caddy with SQLite router** (Docker image: `ghcr.io/pratyay360/caddy-cloudflare-sqlite:latest`)

## Deployment Steps

### 1. Clone and Setup

```bash
# Clone repository
git clone <your-repo-url>
cd plutoploy

# Install dependencies
npm install

# Create .env file
cp .env.example .env
nano .env
```

### 2. Configure Environment Variables

Edit `.env`:
```env
PORT=3000
DOMAIN=yourdomain.com
DB_PATH=./data/plutoploy.db
CLOUDFLARE_API_TOKEN=your_token_here
EMAIL=your@email.com
```

### 3. Setup Caddy with SQLite Router

Create `caddy.json` from template:
```bash
cp caddy.json.template caddy.json
```

Edit `caddy.json`:
- Replace `yourdomain.com` with your actual domain
- Update `db_path` to absolute path: `/home/user/plutoploy/data/plutoploy.db`
- Your friend will handle Cloudflare API token setup

Run Caddy container:
```bash
podman run -d \
  --name caddy \
  --restart unless-stopped \
  -p 80:80 \
  -p 443:443 \
  -v $(pwd)/caddy.json:/etc/caddy/caddy.json:Z \
  -v $(pwd)/data:/data:Z \
  -v caddy_data:/data/caddy:Z \
  -v caddy_config:/config:Z \
  -e CLOUDFLARE_API_TOKEN=${CLOUDFLARE_API_TOKEN} \
  -e EMAIL=${EMAIL} \
  ghcr.io/pratyay360/caddy-cloudflare-sqlite:latest \
  caddy run --config /etc/caddy/caddy.json
```

### 4. Start Plutoploy API

```bash
# Using PM2
npm run pm2:start

# Check status
npm run pm2:logs

# Or run directly for testing
npx tsx index.ts
```

### 5. Test Deployment

```bash
# Test health
curl http://localhost:3000/health

# Deploy a test app
curl -X POST http://localhost:3000/api/deploy \
  -H "Content-Type: application/json" \
  -d '{
    "image": "docker.io/library/nginx:alpine",
    "subdomain": "test",
    "repo": "test/repo"
  }'

# Check deployments
curl http://localhost:3000/api/deployments

# Check Caddy routes
curl http://localhost:3000/api/routes
```

### 6. Verify Container and Routing

```bash
# Check running containers
podman ps

# Check if Caddy picked up the route
curl https://test.yourdomain.com
```

## Architecture

```
User Request → Caddy (Port 80/443)
              ↓ (queries SQLite)
              ↓ (reads routes table)
              ↓
         Reverse Proxy → Container (Port 3001+)
```

## How It Works

1. **Deploy API** receives deployment request
2. **Podman** pulls image and creates container
3. **SQLite** stores deployment metadata + Caddy route
4. **Caddy** automatically picks up new route (no reload needed!)
5. **HTTPS** automatically provisioned via Cloudflare DNS-01

## Troubleshooting

### Caddy not routing
```bash
# Check if route exists in database
podman exec caddy sqlite3 /data/plutoploy.db "SELECT * FROM routes;"

# Check Caddy logs
podman logs caddy
```

### Container not starting
```bash
# Check Podman logs
podman logs deploy-<deploy-id>

# Check API logs
npm run pm2:logs
```

### Port conflicts
```bash
# List used ports
podman ps --format "{{.Names}} - {{.Ports}}"

# Kill old containers
podman rm -f $(podman ps -aq --filter "name=deploy-")
```

## File Structure

```
plutoploy/
├── data/
│   └── plutoploy.db          # SQLite database (shared with Caddy)
├── backend/
│   ├── server.ts
│   └── src/
│       ├── db/
│       │   ├── database.ts   # Database operations
│       │   └── schema.sql    # Database schema
│       ├── handlers/
│       │   ├── podman-cli.handler.ts
│       │   └── caddy.handler.ts
│       ├── routes/
│       │   └── deploy.routes.ts
│       └── services/
│           └── deployment.service.ts
├── caddy.json                # Caddy configuration
├── .env                      # Environment variables
└── ecosystem.config.cjs      # PM2 configuration
```

## Security Notes

- Caddy runs in a container with volume mounts
- Plutoploy API runs as user process (not root)
- Podman containers are rootless
- Database file shared between Caddy and API (read/write permissions needed)

## Maintenance

```bash
# Restart API
npm run pm2:restart

# Restart Caddy
podman restart caddy

# View all deployments
curl http://localhost:3000/api/deployments

# Remove a deployment
curl -X DELETE http://localhost:3000/api/deployments/<deploy-id>
```
