# Complete Testing Guide for Plutoploy

## Architecture Summary

```
GitHub Actions → GHCR → Your API → Podman → Caddy → Live Apps
```

You've built:
- ✅ Deployment API (Hono + Node.js)
- ✅ Container management (Podman via dockerode)
- ✅ Caddy config generation
- ✅ PM2 process management
- ✅ Complete REST API

---

## Pre-Test Checklist

### 1. Verify Podman is Running

```bash
podman info
```

If error, start Podman socket:
```bash
systemctl --user start podman.socket
systemctl --user enable podman.socket
```

### 2. Verify PM2 is Running

```bash
pm2 status
```

Should show:
```
┌────┬────────────┬──────────┬──────┬───────────┬──────────┬──────────┐
│ id │ name       │ mode     │ ↺    │ status    │ cpu      │ memory   │
├────┼────────────┼──────────┼──────┼───────────┼──────────┼──────────┤
│ 0  │ plutoploy  │ fork     │ 0    │ online    │ 0%       │ 36.0mb   │
└────┴────────────┴──────────┴──────┴───────────┴──────────┴──────────┘
```

If not running:
```bash
npm run pm2:start
```

### 3. Check Server Logs

```bash
npm run pm2:logs
```

Should see:
```
🚀 Deployment API running on port 3000
📍 Endpoints:
   POST   /api/deploy
   GET    /api/deployments
   GET    /api/deployments/:id
   DELETE /api/deployments/:id
```

---

## Test 1: Health Check ✅

```bash
curl http://localhost:3000/health
```

**Expected:**
```json
{"status":"healthy"}
```

**If fails:** Server not running. Check `pm2 status` and `npm run pm2:logs`

---

## Test 2: Root Endpoint ✅

```bash
curl http://localhost:3000/
```

**Expected:**
```json
{
  "message": "Deployment Platform API",
  "status": "running",
  "version": "1.0.0"
}
```

---

## Test 3: Deploy Nginx Container ✅

```bash
curl -X POST http://localhost:3000/api/deploy \
  -H "Content-Type: application/json" \
  -d '{
    "image": "docker.io/library/nginx:alpine",
    "subdomain": "test-app",
    "repo": "test/nginx"
  }'
```

**Expected:**
```json
{
  "success": true,
  "deployment": {
    "deployId": "1234567890",
    "subdomain": "test-app",
    "port": 3001,
    "url": "https://test-app.localhost",
    "containerId": "abc123...",
    "repo": "test/nginx",
    "createdAt": "2026-03-31T..."
  }
}
```

**Watch logs:**
```bash
npm run pm2:logs
```

You should see:
```
Starting deployment 1234567890...
Pulling image: docker.io/library/nginx:alpine
Creating container on port 3001
Starting container...
Configuring Caddy for test-app...
✅ Deployment 1234567890 successful!
```

---

## Test 4: Verify Container is Running ✅

```bash
podman ps
```

**Expected:**
```
CONTAINER ID  IMAGE                           COMMAND               STATUS        PORTS                   NAMES
abc123...     docker.io/library/nginx:alpine  nginx -g daemon o...  Up 10 seconds 0.0.0.0:3001->80/tcp    deploy-1234567890
```

---

## Test 5: Access Deployed App ✅

```bash
curl http://localhost:3001
```

**Expected:** Nginx HTML page
```html
<!DOCTYPE html>
<html>
<head>
<title>Welcome to nginx!</title>
...
```

---

## Test 6: Check Container Logs ✅

```bash
# Replace with your actual container name
podman logs deploy-1234567890
```

**Expected:** Nginx startup logs

---

## Test 7: List All Deployments ✅

```bash
curl http://localhost:3000/api/deployments
```

**Expected:**
```json
{
  "deployments": [
    {
      "deployId": "1234567890",
      "subdomain": "test-app",
      "port": 3001,
      "url": "https://test-app.localhost",
      "containerId": "abc123...",
      "repo": "test/nginx",
      "createdAt": "2026-03-31T..."
    }
  ],
  "count": 1
}
```

---

## Test 8: Get Single Deployment ✅

```bash
# Replace with your actual deployId
curl http://localhost:3000/api/deployments/1234567890
```

**Expected:**
```json
{
  "deployment": {
    "deployId": "1234567890",
    ...
  }
}
```

---

## Test 9: Delete Deployment ✅

```bash
# Replace with your actual deployId
curl -X DELETE http://localhost:3000/api/deployments/1234567890
```

**Expected:**
```json
{
  "success": true,
  "message": "Deployment removed successfully"
}
```

**Verify container is gone:**
```bash
podman ps  # Should not show deploy-1234567890
```

---

## Test 10: Deploy Multiple Apps ✅

