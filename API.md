# Deployment Platform API

## Architecture

```
GitHub Actions → GHCR → Your API → Docker + Caddy → Live Apps
```

## API Endpoints

### Deploy App
```bash
POST /api/deploy
Content-Type: application/json

{
  "image": "ghcr.io/username/myapp:abc123",
  "subdomain": "myapp",
  "repo": "username/myapp"
}

Response:
{
  "success": true,
  "deployment": {
    "deployId": "1234567890",
    "subdomain": "myapp",
    "port": 3001,
    "url": "https://myapp.yourdomain.com",
    "containerId": "abc123..."
  }
}
```

### List Deployments
```bash
GET /api/deployments

Response:
{
  "deployments": [...],
  "count": 3
}
```

### Get Deployment
```bash
GET /api/deployments/:id

Response:
{
  "deployment": { ... }
}
```

### Remove Deployment
```bash
DELETE /api/deployments/:id

Response:
{
  "success": true,
  "message": "Deployment removed successfully"
}
```

## Environment Variables

Create `.env` file:
```
PORT=3000
DOMAIN=yourdomain.com
HOST_PORT=3000
```

## Running

```bash
bun install
bun run index.ts
```
