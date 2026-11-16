# Scaling & Performance Optimization

This guide outlines the performance architecture and resource optimization strategies implemented in LoungeMesh.

---

## Core Design Philosophy

LoungeMesh is designed with an **ultra-low baseline resource profile**:
- **Baseline Hardware Target**: Runs reliably on a low-cost **2 vCPU / 2 GB RAM** instance.
- **Predictable Scaling**: Rather than applying artificial memory or CPU caps (which lead to dropped connections or container restarts under load), the system is optimized at the algorithmic, media, network, and database levels to keep resource consumption minimal by design.
- **Horizontal & Vertical Headroom**: As compute is scaled (e.g., 4 vCPU / 8 GB RAM for 40–60 participants, up to 8 vCPU / 16 GB RAM), the system comfortably handles **100+ concurrent active participants** without architectural bottlenecks.

---

## 1. Spatial Viewport Culling

In a spatial lounge with 20 to 100 participants, standard WebRTC architectures that broadcast every user's video stream quickly overwhelm client and server bandwidth.

LoungeMesh solves this through **dynamic spatial viewport culling** via `buildReceiverConstraints`:

```
User Viewport Bounds
┌──────────────────────────────────────────────┐
│  [Avatar 1] (Visible: 360p requested)        │
│  [Avatar 2] (Visible: 360p requested)        │
└──────────────────────────────────────────────┘
      (Off-screen peers: 0 streams requested, lastN = 0)
      [Avatar 3]      [Avatar 4]      [Avatar 5]
```

### Key Implementation Details
- **Zero Video for Off-Screen Peers**: When a participant is looking at an empty corner of the room or none of the remote participants are in view, `selectedSources` is set to `[]` and `lastN` is set to `0`. Jitsi Videobridge streams **zero incoming video tracks**.
- **On-Demand Subscription**: As the user pans, zooms, or avatars walk into view, `calculateUsersOnScreen` dynamically calculates visible endpoints and updates receiver constraints via the Colibri bridge channel.
- **Tiered Per-Source Resolution**:
  - Regular visible avatars: Capped at **360p height** (`TILE_MAX_HEIGHT = 360`).
  - Stage occupants: Elevated to **720p height** (`STAGE_MAX_HEIGHT = 720`).

---

## 2. Capture Resolution & Framerate Budgeting

Local tracks are constrained at the capture level in `JitsiAdapter.ts` to prevent clients from encoding and transmitting unnecessarily large video streams:

### Avatar Video Track
- **Resolution**: `ideal: 360`, `max: 480`
- **Framerate**: `ideal: 24`, `max: 24`
- **Bitrate Impact**: Reduces individual camera upstream bandwidth to ~150–250 kbps (compared to 1.5–2.5 Mbps for unconstrained 1080p).

### Desktop Screenshare Track
- **Resolution**: Capped at **720p** (`width: 1280`, `height: 720`).
- **Framerate**: Adaptive range `{ min: 15, max: 30 }`.
- **Bitrate Impact**: Keeps presentation streams crystal clear for text and slides while avoiding the 4K/1080p CPU spikes that cause browser tab freezing.

---

## 3. Single-Roundtrip State Bundling

Previously, joining a room triggered 7 individual HTTP requests in parallel:
- `/api/meetings/role/:roomName`
- `/api/meetings/config/:roomName`
- `/api/meetings/state/:roomName/whiteboard`
- `/api/meetings/state/:roomName/notes`
- `/api/meetings/state/:roomName/access`
- `/api/meetings/state/:roomName/poll`
- `/api/meetings/state/:roomName/background`

Under burst join conditions (e.g., 20 users entering at the same time), this resulted in **140 concurrent requests** hitting Nginx, Express, and Redis simultaneously.

### The `/init` Endpoint
LoungeMesh bundles these requests into a single endpoint:
```
GET /api/meetings/state/:roomName/init
```
- **Single HTTP Roundtrip**: The backend queries PostgreSQL and Redis in parallel on the server and returns a single unified JSON payload.
- **7x Request Reduction**: 20 joining users produce only **20 requests** instead of 140.
- **Graceful Fallback**: If `/init` fails, the frontend automatically falls back to parallel individual endpoints.

---

## 4. XMPP & Prosody Signaling Optimization

During high participant counts, WebRTC signaling and stanza exchange can exceed default Prosody limits, leading to connection drops. Collaborative events (notes, whiteboard, chat, reactions, polls) are sent as JSON MUC messages instead of presence, so avatar movement does not retransmit those payloads.

LoungeMesh tunes Prosody parameters in `scripts/loungemesh.sh`:
- **C2S Rate Limiting**: Increased from `10kb/s` to `128kb/s` in `prosody.cfg.lua`. This prevents client disconnects during bursts of avatar presence updates.
- **Stream Management Stanzas**: Increased `smacks_max_unacked_stanzas` from `5` to `25` in `jitsi-meet.cfg.lua`. This prevents dropped connections on mobile or lossy Wi-Fi networks.
- **Automated Deployment Hook**: `wait_for_prosody_config` waits for both configuration files to generate on fresh deploys, patches the parameters, and reloads Prosody immediately (`prosodyctl reload`).

---

## 5. Nginx Reverse Proxy Tuning

The Nginx template (`nginx/default.conf.template`) includes optimizations for high concurrency:

- **Real Client IP Forwarding**:
  ```nginx
  # Replace with your deployment's actual trusted reverse proxy / load balancer CIDR
  set_real_ip_from 10.0.0.0/8;
  real_ip_header X-Forwarded-For;
  real_ip_recursive on;
  ```
  Ensures rate-limiting accurately tracks client IP addresses instead of throttling the upstream Docker bridge gateway IP. Deployments must configure their specific trusted proxy CIDRs (e.g., VPC or Cloudflare ranges) rather than an open range (`0.0.0.0/0`), preventing clients from spoofing `X-Forwarded-For` headers to bypass rate limits.
- **Rate Limit Expansion**:
  `limit_req_zone` configured with **50 requests/second** and **burst=100**, preventing legitimate multi-user page loads from receiving HTTP 429 errors.
- **Compression Offloading**: `gzip off;` applied to `/colibri-ws/` and `/xmpp-websocket` to eliminate CPU overhead on encrypted WebRTC signaling streams.

---

## 6. Database Connection Pooling

PostgreSQL connections are managed through Prisma ORM with explicit pool tuning:
```env
DATABASE_URL="postgresql://user:pass@postgres:5432/loungemesh?schema=public&connection_limit=20&pool_timeout=15"
```
- **Connection Limit**: Capped at `20` concurrent database connections, preventing PostgreSQL worker process starvation.
- **Pool Timeout**: Set to `15` seconds to fail fast and release pool resources if an unexpected lock occurs.
- **Redis Cache Layer**: Frequently accessed data (room configs, active polls, whiteboard strokes) is cached in Redis with fast in-memory key lookups (`meeting:config:<roomName>`).

---

## Sizing & Capacity Matrix

| Setup | Recommended Specs | Max Recommended Concurrent Users |
|---|---|---|
| **Entry (Small Meeting)** | 2 vCPU, 2 GB RAM | 15–25 users |
| **Medium (Workshop / Lounge)** | 4 vCPU, 8 GB RAM | 40–60 users |
| **Large (Conference / Keynote)** | 8 vCPU, 16 GB RAM | 100+ users |
