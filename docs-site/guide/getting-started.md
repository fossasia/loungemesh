# Getting Started

This guide walks you through setting up LoungeMesh for local development and running the complete containerized stack.

---

## Requirements

- **Node.js**: v20 or newer
- **npm**: v10 or newer
- **Docker & Docker Compose**: v2.20+ (for containerized stack)
- **Browser**: Chrome, Firefox, Safari, or Edge with WebRTC support

---

## Option 1: Full Docker Stack (Recommended)

Spins up the entire multi-service architecture: LoungeMesh SPA, Express API backend, PostgreSQL database, Redis cache, and self-hosted Jitsi components.

```bash
# 1. Generate .env file from template and auto-detect LAN IP
npm run setup

# 2. Build and launch all Docker containers
npm run docker:up
```

### Accessing Services

| Service | Local URL | Description |
|---|---|---|
| **LoungeMesh SPA & API** | [http://127.0.0.1:8780](http://127.0.0.1:8780) | LoungeMesh interface and Express API |
| **Jitsi Meet Web** | [http://127.0.0.1:8001](http://127.0.0.1:8001) | Jitsi web & signaling proxy |
| **PostgreSQL** | `127.0.0.1:5432` | Internal database for users, meetings, and configs |
| **Redis** | `127.0.0.1:6379` | Fast state cache for whiteboard, notes, and polls |

> **Tip**: Use `127.0.0.1` instead of `localhost` on macOS/Linux to avoid IPv6 loopback resolution issues with container port mapping.

---

## Option 2: Local Development Setup

If you want hot-reloading for the Vue 3 frontend and Express backend:

```bash
# 1. Install root dependencies and server dependencies
npm install
npm --prefix server install

# 2. Initialize .env file
npm run setup

# 3. Apply Prisma database migrations (ensure Postgres is running)
npm --prefix server run prisma:migrate -- --name init

# 4. Start both development servers
npm run dev                    # Starts Vue SPA on http://localhost:5173
npm --prefix server run dev    # Starts Express API on http://localhost:5000
```

---

## Key Environment Variables

Environment variables are configured in `.env` (copied from `env.example` by `npm run setup`):

### Frontend SPA Variables
| Variable | Purpose |
|---|---|
| `VITE_JITSI_PUBLIC_URL` | Public URL for Jitsi WebRTC signaling |
| `VITE_XMPP_DOMAIN` | XMPP signaling domain (default: `meet.jitsi`) |
| `VITE_EVENTYAY_JWT_ENDPOINT` | Configured Eventyay endpoint used to exchange the `?token=` parameter for a signed Jitsi JWT |
| `VITE_EVENTYAY_API_BASE` | Optional Eventyay API base URL for room wallpapers and access gating |

### Backend API & Database Variables
| Variable | Purpose |
|---|---|
| `PORT` | Express listening port (default: `5000`) |
| `DATABASE_URL` | PostgreSQL connection string with connection pool options |
| `REDIS_URL` | Redis connection URL (default: `redis://127.0.0.1:6379`) |
| `JWT_SECRET` | Secret key used to sign HTTP session cookies |
| `ENCRYPTION_KEY` | 32-byte hexadecimal key for AES-256 Google OAuth encryption |
| `ALLOWED_OAUTH_ORIGINS` | Whitelisted frontend origins for OAuth redirect callbacks |

---

## Entering a Room

- Navigating to `/session` redirects to the default lounge room `/session/loungemesh`.
- To join any custom room, navigate to `/session/<roomName>`.
- For Eventyay integration links, enter via `/join/<roomName>?token=<opaqueToken>`.
