---
name: loungemesh-scaling
description: >-
  Performance engineering and resource optimization practices for LoungeMesh, covering spatial
  viewport culling, resolution budgeting, Prosody tuning, Nginx rate-limiting, and database pooling.
---

# LoungeMesh Scaling & Performance Skill

This skill guides agents in maintaining ultra-low baseline resource consumption (target: 2 vCPU / 2 GB RAM) and scaling LoungeMesh efficiently for up to 100+ concurrent participants.

---

## 1. Principles of Low-Resource Operation

1. **No Artificial Memory Limits**: Never add rigid Docker memory limits (`mem_limit`). Prevent high memory consumption by reducing stream overhead, buffering, and database query sizes.
2. **Selective Subscription (Zero Off-Screen Video)**: Only request video for participants currently visible in the user's viewport or on stage.
3. **Capture Budgeting**: Limit local capture resolutions to reduce encoding CPU and uplink bandwidth.

---

## 2. Spatial Viewport Culling Pattern

Implemented in `src-vue/utils/receiverConstraints.ts`:

```ts
export function buildReceiverConstraints(opts: {
  localId: string;
  remoteUserIds: string[];
  visibleUserIds: string[];
  stageIds: string[];
}): ReceiverConstraints | null {
  const remoteUserIds = opts.remoteUserIds.filter((id) => id && id !== opts.localId);
  if (!remoteUserIds.length) return null;

  const visible = [...new Set(opts.visibleUserIds)].filter((id) => id && id !== opts.localId);
  const stage = [...new Set(opts.stageIds)].filter((id) => id && id !== opts.localId);
  const selectedEndpoints = [...new Set([...visible, ...stage])];
  // Camera is endpointId-v0. Screenshare is endpointId-v1 (or v0 if the camera is off).
  const selectedSources = selectedEndpoints.flatMap((id) => [`${id}-v0`, `${id}-v1`]);

  const channelLastN =
    typeof conferenceOptions.channelLastN === 'number' && conferenceOptions.channelLastN > 0
      ? conferenceOptions.channelLastN
      : 20;
  const lastN = Math.min(selectedSources.length, channelLastN * 2);

  const onStageSources = stage.flatMap((id) => [`${id}-v0`, `${id}-v1`]);
  const TILE_MAX_HEIGHT = 360;
  const STAGE_MAX_HEIGHT = 720;
  const constraints: Record<string, { maxHeight: number }> = {};
  for (const id of selectedEndpoints) {
    const onStage = stage.includes(id);
    constraints[`${id}-v0`] = { maxHeight: onStage ? STAGE_MAX_HEIGHT : TILE_MAX_HEIGHT };
    constraints[`${id}-v1`] = { maxHeight: STAGE_MAX_HEIGHT };
  }

  return {
    selectedSources,
    lastN,
    onStageSources,
    defaultConstraints: { maxHeight: TILE_MAX_HEIGHT },
    constraints,
  };
}
```

### Critical Invariants
- When `selectedEndpoints` is empty, `selectedSources` MUST be `[]` and `lastN` MUST be `0`.
- Do not fall back to `remoteUserIds.slice(0, 4)` as it forces the bridge to forward 4 streams for off-screen users.

---

## 3. Capture Resolution Budgeting

Configured in `src-vue/services/JitsiAdapter.ts`:
- **Avatar Camera**:
  - `height: { ideal: 360, max: 480 }`
  - `frameRate: { ideal: 24, max: 24 }`
- **Desktop Screenshare**:
  - `constraints.video: { height: { ideal: 720, max: 720 }, width: { ideal: 1280, max: 1280 }, frameRate: { ideal: 24, max: 30 } }`
  - `desktopSharingFrameRate: { min: 15, max: 30 }`

---

## 4. Signaling & Infrastructure Tuning

- **Prosody (`scripts/loungemesh.sh`)**:
  - C2S rate: `128kb/s`
  - Stream buffer: `smacks_max_unacked_stanzas = 25`
- **Presence vs live messages**: Avatar position, name, host, access, config, and hand state stay in presence. Notes, whiteboard, chat, reactions, polls, and other bursts go out as `lm-cmd` JSON MUC messages (`JitsiAdapter.sendCommand`). Do not put those payloads back into presence — every later position update would resend them and Prosody will drop the XMPP connection.
  - Always verify configuration generation via `wait_for_prosody_config` before patching.
- **Nginx (`nginx/default.conf.template`)**:
  - `set_real_ip_from <trusted_proxy_cidr>; real_ip_header X-Forwarded-For;` (deployments must configure their actual trusted proxy CIDRs; never use `0.0.0.0/0` in production).
  - Rate limiting: `50r/s burst=100`.
- **Database (`env.example`)**:
  - `DATABASE_URL` pool config: `connection_limit=20&pool_timeout=15`.
