# Caddy JSON Configuration Guide

## Understanding the Config

The `caddy.json` file tells Caddy:
1. **What domains to listen for** (e.g., *.yourdomain.com)
2. **Where to find the SQLite database** (path to plutoploy.db)
3. **How to get HTTPS certificates** (via Cloudflare DNS-01)

## Step-by-Step Setup

### 1. Copy Template

```bash
cd /path/to/plutoploy
cp caddy.json.template caddy.json
```

### 2. Edit caddy.json

Open the file:
```bash
nano caddy.json
```

### 3. Make These Changes

#### Change #1: Domain (Line 9)
```json
// BEFORE:
"match": [{ "host": ["*.yourdomain.com"] }],

// AFTER (replace with your actual domain):
"match": [{ "host": ["*.plutoploy.com"] }],
```

#### Change #2: Database Path (Line 15)
```json
// BEFORE:
"db_path": "/path/to/plutoploy/data/plutoploy.db",

// AFTER (use ABSOLUTE path on your server):
"db_path": "/home/ubuntu/plutoploy/data/plutoploy.db",
```

To get the absolute path, run:
```bash
cd /path/to/plutoploy
pwd
# Output: /home/ubuntu/plutoploy
# So db_path = /home/ubuntu/plutoploy/data/plutoploy.db
```

#### Change #3: Domain in TLS Section (Line 32)
```json
// BEFORE:
"subjects": ["*.yourdomain.com"],

// AFTER:
"subjects": ["*.plutoploy.com"],
```

### 4. Final caddy.json Example

```json
{
  "apps": {
    "http": {
      "servers": {
        "srv0": {
          "listen": [":80", ":443"],
          "routes": [{
            "match": [{ "host": ["*.plutoploy.com"] }],
            "handle": [{
              "handler": "subroute",
              "routes": [{
                "handle": [
                  {
                    "handler": "sqlite_router",
                    "db_path": "/home/ubuntu/plutoploy/data/plutoploy.db",
                    "query": "SELECT host, port FROM routes WHERE domain = :domain"
                  },
                  {
                    "handler": "reverse_proxy",
                    "upstreams": [{ "dial": "{http.vars.backend_upstream}" }]
                  },
                  { "handler": "encode", "encodings": { "gzip": {} } }
                ]
              }]
            }]
          }]
        }
      }
    },
    "tls": {
      "automation": {
        "policies": [{
          "subjects": ["*.plutoploy.com"],
          "issuers": [{
            "module": "acme",
            "email": "${env.EMAIL}",
            "challenges": {
              "dns": {
                "provider": {
                  "name": "cloudflare",
                  "api_token": "${env.CLOUDFLARE_API_TOKEN}"
                }
              }
            }
          }]
        }]
      }
    }
  }
}
```

### 5. Start Caddy Container

```bash
# Set environment variables (get these from your friend)
export CLOUDFLARE_API_TOKEN="your_token_here"
export EMAIL="your@email.com"

# Start Caddy
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

### 6. Verify Caddy is Running

```bash
# Check container status
podman ps | grep caddy

# Check Caddy logs
podman logs caddy

# You should see:
# "Caddy serving HTTP on :80"
# "Caddy serving HTTPS on :443"
```

## How It Works

### When You Deploy an App:

```bash
# 1. You deploy via API
curl -X POST http://localhost:3000/api/deploy \
  -H "Content-Type: application/json" \
  -d '{"image": "nginx:alpine","subdomain": "test","repo": "test/repo"}'

# 2. Plutoploy API does:
#    - Creates container on port 3001
#    - Inserts into SQLite:
#      INSERT INTO routes VALUES ('test.plutoploy.com', '127.0.0.1', 3001)

# 3. Caddy automatically:
#    - Reads the new route from SQLite
#    - Routes test.plutoploy.com → 127.0.0.1:3001
#    - Provisions HTTPS certificate
#    - NO RELOAD NEEDED!
```

### Request Flow:

```
User → https://test.plutoploy.com
  ↓
Caddy (Port 443)
  ↓ (queries SQLite)
  ↓ (finds: 127.0.0.1:3001)
  ↓
Container (Port 3001)
  ↓
nginx responds
```

## Troubleshooting

### Caddy not starting?

```bash
# Check logs
podman logs caddy

# Common issues:
# - Wrong db_path (must be absolute)
# - Database file doesn't exist yet (start Plutoploy API first)
# - Port 80/443 already in use
```

### Routes not working?

```bash
# Check if route exists in database
podman exec caddy ls -la /data/plutoploy.db

# If file not found, check volume mount
podman inspect caddy | grep -A 10 Mounts
```

### HTTPS not working?

```bash
# Check Cloudflare token
podman exec caddy env | grep CLOUDFLARE

# Check Caddy logs for certificate errors
podman logs caddy | grep -i certificate
```

## Summary

1. ✅ Pull Caddy image: `podman pull ghcr.io/pratyay360/caddy-cloudflare-sqlite:latest`
2. ✅ Edit `caddy.json`: Change domain and db_path
3. ✅ Start Caddy container with volume mounts
4. ✅ Start Plutoploy API: `npm run pm2:start`
5. ✅ Deploy apps: Routes automatically added to SQLite
6. ✅ Caddy automatically routes traffic (no reload!)
