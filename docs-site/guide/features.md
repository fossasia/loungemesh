# Features & User Flows

This guide documents the comprehensive user flows and feature architectures implemented in LoungeMesh.

---

## 1. Room Entry & Access Control Flows

### Direct Join Flow
1. User navigates to `/` or directly to `/session/<roomName>`.
2. If no name or avatar is saved in `localStorage`, the user is presented with the **Name Input & Avatar Picker**.
3. Once submitted, the user enters the spatial room and joins the WebRTC conference.

### Eventyay Gated Entry Flow
1. Ticket holder clicks "Enter Lounge" on an Eventyay event page.
2. The `eventyay-loungemesh` plugin issues an opaque token (2-hour TTL) and redirects to `/join/<roomName>?token=<opaqueToken>&event=<slug>&room=<slug>`.
3. `useAccessGuard` calls `POST /api/v1/loungemesh/token/` with the opaque token.
4. Eventyay returns a signed Jitsi JWT and user capability grants (`moderate`, `notes`, `whiteboard`, `poll_manage`).
5. JWT is stored in `sessionStorage` and user is routed to `/session/<roomName>`.
6. If the token is invalid or expired, the user is presented with the access denied state directly on the join page.

### Room PIN Security Flow
1. If the host configured a **Join PIN** in room settings:
2. Entering participants receive a PIN prompt modal before WebRTC tracks are published.
3. The server validates the PIN without exposing it in public room config payloads.
4. Correct PIN entry unlocks media connection; incorrect attempts display immediate error feedback.

### Lobby & Waiting Room Flow
1. Lobby is on by default. The host is the account whose email owns the meeting. Invited emails enter directly. Everyone else, including a signed-in account that was not invited, waits.
2. The waiting screen asks for a name. Email is optional. It does not show the meeting, and it does not play anyone's audio or video.
3. The host sees who is asking to join and can admit or deny them. Cancel, or leaving the page, removes that person from the host's list. A deny can only come from the host or a moderator.
4. On approval, the guest is transitioned onto the live lounge.

### Host Key Claim Flow
1. In un-moderated rooms without an Eventyay token, any user possessing the secret host key can claim host ownership.
2. The user opens the Moderator panel and inputs the host key.
3. `sessionFeaturesStore` verifies credentials, updates `isVerifiedHost = true`, and unlocks room management controls.

---

## 2. Media Devices & Audio Setup Flows

### Permission & Device Negotiation
1. Upon joining, `JitsiAdapter` requests mic and camera permissions.
2. If denied, media tracks are disabled gracefully and visual warnings are shown without crashing the room.
3. Users can open the **Device Settings Modal** at any time to select specific microphone, camera, or speaker output devices.

### Speaking Level & Audio Indicator
- The audio engine measures input speaking volume using `Web Audio API` analysers.
- A glowing speaking ring illuminates around the avatar circle whenever the user speaks, providing immediate visual feedback across the room.

---

## 3. Spatial Navigation & Proximity Audio Flow

### 2D Floorplan Navigation
- **Avatar Movement**: Move your avatar by dragging with the mouse/touchscreen or using keyboard arrow keys (`ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, `W`, `A`, `S`, `D`).
- **Canvas Panning & Zooming**: Click and drag the canvas background to pan across large floorplans; use the mouse wheel or pinch-to-zoom to adjust zoom scale.

### Proximity Audio Attenuation
- Avatars nearby hear each other at full volume (0 dB).
- As avatars move further apart, volume attenuates exponentially according to inverse-distance curves calculated off-thread in `src-vue/workers/proximityAudio.worker.ts`.
- Far-away clusters hear only ambient whispers or complete silence, allowing multiple conversations to occur simultaneously in a single virtual room.

---

## 4. Stage Presentation & Screensharing Flow

### Requesting & Stepping on Stage
1. Any participant can request stage access or be invited by the host.
2. When on stage, `isOnStage` becomes active:
   - Avatar is highlighted with a gold stage badge.
   - Video track subscription constraint escalates from 360p to **720p** (`STAGE_MAX_HEIGHT = 720`).
   - The stage occupant's audio broadcasts room-wide without distance attenuation.

### High-Definition Screensharing
1. The presenter clicks the **Screenshare Button**.
2. Browser prompt allows selecting entire screen, application window, or browser tab.
3. Stream is captured at **720p @ 15–30 fps** with optional system audio sharing.
4. Screenshare renders in a dedicated high-visibility viewport for all participants.

---

## 5. In-Room Collaborative Tools Flow

### Collaborative Whiteboard
1. Click the **Whiteboard Icon** in the sidebar.
2. Select pen, line, rectangle, circle, or eraser tools.
3. Pick stroke colors and stroke widths from the palette.
4. Strokes are sent as live JSON messages and shown on the other participant's canvas. The API keeps a durable copy in Redis.
5. Hosts can clear the whiteboard for everyone; participants can export drawings as PNG.

### Shared Collaborative Notes
1. Open the **Notes Panel**.
2. Type live notes with markdown formatting support.
3. Edits sync live to everyone who can open notes. The API keeps a durable copy for the next join.
4. Hosts can load pre-configured meeting agendas or templates (`notesTemplate`).
5. Notes can be downloaded as `.md` files at any time.

### Live Polling & Voting
1. Hosts/moderators click **Create Poll** and specify a question with multiple options.
2. A notification alerts all participants, opening the poll panel.
3. Participants cast anonymous votes.
4. Real-time tally updates live; hosts can reveal or close the poll.

---

## 6. Room Administration & Moderation Flow

### Host Room Settings
Hosts can open the **Room Settings Modal** to configure:
- Feature toggles: enable/disable Chat, Whiteboard, Notes, Polls, or Stage.
- Default permissions for everyone. Notes, whiteboard, and polls stay off for attendees until the host turns them on. An empty per-user grant does not override that room default.
- Lobby is on by default. The host is the meeting owner's email. Other people enter only when their email is invited, or after the host admits them from the lobby.
- Lobby enable/disable.
- Stage promotion permissions.
- Notes template default text.
- Custom floorplan background wallpaper (image upload or URL).

### Moderation Actions
- **Mute User**: Mute disruptive participants remotely.
- **Kick User**: Eject a participant from the room; the kicked user is routed to `/kicked`.

---

## 7. Meeting Scheduling & Calendar Flow

1. From the home screen, click **Schedule Meeting**.
2. Input meeting title, description, date/time, and recurrence rules (Daily, Weekly, Monthly).
3. Add participant email addresses for automatic calendar invites.
4. If connected to Google Calendar, the meeting synchronizes two-way with AES-256 encrypted OAuth credentials.

---

## 8. Resilience & Reconnection Flow

### Network Drop Recovery
- If the WebRTC peer connection drops, `useMediaEngine` initiates an exponential backoff reconnection cycle.
- On JVB bridge failover, the conference rejoins without losing the user's avatar coordinates on the 2D floorplan.

### Token Expiry Auto-Renewal
- When a ticketed JWT expires (`AUTHENTICATION_REQUIRED`), `JitsiAdapter` triggers the token refresh hook, obtaining a renewed JWT from Eventyay without requiring a full browser reload.
