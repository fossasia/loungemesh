# Getting started

## Requirements

- Node.js 20+
- Chromium or Chrome (recommended for WebRTC)
- Optional: Docker for self-hosted Jitsi

## Development

```bash
npm install
npm run setup
npm run dev
```

Open `http://localhost:5173` in your browser.

## Docker (SPA + Jitsi)

```bash
npm run setup
npm run docker:up
```

| Service | URL |
|---------|-----|
| Flowspace SPA | http://localhost:8780 |
| Jitsi web | http://localhost:8001 |
| Eventyay (separate stack) | http://localhost:8000 |

Port **8780** is the default so Flowspace does not conflict with Eventyay’s video dev server on **8880**.

## Environment variables

Copy `env.development.example` to `.env` via `npm run setup`, or see [env.development.example](https://github.com/eventyay/flowspace/blob/main/env.development.example). Key variables:

| Variable | Purpose |
|----------|---------|
| `VITE_JITSI_PUBLIC_URL` | Public Jitsi web URL (Docker stack) |
| `VITE_XMPP_DOMAIN` | XMPP domain (e.g. `meet.jitsi`) |
| `VITE_SERVICE_URL` | Single-host Jitsi hostname |
| `VITE_SESSION_PREFIX` | Room name prefix (default `fls`) |
| `VITE_EVENTYAY_API_BASE` | Optional Eventyay API for wallpapers |
| `VITE_EVENTYAY_JWT_ENDPOINT` | JWT issuer for secure Jitsi |

## Default room

Visiting `/session` redirects to `/session/flowspace`.
