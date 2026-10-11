import type { JitsiTrack, ReceiverConstraints } from '@/types/jitsi';
import { conferenceOptions } from '@/config/jitsiOptions';

/** Remote camera tile. */
const TILE_MAX_HEIGHT = 360;
/** Remote camera promoted to the stage. */
const STAGE_MAX_HEIGHT = 720;
/**
 * Remote screen share. Shares carry text, so they need far more detail than a
 * face does — at 360 a shared IDE or slide deck is unreadable.
 */
const SCREENSHARE_MAX_HEIGHT = 1080;

/**
 * Jitsi runs in multi-stream mode (`sourceNameSignaling` + `receiveMultipleVideoStreams`),
 * so one endpoint can publish several video sources. lib-jitsi-meet names them
 * `<endpointId>-v<n>`: the camera is `-v0` and a screen share is `-v1`.
 *
 * Prefer the name the track reports over the convention — the numbering is an
 * implementation detail of lib-jitsi-meet and only holds while an endpoint
 * publishes its sources in the expected order.
 */
function sourceNameFor(endpointId: string, index: number, track?: JitsiTrack): string {
  return track?.getSourceName?.() || `${endpointId}-v${index}`;
}

/**
 * Build Jitsi receiver constraints so remote video is actually forwarded.
 *
 * The bridge only sends a source if the receiver asks for it by name, so any
 * source missing from `constraints` falls back to `defaultConstraints` and any
 * source beyond `lastN` is suspended outright.
 */
export function buildReceiverConstraints(opts: {
  localId: string;
  remoteUserIds: string[];
  visibleUserIds: string[];
  stageIds: string[];
  /** Remote desktop tracks by endpoint id, so shares can be requested by real source name. */
  screenshareTracks?: Record<string, JitsiTrack | undefined>;
}): ReceiverConstraints | null {
  const remoteUserIds = opts.remoteUserIds.filter((id) => id && id !== opts.localId);
  if (!remoteUserIds.length) return null;

  const visible = [...new Set(opts.visibleUserIds)];
  const stage = [...new Set(opts.stageIds)];
  let selectedEndpoints = [...new Set([...visible, ...stage])];

  if (!selectedEndpoints.length) {
    selectedEndpoints = [...remoteUserIds];
  } else {
    selectedEndpoints = [...new Set([...selectedEndpoints, ...remoteUserIds])];
  }

  const cameraSources = selectedEndpoints.map((id) => sourceNameFor(id, 0));

  // A screen share is requested for every remote endpoint that has one, whether
  // or not their avatar happens to be in the viewport: people look at the share,
  // not at the person sharing.
  const shares = opts.screenshareTracks ?? {};
  const screenshareSources = remoteUserIds
    .filter((id) => shares[id])
    .map((id) => sourceNameFor(id, 1, shares[id]));

  const selectedSources = [...new Set([...cameraSources, ...screenshareSources])];

  const channelLastN =
    typeof conferenceOptions.channelLastN === 'number' && conferenceOptions.channelLastN > 0
      ? conferenceOptions.channelLastN
      : 20;

  // lastN counts sources, not endpoints. Budget cameras against channelLastN and
  // add shares on top, otherwise starting a share pushes a camera over the limit
  // and the bridge silently drops one of them.
  const cameraBudget = Math.min(cameraSources.length, channelLastN);
  const lastN = Math.max(1, cameraBudget + screenshareSources.length);

  const onStageSources = [
    ...new Set([...stage.map((id) => sourceNameFor(id, 0)), ...screenshareSources]),
  ];

  // Per-source constraints are what actually make modern JVB forward a source.
  // Relying on `lastN` + `selectedSources` alone leaves the `constraints` map
  // empty, which is why remote tiles can stay black or only update after a
  // refresh. Request every selected source explicitly.
  const constraints: Record<string, { maxHeight: number }> = {};
  for (const source of cameraSources) {
    constraints[source] = { maxHeight: TILE_MAX_HEIGHT };
  }
  for (const source of stage.map((id) => sourceNameFor(id, 0))) {
    constraints[source] = { maxHeight: STAGE_MAX_HEIGHT };
  }
  for (const source of screenshareSources) {
    constraints[source] = { maxHeight: SCREENSHARE_MAX_HEIGHT };
  }

  // NOTE: no colibriClass here — lib-jitsi-meet wraps this object as a
  // ReceiverVideoConstraints message itself. Setting colibriClass would override
  // its value and JVB stable-10888+ would reject the message.
  return {
    selectedSources,
    lastN,
    // JVB stable-10888+ renamed this field and expects source IDs ({endpointId}-v0).
    onStageSources,
    defaultConstraints: { maxHeight: TILE_MAX_HEIGHT },
    constraints,
  };
}
