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

  const visible = [...new Set(opts.visibleUserIds)];
  const stage = [...new Set(opts.stageIds)];
  let selectedEndpoints = [...new Set([...visible, ...stage])];

  if (!selectedEndpoints.length) {
    selectedEndpoints = [...remoteUserIds];
  } else {
    selectedEndpoints = [...new Set([...selectedEndpoints, ...remoteUserIds])];
  }

  const channelLastN =
    typeof conferenceOptions.channelLastN === 'number' && conferenceOptions.channelLastN > 0
      ? conferenceOptions.channelLastN
      : 20;
  const lastN = Math.max(1, Math.min(selectedEndpoints.length, channelLastN));

  return {
    colibriClass: 'SelectedEndpointsChangedEvent',
    selectedEndpoints,
    lastN,
    onStageEndpoints: stage,
    defaultConstraints: { maxHeight: 360 },
    constraints: {},
  };
}
