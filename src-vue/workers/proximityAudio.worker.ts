import type { Vector2 } from '@/utils/vector';
import { computeProximityVolumes } from '@/utils/proximityVolumes';

export type ProximityWorkerIn = {
  myPos: Vector2;
  users: Array<{ id: string; pos: Vector2 }>;
};

export type ProximityWorkerOut = {
  volumes: Array<{ id: string; volume: number }>;
};

export function handleProximityMessage(data: ProximityWorkerIn): ProximityWorkerOut {
  return { volumes: computeProximityVolumes(data.myPos, data.users) };
}

export function onWorkerMessage(e: MessageEvent<ProximityWorkerIn>): ProximityWorkerOut {
  return handleProximityMessage(e.data);
}

self.onmessage = (e: MessageEvent<ProximityWorkerIn>) => {
  self.postMessage(onWorkerMessage(e));
};
