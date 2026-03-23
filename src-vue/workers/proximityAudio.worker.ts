import { getVolumeByDistance, type Vector2 } from '@/utils/vector';

export type ProximityWorkerIn = {
  myPos: Vector2;
  users: Array<{ id: string; pos: Vector2 }>;
};

export type ProximityWorkerOut = {
  volumes: Array<{ id: string; volume: number }>;
};

self.onmessage = (e: MessageEvent<ProximityWorkerIn>) => {
  const { myPos, users } = e.data;
  const volumes = users.map(({ id, pos }) => ({
    id,
    volume: getVolumeByDistance(myPos, pos),
  }));
  self.postMessage({ volumes } satisfies ProximityWorkerOut);
};