```bash
# Deploy 3 apps
curl -X POST http://localhost:3000/api/deploy \
  -H "Content-Type: application/json" \
  -d '{"image": "docker.io/library/nginx:alpine", "subdomain": "app1", "repo": "test/app1"}'

curl -X POST http://localhost:3000/api/deploy \
  -H "Content-Type: application/json" \
  -d '{"image": "docker.io/library/nginx:alpine", "subdomain": "app2", "repo": "test/app2"}'

curl -X POST http://localhost:3000/api/deploy \
  -H "Content-Type: application/json" \
  -d '{"image": "docker.io/library/nginx:alpine", "subdomain": "app3", "repo": "test/app3"}'
```

**Verify all running:**
```bash
podman ps
curl http://localhost:3001
curl http://localhost:3002
curl http://localhost:3003
```

---

## Test 11: Error Handling ✅

### Test Invalid Subdomain
```bash
curl -X POST http://localhost:3000/api/deploy \
  -H "Content-Type: application/json" \
  -d '{"image": "nginx:alpine", "subdomain": "INVALID!", "repo": "test"}'
```

**Expected:**
```json
{"error": "Invalid subdomain format"}
```

### Test Missing Fields
```bash
curl -X POST http://localhost:3000/api/deploy \
  -H "Content-Type: application/json" \
  -d '{"subdomain": "test"}'
```

**Expected:**
```json
{"error": "Missing required fields: image, subdomain"}
```

### Test Duplicate Subdomain
```bash
# Deploy once
curl -X POST http://localhost:3000/api/deploy \
  -H "Content-Type: application/json" \
  -d '{"image": "docker.io/library/nginx:alpine", "subdomain": "duplicate", "repo": "test"}'

# Try again with same subdomain
curl -X POST http://localhost:3000/api/deploy \
  -H "Content-Type: application/json" \
  -d '{"image": "docker.io/library/nginx:alpine", "subdomain": "duplicate", "repo": "test"}'
```

**Expected:**
```json
{"error": "Subdomain already taken"}
```

---

## Test 12: Caddy Config (Optional) ✅

```bash
# Check if Caddy config was created
ls -la /etc/caddy/apps/

# View a config
cat /etc/caddy/apps/1234567890.caddy
```

**Expected:**
```
test-app.localhost {
    reverse_proxy localhost:3001 {
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
    }
    
    encode gzip
    
    log {
        output file /var/log/caddy/test-app.log
    }
}
```

**Note:** This might fail without sudo permissions. That's okay for testing!

---

## Test 13: Stress Test ✅

Deploy 10 apps quickly:

```bash
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/deploy \
    -H "Content-Type: application/json" \
    -d "{\"image\": \"docker.io/library/nginx:alpine\", \"subdomain\": \"stress$i\", \"repo\": \"test/stress$i\"}"
  echo ""
done
```

**Check all containers:**
```bash
podman ps | wc -l  # Should show 11 (10 containers + header)
```

---

## Troubleshooting

### Server not responding?
```bash
pm2 status
npm run pm2:logs
npm run pm2:restart
```

### Podman connection failed?
```bash
systemctl --user status podman.socket
systemctl --user start podman.socket
npx tsx test-docker.ts
```

### Container not starting?
```bash
podman logs deploy-<deployId>
podman ps -a  # Show all containers including stopped
```

### Port already in use?
```bash
lsof -i :3001
# Kill the process or use different port
```

### Caddy errors?
```bash
sudo systemctl status caddy
sudo journalctl -u caddy -f
```

---

## Success Checklist

- ✅ Server starts with PM2
- ✅ Health endpoint responds
- ✅ Can deploy nginx container
- ✅ Container appears in `podman ps`
- ✅ Can access app on assigned port
- ✅ Can list deployments
- ✅ Can get single deployment
- ✅ Can delete deployment
- ✅ Container removed after deletion
- ✅ Error handling works
- ✅ Multiple apps can run simultaneously

---

## What You've Built

🎉 **Congratulations!** You've built a complete deployment platform with:

1. **REST API** - Full CRUD for deployments
2. **Container Management** - Pull images, create/start/stop containers
3. **Reverse Proxy** - Caddy config generation
4. **Process Management** - PM2 for reliability
5. **Error Handling** - Validation and error responses
6. **Podman Support** - Rootless container runtime

This is the foundation of platforms like Vercel, Railway, and Render!

---

## Next Steps

1. ✅ Test everything above
2. Add database (PostgreSQL) for persistent state
3. Add queue system (Redis + BullMQ) for parallel deployments
4. Add health checks and auto-restart
5. Add monitoring (Prometheus + Grafana)
6. Deploy to Oracle Cloud
7. Set up GitHub Actions workflow
8. Add custom domains
9. Add SSL certificates
10. Scale to multiple servers

**Your deployment platform is ready to test!** 🚀
