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
   - LoungeMesh sets the `lm_access` session cookie and returns the grant role (`host`, `moderator`, `attendee`, as well as `reviewer`, `speaker`, `guest`). Privileged roles (`host` and `moderator`) bypass PIN and room capacity checks and receive the Jitsi moderator flag.


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

## JWT grant lifecycle

```
User clicks lounge button in Eventyay
  → Eventyay issues signed grant JWT (2h TTL, HS256 with EVENTYAY_SERVICE_SECRET)
  → redirect/embed loads /join/<room>?grant=<signed_grant>
  → LoungeMesh exchanges grant via POST /api/integration/exchange
  → LoungeMesh sets lm_access cookie and issues Jitsi JWT
  → JitsiAdapter connects with JWT credentials
  → On page reload: access cookie re-used via GET /api/integration/session
```

## Local development with Eventyay on localhost

To test the full integration on your machine:

1. **Start Eventyay** on port 8000:
   ```bash
   cd /path/to/eventyay
   python manage.py runserver 8000
   ```

2. **Configure LoungeMesh**:
   - In `server/.env` (read by backend):
     ```bash
     EVENTYAY_SERVICE_SECRET="your-matching-eventyay-service-secret"
     ```
   - In repository root `.env` (read by Vite frontend):
     ```bash
     VITE_ALLOW_IFRAME_FROM=http://localhost:8000
     ```

3. **Start LoungeMesh backend and frontend**:
   - In terminal 1, start the backend API server (listens on `http://localhost:5000` by default):
     ```bash
     npm --prefix server run dev
     ```
   - In terminal 2, start the Vite client frontend (`http://localhost:5173`):
     ```bash
     npm run dev
     ```
   *(Note: The Vite dev server proxies `/api` requests to `http://localhost:5000` or the origin specified by `VITE_API_ORIGIN`.)*

4. In Eventyay admin (`/control/admin/video/loungemesh/`), pair your server `http://localhost:5173` with the matching `EVENTYAY_SERVICE_SECRET`.
   The admin connectivity test will call `GET /api/integration/verify` with header `x-service-secret`.

## Session names and access guard

When Eventyay creates a LoungeMesh room, the Jitsi room name is derived as
`lms-<event-slug>-<room-slug>`. The `secureConferenceName` utility on the
LoungeMesh side normalises and re-prefixes the name to prevent collisions with
other Jitsi rooms on the same server.

### Access control configuration and behavior

The client access guard (`useAccessGuard`) enforces room access according to environment configuration:

1. **Gated access enforcement**:
   - To enforce gated access for Eventyay rooms, `VITE_EVENTYAY_API_BASE` must be set in the frontend environment. When set, navigating to `/join/<room>` without a valid grant, session, or token directs the user to `AccessDeniedPage` with reason `no_token`.
   - In open standalone mode (when `VITE_EVENTYAY_API_BASE` is unset and no grant or token is provided), `useAccessGuard` permits open access for development and testing.

2. **Signed grant flow**:
   - When `?grant=` is provided, `useAccessGuard` exchanges the signed grant at `/api/integration/exchange`. Access is granted only if the grant signature, numeric expiration (`exp`), and event/room claims are valid and verified against `EVENTYAY_SERVICE_SECRET` (falling back to `JWT_SECRET` when `EVENTYAY_SERVICE_SECRET` is unset).

3. **Legacy token fallback**:
   - If a legacy `?token=` parameter is provided, it is forwarded to `VITE_EVENTYAY_JWT_ENDPOINT` for verification. Note that if `VITE_EVENTYAY_JWT_ENDPOINT` is unset, legacy tokens are accepted without remote validation. For secure production gating, configure `VITE_EVENTYAY_API_BASE` and use signed grants.


