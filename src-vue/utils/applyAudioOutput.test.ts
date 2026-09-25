import { describe, expect, it, vi } from 'vitest';
import { applyAudioOutput, mediaElementsWithSink } from './applyAudioOutput';

describe('applyAudioOutput', () => {
  it('applies setSinkId to audio and video elements', async () => {
    const ok = document.createElement('audio') as HTMLAudioElement & {
      setSinkId: (id: string) => Promise<void>;
    };
    ok.setSinkId = vi.fn().mockResolvedValue(undefined);
    const fail = document.createElement('video') as HTMLVideoElement & {
      setSinkId: (id: string) => Promise<void>;
    };
    fail.setSinkId = vi.fn().mockRejectedValue(new Error('bad'));
    const nosink = document.createElement('audio');
    const root = document.createElement('div');
    root.append(ok, fail, nosink);
    expect(mediaElementsWithSink(root)).toHaveLength(2);
    expect(await applyAudioOutput('spk-1', [ok, fail])).toBe(1);
    expect(ok.setSinkId).toHaveBeenCalledWith('spk-1');
    expect(await applyAudioOutput('')).toBe(0);
  });

  it('uses document media elements by default', async () => {
    const el = document.createElement('audio') as HTMLAudioElement & {
      setSinkId: (id: string) => Promise<void>;
    };
    el.setSinkId = vi.fn().mockResolvedValue(undefined);
    document.body.append(el);
    expect(await applyAudioOutput('spk-2')).toBe(1);
    expect(el.setSinkId).toHaveBeenCalledWith('spk-2');
    el.remove();
  });
});
