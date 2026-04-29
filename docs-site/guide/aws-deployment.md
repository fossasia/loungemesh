# AWS free-tier deployment (beginner guide)

Deploy Flowspace + your own Jitsi on a small free AWS server, with HTTPS.

**Your domains (example):**

| Role | URL |
|------|-----|
| Flowspace app | `https://eventyayflowspace.duckdns.org` |
| Jitsi (video/WebSocket) | `https://jitsi-eventyayflowspace.duckdns.org` |

You need **two** DuckDNS names pointing to the **same** server IP (both are free).

---

## Part 1 — DuckDNS (5 minutes)

1. Go to [duckdns.org](https://www.duckdns.org/) and sign in.
2. Create subdomain **`eventyayflowspace`** → you get `eventyayflowspace.duckdns.org`.
3. Create another subdomain **`jitsi-eventyayflowspace`** → `jitsi-eventyayflowspace.duckdns.org`.
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
2. **Name:** `flowspace`
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
2. **Associate** it with your `flowspace` instance
3. Copy this IP (e.g. `3.120.45.67`) → put it in **both** DuckDNS subdomains

### 2.4 SSH into the server

On your Mac (Terminal), fix key permissions once:

```bash
chmod 400 ~/Downloads/your-key.pem
ssh -i ~/Downloads/your-key.pem ubuntu@YOUR_ELASTIC_IP
```

You should see a prompt like `ubuntu@ip-172-...`.

---

## Part 3 — Install Flowspace on the server

**You clone the repo** (bootstrap does not). Use SSH or a GitHub PAT — not your account password:

```bash
git clone git@github.com:YOUR_GITHUB_USER/flowspace.git ~/flowspace
cd ~/flowspace
chmod +x scripts/*.sh
./scripts/bootstrap-server.sh \
  --app-host=eventyayflowspace.duckdns.org \
  --jitsi-host=jitsi-eventyayflowspace.duckdns.org \
  --public-ip=YOUR_ELASTIC_IP \
  --email=your-email@gmail.com \
  --deploy
```

**First run** may install Docker and ask you to **log out and SSH in again**. Then run the same command with `--skip-system` added:

```bash
cd ~/flowspace
./scripts/bootstrap-server.sh --skip-system \
  --app-host=eventyayflowspace.duckdns.org \
  --jitsi-host=jitsi-eventyayflowspace.duckdns.org \
  --public-ip=YOUR_ELASTIC_IP \
  --email=your-email@gmail.com \
  --deploy
```

Wait 5–15 minutes for Docker to build. When done:

- Open **https://eventyayflowspace.duckdns.org**
- Create a room and test from your phone (mobile data, not same Wi‑Fi)

---

## Part 4 — GitHub auto-deploy (optional)

After the server works manually:

1. GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. **Variables:** `DEPLOY_HOST` = your Elastic IP
3. **Secrets:** `DEPLOY_USER` = `ubuntu`, `DEPLOY_SSH_PRIVATE_KEY` = paste entire `.pem` file
4. Push to **`main`** or **`dev`** → CI runs tests + e2e + deploys without overwriting `.env` passwords

---

## Security — no environment leaks

| Rule | Why |
|------|-----|
| `.env` is in `.gitignore` | Never committed |
| CI only copies `env.development.example` | No real secrets in GitHub |
| `npm run setup` **merges** into `.env` | Existing passwords and keys are **not** overwritten |
| Re-run setup | Safe; use `--force` only if you intend to reset non-secrets |
| `--rotate-passwords` | Only changes **placeholder** Jitsi passwords |
| `.env` file mode `600` on Linux | Only your user can read it |

**Never** paste `.env` into GitHub issues, chat, or commits.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Site not loading | DuckDNS IP = Elastic IP? Security group 80/443 open? |
| WebSocket error / `localhost:8001` | Fix hosts once: `npm run setup:prod -- --jitsi-host=... --public-ip=...`, then `npm run deploy` |
| No video | UDP port **10000** open in security group |
| “Connection refused” SSH | Security group port 22; correct `.pem` and IP |
| Server very slow / OOM | Bootstrap adds swap; wait for build to finish |

---

## Commands cheat sheet (on the server)

```bash
cd ~/flowspace
npm run deploy                    # merge .env from template + rebuild (after git pull)
npm run setup:prod -- --jitsi-host=... --public-ip=...  # first-time only, or to change hosts
docker compose ps                 # check containers
sudo systemctl status caddy       # check HTTPS proxy
```

---

## Cost

- **t3.micro** first 12 months: often $0 within free tier if you don’t run 24/7 over limits
- **Stop** the instance when not testing to save hours
- DuckDNS: free

This setup is for **testing and demos**, not large production traffic.
