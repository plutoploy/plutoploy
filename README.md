# Plutoploy

A self-hosted deployment platform for containerized applications with automatic HTTPS via Caddy and SQLite-based dynamic routing.

## Features

- 🐳 Podman container management
- 🔄 SQLite-based dynamic routing (no Caddy reloads!)
- 🔒 Automatic HTTPS with Cloudflare DNS-01
- 📦 GHCR/Docker Hub image support
- 💾 Persistent deployment storage
- 🚀 Zero-downtime routing updates

## Tech Stack

- **Runtime**: Node.js with tsx
- **Framework**: Hono
- **Container Runtime**: Podman (rootless)
- **Reverse Proxy**: Caddy with SQLite router
- **Database**: SQLite (better-sqlite3)
- **Process Manager**: PM2

## Quick Start

### Prerequisites

- Node.js v20+
- Podman (rootless mode)
- PM2 (optional, for production)

### Installation

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env with your settings
nano .env

# Start development server
npm run dev

# Or use PM2 for production
npm run pm2:start
```

## Development

```bash
# Start server
npm run dev

# View logs (PM2)
npm run pm2:logs

# Restart (PM2)
npm run pm2:restart
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for Oracle Cloud deployment instructions.

## API Endpoints

- `POST /api/deploy` - Deploy a new container
- `GET /api/deployments` - List all deployments
- `GET /api/deployments/:id` - Get deployment details
- `DELETE /api/deployments/:id` - Remove deployment
- `GET /api/routes` - View Caddy routes

See [API.md](./API.md) for detailed API documentation.

## Architecture

```
GitHub Actions → GHCR → Plutoploy API → Podman → Caddy → Live Apps
                              ↓
                          SQLite DB
                              ↑
                          Caddy Router
```

## License

MIT

