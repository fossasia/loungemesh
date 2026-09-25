type Sinkable = HTMLMediaElement & { setSinkId?: (id: string) => Promise<void> };

export function mediaElementsWithSink(
  root: ParentNode = document,
): Sinkable[] {
  return [...root.querySelectorAll<Sinkable>('audio, video')].filter(
    (el) => typeof el.setSinkId === 'function',
  );
}

export async function applyAudioOutput(
  deviceId: string,
  elements: Sinkable[] = mediaElementsWithSink(),
): Promise<number> {
  if (!deviceId) return 0;
  let applied = 0;
  for (const el of elements) {
    try {
      await el.setSinkId!(deviceId);
      applied += 1;
    } catch {
      /* unsupported / invalid device */
    }
  }
  return applied;
}
