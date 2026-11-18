# Eventyay Integration

LoungeMesh is deployed as a **standalone application** and integrates with Eventyay through the `eventyay-loungemesh` Django plugin.

## Architecture

```
Eventyay (Django)
  ├── LoungeMeshServer model  — server registry & service secret
  ├── Live LoungeMeshModule   — generates signed grants & manages event servers
  └── /join/<room>?grant=<signed_grant>  — iframe embed / new-tab join URL

LoungeMesh (Express + Vue SPA)
  ├── GET /api/integration/verify     — verifies EVENTYAY_SERVICE_SECRET and reachability
  ├── POST /api/integration/exchange  — verifies signed grant & sets access session
  ├── /join/:jitsiRoom?grant=<grant>  — entry point exchanged via useAccessGuard
  └── /session/:jitsiRoom             — spatial lounge
```

## Access control & Verification

1. **Server Verification**:
   When pairing or testing a LoungeMesh server in Eventyay, Eventyay sends:
   ```http
   GET /api/integration/verify
   x-service-secret: <EVENTYAY_SERVICE_SECRET>
   ```
   LoungeMesh validates the secret using constant-time comparison and returns `{"ok": true, "service": "loungemesh"}`.

2. **Signed Grant Exchange**:
   When an authenticated user enters a lounge:
   - Eventyay issues a short-lived `HS256` JWT grant signed with `EVENTYAY_SERVICE_SECRET`.
   - The user opens `https://loungemesh.example.com/join/<jitsiRoom>?grant=<token>`.
   - LoungeMesh exchanges the grant via `POST /api/integration/exchange`.
   - LoungeMesh sets the `lm_access` session cookie, maps roles (`host`, `moderator`, `attendee`), and connects to Jitsi with JWT credentials.


## iframe embedding

Eventyay embeds LoungeMesh in a small preview iframe with an **"Open in new tab"** button — this is the primary way participants use the lounge. The LoungeMesh SPA also functions fully in a standalone tab.

### nginx configuration

Set `NGINX_ALLOW_IFRAME_FROM` in your Docker environment to permit Eventyay to embed LoungeMesh:

```yaml
# docker-compose.yml
services:
  loungemesh:
    image: loungemesh:latest
    environment:
      NGINX_ALLOW_IFRAME_FROM: "https://eventyay.com https://video.eventyay.com"
```

This sets the `Content-Security-Policy: frame-ancestors` header at runtime (no rebuild required).

### Build-time config

The `VITE_ALLOW_IFRAME_FROM` build arg is used by the SPA's `postMessage` bridge to validate incoming messages from the Eventyay parent window:

```
VITE_ALLOW_IFRAME_FROM=https://eventyay.com,https://video.eventyay.com
```

## eventyay-loungemesh plugin setup

Install the plugin in your Eventyay deployment:

```bash
pip install eventyay-loungemesh
```

Then, in the Eventyay admin or event settings, configure each room:

| Field | Example |
|---|---|
| Event | `fossasia-2026` |
| Slug | `hallway` |
| Jitsi room | *(auto-derived: `lms-fossasia-2026-hallway`)* |
| LoungeMesh URL | `https://loungemesh.fossasia.org` |
| Allow guests | Off (ticket required) |

Set the Jitsi secure-domain credentials in Eventyay's plugin settings:

```
loungemesh_jitsi_app_id = myapp
loungemesh_jitsi_app_secret = shared-secret-matching-jitsi-server
```

## JWT token lifecycle

```
User clicks lounge button in Eventyay
  → plugin issues opaque token (2h TTL)
  → redirect to /join/<room>?token=<opaque>
  → LoungeMesh exchanges token for Jitsi JWT
  → LoungeMesh stores JWT in sessionStorage
  → JitsiAdapter connects with JWT
  → On AUTHENTICATION_REQUIRED: calls token refresh endpoint
  → fresh JWT injected without page reload
```

## Local development with Eventyay on localhost

To test the full integration on your machine:

1. **Start Eventyay** on port 8000 with the plugin installed:
   ```bash
   cd /path/to/eventyay
   pip install -e plugins/eventyay-loungemesh
   python manage.py runserver 8000
   ```

2. **Configure LoungeMesh** in `.env` (after `npm run setup`, uncomment Eventyay vars):
   ```
   VITE_EVENTYAY_API_BASE=http://localhost:8000
   VITE_EVENTYAY_JWT_ENDPOINT=http://localhost:8000/api/v1/loungemesh/token/
   VITE_ALLOW_IFRAME_FROM=http://localhost:8000
   ```

3. **Start LoungeMesh**:
   ```bash
   npm run dev   # http://localhost:5173
   ```

4. In Eventyay, navigate to your event → plugin settings → LoungeMesh rooms.
   Create a room, set `loungemesh_url = http://localhost:5173`.

5. Open the embed URL: `http://localhost:8000/loungemesh/<event>/<room>/`
   — the iframe loads LoungeMesh; the "Open in new tab" button opens `http://localhost:5173`.

> **Note:** The Jitsi JWT integration requires a running Jitsi instance with a matching `app_secret`.
> For UI development without Jitsi, leave `VITE_EVENTYAY_JWT_ENDPOINT` unset (open mode).

## Session names and the "not-available" block

When Eventyay creates a LoungeMesh room, the Jitsi room name is derived as
`lms-<event-slug>-<room-slug>`. The `secureConferenceName` utility on the
LoungeMesh side normalises and re-prefixes the name to prevent collisions with
other Jitsi rooms on the same server.

Rooms owned by Eventyay are not directly joinable via URL without a valid token.
Anyone navigating to `/join/<room>` without `?token=` receives the
`AccessDeniedPage` with reason `no_token`.


