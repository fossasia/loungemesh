import type { ReceiverConstraints } from '@/types/jitsi';
import { conferenceOptions } from '@/config/jitsiOptions';

/** Build Jitsi receiver constraints so remote camera tracks are actually forwarded. */
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
  // Camera is `-v0`. A second video (screenshare) is `-v1`, and a share started
  // with the camera off can itself be `-v0`. Request both so neither feed is dropped.
  const selectedSources = selectedEndpoints.flatMap((id) => [`${id}-v0`, `${id}-v1`]);

  const channelLastN =
    typeof conferenceOptions.channelLastN === 'number' && conferenceOptions.channelLastN > 0
      ? conferenceOptions.channelLastN
      : 20;
  // Two sources per endpoint (camera + screenshare) must both fit under lastN.
  const lastN = Math.min(selectedSources.length, channelLastN * 2);

  const onStageSources = stage.flatMap((id) => [`${id}-v0`, `${id}-v1`]);

  // Per-source constraints are what actually make modern JVB forward a source.
  // Relying on `lastN` + `selectedSources` alone leaves the `constraints` map
  // empty, which is why remote tiles can stay black or only update after a
  // refresh. Request every selected source explicitly (on-stage and screenshare
  // at a higher resolution) so the bridge forwards them as soon as they exist.
  const TILE_MAX_HEIGHT = 360;
  const STAGE_MAX_HEIGHT = 720;
  const constraints: Record<string, { maxHeight: number }> = {};
  for (const id of selectedEndpoints) {
    const onStage = stage.includes(id);
    constraints[`${id}-v0`] = { maxHeight: onStage ? STAGE_MAX_HEIGHT : TILE_MAX_HEIGHT };
    constraints[`${id}-v1`] = { maxHeight: STAGE_MAX_HEIGHT };
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
