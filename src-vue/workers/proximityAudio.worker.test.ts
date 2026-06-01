import { describe, expect, it, vi } from 'vitest';
import { handleProximityMessage, onWorkerMessage } from './proximityAudio.worker';

describe('proximityAudio.worker', () => {
  it('handleProximityMessage returns volumes', () => {
    const result = handleProximityMessage({
      myPos: { x: 0, y: 0 },
      users: [{ id: 'u1', pos: { x: 0, y: 0 } }],
    });
    expect(result.volumes[0]?.volume).toBe(1);
  });

  it('onWorkerMessage wraps handleProximityMessage', () => {
    const result = onWorkerMessage({
      data: { myPos: { x: 1, y: 1 }, users: [{ id: 'u2', pos: { x: 2, y: 2 } }] },
    } as MessageEvent);
    expect(result.volumes.length).toBeGreaterThan(0);
  });

  it('registers self.onmessage handler', async () => {
    await import('./proximityAudio.worker');
    const handler = (self as unknown as { onmessage?: (e: MessageEvent) => void }).onmessage;
    expect(handler).toBeTypeOf('function');
    const posted: unknown[] = [];
    vi.spyOn(self, 'postMessage').mockImplementation((msg) => posted.push(msg));
    handler?.({
      data: { myPos: { x: 0, y: 0 }, users: [] },
    } as MessageEvent);
    expect(posted.length).toBe(1);
  });
});
