# Podman Setup Guide

## Why Podman?

You're using Podman instead of Docker. Podman is Docker-compatible but:
- Runs rootless (more secure)
- Uses different socket path
- Compatible with dockerode library

---

## Step 1: Verify Podman is Running

```bash
podman info
```

If this works, Podman is installed and running!

---

## Step 2: Start Podman Socket

Podman needs its socket service running:

```bash
# Start Podman socket for current user
systemctl --user start podman.socket

# Enable it to start on boot
systemctl --user enable podman.socket

# Check status
systemctl --user status podman.socket
```

You should see:
```
● podman.socket - Podman API Socket
   Active: active (listening)
```

---

## Step 3: Verify Socket Path

```bash
ls -la /run/user/1000/podman/podman.sock
```

You should see the socket file. If your user ID is different:

```bash
# Find your user ID
id -u

# Use that in the socket path
# Example: /run/user/1001/podman/podman.sock
```

---

## Step 4: Test Podman Connection

```bash
npx tsx test-docker.ts
```

Expected output:
```
Testing Podman connection...
Docker instance created with Podman socket
✅ Podman is accessible!
```

---

## Step 5: Install PM2

```bash
npm install -g pm2
```

---

## Step 6: Start with PM2

```bash
# Start the app
npm run pm2:start

# View logs
npm run pm2:logs

# Stop
npm run pm2:stop

# Restart
npm run pm2:restart
```

---

## PM2 Benefits

✅ No zombie processes
✅ Auto-restart on crash
✅ Clean stop/start
✅ Log management
✅ Process monitoring

---

## Testing Your Deployment Platform

Once PM2 is running:

```bash
# Check PM2 status
pm2 status

# Test health
curl http://localhost:3000/health

# Deploy nginx
curl -X POST http://localhost:3000/api/deploy \
  -H "Content-Type: application/json" \
  -d '{
    "image": "nginx:alpine",
    "subdomain": "test",
    "repo": "test/repo"
  }'

# Check containers (use podman, not docker)
podman ps
```

---

## Podman vs Docker Commands

| Docker | Podman |
|--------|--------|
| `docker ps` | `podman ps` |
| `docker images` | `podman images` |
| `docker pull` | `podman pull` |
| `docker logs` | `podman logs` |

Your code uses `dockerode` which works with both!

---

## Troubleshooting

### Socket not found?
```bash
# Start Podman socket
systemctl --user start podman.socket
```

### Permission denied?
```bash
# Check socket permissions
ls -la /run/user/$(id -u)/podman/podman.sock

# Should be owned by your user
```

### Still hanging?
```bash
# Check Podman is working
podman run --rm hello-world

# If this works, Podman is fine
```
