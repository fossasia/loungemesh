# Eventyay Integration

Flowspace is deployed as a **standalone application** and integrates with Eventyay through the `eventyay-flowspace` Django plugin.

## Architecture

```
Eventyay (Django)
  └── eventyay-flowspace plugin
        ├── FlowspaceRoom model  — per-event room configuration
        ├── /api/v1/flowspace/token/  — opaque → Jitsi JWT exchange
        ├── /api/v1/flowspace/token/refresh/  — JWT renewal
        └── /flowspace/<event>/<room>/  — iframe embed page

Flowspace (Vue SPA)  ←  deployed separately
  ├── /join/:jitsiRoom?token=<opaque>  — Eventyay entry point
  ├── /session/:jitsiRoom  — spatial lounge
  └── useAccessGuard  — validates token, stores JWT in sessionStorage
```

## Access control

When `VITE_EVENTYAY_API_BASE` and `VITE_EVENTYAY_JWT_ENDPOINT` are set, Flowspace operates in **restricted mode**:

1. Eventyay generates a short-lived opaque token for authenticated users (ticket holders).
2. The `eventyay-flowspace` plugin redirects the user to:
   ```
   https://flowspace.example.com/join/<jitsiRoom>?token=<opaque>&event=<slug>&room=<slug>
   ```
3. Flowspace exchanges the token for a signed **Jitsi JWT** via `POST /api/v1/flowspace/token/`.
4. The JWT is forwarded to `lib-jitsi-meet` — Jitsi validates it against the shared app secret.
5. Users without a valid token see the **"Lounge not available"** page.

When these variables are **not set**, Flowspace runs in open mode (suitable for self-hosted or development deployments).

## iframe embedding

Eventyay embeds Flowspace in a small preview iframe with an **"Open in new tab"** button — this is the primary way participants use the lounge. The Flowspace SPA also functions fully in a standalone tab.

### nginx configuration

Set `NGINX_ALLOW_IFRAME_FROM` in your Docker environment to permit Eventyay to embed Flowspace:

```yaml
# docker-compose.yml
services:
  flowspace:
    image: flowspace:latest
    environment:
      NGINX_ALLOW_IFRAME_FROM: "https://eventyay.com https://video.eventyay.com"
```

This sets the `Content-Security-Policy: frame-ancestors` header at runtime (no rebuild required).

### Build-time config

The `VITE_ALLOW_IFRAME_FROM` build arg is used by the SPA's `postMessage` bridge to validate incoming messages from the Eventyay parent window:

```
VITE_ALLOW_IFRAME_FROM=https://eventyay.com,https://video.eventyay.com
```

## eventyay-flowspace plugin setup

Install the plugin in your Eventyay deployment:

```bash
pip install eventyay-flowspace
```

Then, in the Eventyay admin or event settings, configure each room:

| Field | Example |
|---|---|
| Event | `fossasia-2026` |
| Slug | `hallway` |
| Jitsi room | *(auto-derived: `fls-fossasia-2026-hallway`)* |
| Flowspace URL | `https://flowspace.fossasia.org` |
| Allow guests | Off (ticket required) |

Set the Jitsi secure-domain credentials in Eventyay's plugin settings:

```
flowspace_jitsi_app_id = myapp
flowspace_jitsi_app_secret = shared-secret-matching-jitsi-server
```

## JWT token lifecycle

```
User clicks lounge button in Eventyay
  → plugin issues opaque token (2h TTL)
  → redirect to /join/<room>?token=<opaque>
  → Flowspace exchanges token for Jitsi JWT
  → Flowspace stores JWT in sessionStorage
  → JitsiAdapter connects with JWT
  → On AUTHENTICATION_REQUIRED: calls token refresh endpoint
  → fresh JWT injected without page reload
```

## Local development with Eventyay on localhost

To test the full integration on your machine:

1. **Start Eventyay** on port 8000 with the plugin installed:
   ```bash
   cd /path/to/eventyay
   pip install -e plugins/eventyay-flowspace
   python manage.py runserver 8000
   ```

2. **Configure Flowspace** in `.env` (after `npm run setup`, uncomment Eventyay vars):
   ```
   VITE_EVENTYAY_API_BASE=http://localhost:8000
   VITE_EVENTYAY_JWT_ENDPOINT=http://localhost:8000/api/v1/flowspace/token/
   VITE_ALLOW_IFRAME_FROM=http://localhost:8000
   ```

3. **Start Flowspace**:
   ```bash
   npm run dev   # http://localhost:5173
   ```

4. In Eventyay, navigate to your event → plugin settings → Flowspace rooms.
   Create a room, set `flowspace_url = http://localhost:5173`.

5. Open the embed URL: `http://localhost:8000/flowspace/<event>/<room>/`
   — the iframe loads Flowspace; the "Open in new tab" button opens `http://localhost:5173`.

> **Note:** The Jitsi JWT integration requires a running Jitsi instance with a matching `app_secret`.
> For UI development without Jitsi, leave `VITE_EVENTYAY_JWT_ENDPOINT` unset (open mode).

## Session names and the "not-available" block

When Eventyay creates a Flowspace room, the Jitsi room name is derived as
`fls-<event-slug>-<room-slug>`. The `secureConferenceName` utility on the
Flowspace side normalises and re-prefixes the name to prevent collisions with
other Jitsi rooms on the same server.

Rooms owned by Eventyay are not directly joinable via URL without a valid token.
Anyone navigating to `/join/<room>` without `?token=` receives the
`AccessDeniedPage` with reason `no_token`.


