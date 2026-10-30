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
2. New meetings use the open lobby form: a required name, with no email field and nothing prefilled. The host can choose the details form when creating the meeting or from in-call settings. That form requires a name and an email, and the message to the host stays optional.
3. While someone is waiting, their camera and microphone are not published. People already in the room do not see or hear them. The waiting screen does not play the meeting.
4. The host sees who is asking to join and can admit or deny them. Cancel, or leaving the page, removes that person from the host's list. A deny can only come from the host or a moderator. Admit, deny, and cancel update every client as the message arrives.

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
2. On a computer, the browser prompt allows selecting an entire screen, application window, or browser tab.
3. Stream is captured at **720p @ 15–30 fps** with optional system audio sharing. Phones use the system share sheet and the same 720p cap, without desktop-only source locks.
4. Screenshare renders in a dedicated viewport. On a phone it sits above the controls and stays visible even when avatars are far apart on the floor.

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
4. When the host or a moderator sets a notes template, it is written into the shared document and sent to every open editor. People who join later start from that template when the document is still empty.
5. Notes can be downloaded as `.md` files at any time.

### Live Polling & Voting
1. Hosts/moderators click **Create Poll** and specify a question with multiple options.
2. A notification alerts all participants, opening the poll panel.
3. Participants cast anonymous votes.
4. Real-time tally updates live. The host or a moderator starts and ends the poll. Attendees vote when polls are enabled for them. A control that role cannot use is left off the screen.

---

## 6. Room Administration & Moderation Flow

### Host Room Settings
Hosts can open the **Room Settings Modal** to configure:
- Feature toggles: enable/disable Chat, Whiteboard, Notes, Polls, or Stage. A feature that is on can be used by every attendee. An explicit revoke for one person is the only way to turn it off for them.
- Per-person revoke and restore. Moderators get the same per-person controls, not the room-wide switches. They also cannot assign another moderator. The change appears on that person's screen as soon as the command arrives, and the host repeats current grants on the session heartbeat.
- Lobby is on by default. The host is the meeting owner's email. Other people enter only when their email is invited, or after the host admits them from the lobby.
- Lobby form: name only, or name and email.
- Stage promotion permissions.
- Notes template. The host or a moderator can save it, and that updates the shared document for everyone still in the room.
- Custom floorplan background. The host or a moderator can save or clear it. Everyone reloads the image, and that reload is repeated on the session heartbeat.

### Moderation Actions
- **Mute User**: Mute disruptive participants remotely.
- **Kick User**: Eject a participant from the room; the kicked user is routed to `/kicked`. Kicked, access denied, missing routes, the PIN prompt, and the public meeting states use the same light LoungeMesh page and card.

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
