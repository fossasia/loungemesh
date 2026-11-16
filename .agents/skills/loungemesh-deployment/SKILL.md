---
name: loungemesh-deployment
description: >-
  Operational workflows and deployment automation for LoungeMesh, covering scripts/loungemesh.sh,
  Docker Compose orchestration, Prosody patching, JVB IP advertisement, and Prisma migrations.
---

# LoungeMesh Deployment & Operations Skill

This skill documents operations, container orchestration, and server lifecycle workflows for LoungeMesh.

---

## 1. Automation Script: `scripts/loungemesh.sh`

All deployment workflows are consolidated into `scripts/loungemesh.sh`. Never write ad-hoc bash scripts for setup or deploys.

### Core CLI Commands

```bash
# 1. Local environment generation
./scripts/loungemesh.sh dev            # npm run setup

# 2. Server redeploy after git pull
./scripts/loungemesh.sh deploy         # npm run deploy
./scripts/loungemesh.sh deploy --auto-ip

# 3. First-time server bootstrap
./scripts/loungemesh.sh bootstrap \
  --app-host=loungemesh.example.com \
  --email=admin@example.com \
  --deploy

# 4. Bridge IP repair
./scripts/loungemesh.sh fix-jvb        # npm run fix:jvb
```

---

## 2. Jitsi & Prosody Configuration Patching

1. Jitsi containers generate their default configuration on initial startup.
2. In `cmd_deploy`:
   - `wait_for_jitsi_nginx` waits for `meet.conf` (finite 90s deadline).
   - `patch_jitsi_nginx` injects WebSocket headers (`gzip off; Connection: upgrade;`).
   - `wait_for_prosody_config` waits for both `prosody.cfg.lua` and `jitsi-meet.cfg.lua` (finite 90s deadline).
   - `patch_prosody_limits` increases rate limits and stanza buffers.
   - If Prosody is already running, reloads Prosody immediately (`prosodyctl reload || restart`).

---

## 3. Database Schema & Prisma Migrations

- **Development Migration**:
  ```bash
  DATABASE_URL="postgresql://user:pass@127.0.0.1:5432/loungemesh?schema=public" npm --prefix server run prisma:migrate -- --name <migration_name>
  ```
- **Production Migration**:
  ```bash
  DATABASE_URL="postgresql://user:pass@postgres:5432/loungemesh?schema=public" npm --prefix server run prisma:deploy
  ```
- **Prisma Client Generation**:
  ```bash
  npm --prefix server run prisma:generate
  ```

---

## 4. Bridge Troubleshooting (`fix-jvb`)

If browser WebRTC connections fail with ICE disconnection errors:
1. Check the advertised IP: If clients receive `172.18.0.x` (internal Docker bridge IP), run:
   ```bash
   npm run fix:jvb
   ```
2. Verify UDP port 10000 is open in the server firewall / AWS Security Group for WebRTC media packets.
