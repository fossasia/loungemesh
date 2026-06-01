# AWS free-tier deployment (beginner guide)

Deploy LoungeMesh + your own Jitsi on a small free AWS server, with HTTPS.

**Your domains (example):**

| Role | URL |
|------|-----|
| LoungeMesh app | `https://eventyayloungemesh.duckdns.org` |
| Jitsi (video/WebSocket) | `https://jitsi-eventyayloungemesh.duckdns.org` |

You need **two** DuckDNS names pointing to the **same** server IP (both are free).

---

## Part 1 — DuckDNS (5 minutes)

1. Go to [duckdns.org](https://www.duckdns.org/) and sign in.
2. Create subdomain **`eventyayloungemesh`** → you get `eventyayloungemesh.duckdns.org`.
3. Create another subdomain **`jitsi-eventyayloungemesh`** → `jitsi-eventyayloungemesh.duckdns.org`.
4. For **both**, set the IP to your AWS public IP (you get this in Part 2 step 8).  
   Until the server exists, you can update the IP later.

Use **https** in the browser later (Caddy adds certificates automatically). Do not use `http://` in production `.env` — setup scripts use `https://`.

---

## Part 2 — AWS EC2 (15–20 minutes)

### 2.1 Create an AWS account

1. [aws.amazon.com](https://aws.amazon.com/) → Create account (credit card for verification; stay in **Free tier**).
2. Pick a region close to you (e.g. **Europe (Stockholm)** or **US East**).

### 2.2 Launch a server

1. AWS Console → search **EC2** → **Launch instance**.
2. **Name:** `loungemesh`
3. **AMI:** Ubuntu 22.04 LTS
4. **Instance type:** `t3.micro` (Free tier eligible)
5. **Key pair:** Create new → download `.pem` file → keep it safe (this is your SSH key).
6. **Network / Security group:** Create new with these **Inbound rules**:

   | Type | Port | Source |
   |------|------|--------|
   | SSH | 22 | My IP (recommended) |
   | HTTP | 80 | Anywhere (0.0.0.0/0) |
   | HTTPS | 443 | Anywhere |
   | Custom UDP | 10000 | Anywhere |

7. **Storage:** 20–30 GB
8. **Launch instance**

### 2.3 Elastic IP (fixed address)

1. EC2 → **Elastic IPs** → **Allocate**
2. **Associate** it with your `loungemesh` instance
3. Copy this IP (e.g. `3.120.45.67`) → put it in **both** DuckDNS subdomains

### 2.4 SSH into the server

On your Mac (Terminal), fix key permissions once:

```bash
chmod 400 ~/Downloads/your-key.pem
ssh -i ~/Downloads/your-key.pem ubuntu@YOUR_ELASTIC_IP
```

You should see a prompt like `ubuntu@ip-172-...`.

---

## Part 3 — Install LoungeMesh on the server

**You clone the repo** (bootstrap does not). Use SSH or a GitHub PAT — not your account password:

```bash
git clone git@github.com:YOUR_GITHUB_USER/loungemesh.git ~/loungemesh
cd ~/loungemesh
chmod +x scripts/*.sh
./scripts/loungemesh.sh bootstrap \
  --app-host=eventyayloungemesh.duckdns.org \
  --jitsi-host=jitsi-eventyayloungemesh.duckdns.org \
  --email=your-email@gmail.com \
  --deploy
# --public-ip is auto-detected; add --public-ip=YOUR_ELASTIC_IP to force it
```

**First run** may install Docker and ask you to **log out and SSH in again**. Then run the same command with `--skip-system` added:

```bash
cd ~/loungemesh
./scripts/loungemesh.sh bootstrap --skip-system \
  --app-host=eventyayloungemesh.duckdns.org \
  --jitsi-host=jitsi-eventyayloungemesh.duckdns.org \
  --email=your-email@gmail.com \
  --deploy
```

Wait 5–15 minutes for Docker to build. When done:

- Open **https://eventyayloungemesh.duckdns.org**
- Create a room and test from your phone (mobile data, not same Wi‑Fi)

---

## Part 4 — GitHub auto-deploy (optional)

After the server works manually:

1. GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. **Variables:** `DEPLOY_HOST` = your Elastic IP (optionally `DEPLOY_PATH`)
3. **Secrets:** `DEPLOY_USER` = `ubuntu`, `DEPLOY_SSH_PRIVATE_KEY` = paste entire `.pem` file
4. Push to **`main`** or **`dev`** → CI runs tests + e2e + deploys without overwriting `.env` passwords

CI deploys with `loungemesh.sh deploy --auto-ip`, which re-detects the server's
public IP each time — so deploys keep working even if the Elastic IP is
reassigned.

---

## Security — no environment leaks

| Rule | Why |
|------|-----|
| `.env` is in `.gitignore` | Never committed |
| CI only copies `env.example` | No real secrets in GitHub |
| `npm run deploy` **merges** into `.env` | Existing passwords and keys are **not** overwritten |
| Re-run setup/deploy | Safe; use `--force` only if you intend to reset non-secrets |
| `--rotate-passwords` | Only changes **placeholder** Jitsi passwords |
| `.env` file mode `600` on Linux | Only your user can read it |

**Never** paste `.env` into GitHub issues, chat, or commits.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Site not loading | DuckDNS IP = Elastic IP? Security group 80/443 open? |
| WebSocket error / `localhost:8001` | Fix hosts once: `./scripts/loungemesh.sh bootstrap --app-host=... --jitsi-host=... --skip-system --deploy` |
| No video / no audio | **UDP 10000** open; `DOCKER_HOST_ADDRESS` = Elastic IP (not `172.18.x.x`); run `./scripts/loungemesh.sh deploy --auto-ip` |
| `colibri-ws/172.18.0.x` in console | JVB still uses Docker bridge IP. On the server run `npm run fix:jvb` (auto-detects the public IP). `npm run deploy` alone does **not** update a running JVB. |
| `colibri-ws` WebSocket failed (1006) | Caddy must proxy `/colibri-ws` on app + Jitsi hosts (`loungemesh.sh bootstrap --update-caddy`); `DOCKER_HOST_ADDRESS` must match the IP segment in the colibri URL |
| No remote `TRACK_ADDED` in `[loungemesh:media]` logs | ICE/bridge broken — fix `DOCKER_HOST_ADDRESS` first; only local tracks means JVB never forwarded media |
| “Connection refused” SSH | Security group port 22; correct `.pem` and IP |
| Server very slow / OOM | Bootstrap adds swap; wait for build to finish |

---

## Commands cheat sheet (on the server)

```bash
cd ~/loungemesh
npm run deploy                                  # merge .env from template + rebuild (after git pull)
./scripts/loungemesh.sh deploy --auto-ip        # redeploy and re-detect public IP
npm run fix:jvb                                 # fix a JVB advertising the wrong IP
docker compose ps                              # check containers
sudo systemctl status caddy                    # check HTTPS proxy
```

---

## Cost

- **t3.micro** first 12 months: often $0 within free tier if you don’t run 24/7 over limits
- **Stop** the instance when not testing to save hours
- DuckDNS: free

This setup is for **testing and demos**, not large production traffic.
