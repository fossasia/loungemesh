import { describe, it, expect, vi, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountWithApp } from '@/test/mountApp';
import { makeTrack } from '@/test/makeTrack';
import StageAudioAttach from './StageAudioAttach.vue';

describe('StageAudioAttach', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('wires gain and tears down on unmount', async () => {
    const resume = vi.fn().mockResolvedValue(undefined);
    class MockAudioContext {
      state = 'suspended';
      currentTime = 0;
      destination = {};
      resume = resume;
      close = vi.fn();
      createMediaStreamSource = vi.fn(() => ({ connect: vi.fn() }));
      createGain = vi.fn(() => ({
        connect: vi.fn(),
        gain: { value: 1, setTargetAtTime: vi.fn() },
      }));
    }
    vi.stubGlobal('AudioContext', MockAudioContext);

    const track = makeTrack('audio');
    const { wrapper } = await mountWithApp(StageAudioAttach, { props: { track, volume: 0.5 } });
    await wrapper.setProps({ volume: 1.2 });
    await wrapper.setProps({ track: undefined });
    await flushPromises();
    wrapper.unmount();
    expect(resume).toHaveBeenCalled();
  });

  it('mounts without a track stream', async () => {
    const { wrapper } = await mountWithApp(StageAudioAttach, { props: { volume: 1 } });
    wrapper.unmount();
  });

  it('reuses audio context across track updates', async () => {
    const created: unknown[] = [];
    class MockAudioContext {
      state = 'running';
      currentTime = 0;
      destination = {};
      resume = vi.fn();
      close = vi.fn();
      createMediaStreamSource = vi.fn(() => ({ connect: vi.fn() }));
      createGain = vi.fn(() => ({
        connect: vi.fn(),
        gain: { value: 1, setTargetAtTime: vi.fn() },
      }));
      constructor() {
        created.push(this);
      }
    }
    vi.stubGlobal('AudioContext', MockAudioContext);

    const track = makeTrack('audio');
    const { wrapper } = await mountWithApp(StageAudioAttach, { props: { track, volume: 0.5 } });
    await wrapper.setProps({ track: makeTrack('audio') });
    expect(created).toHaveLength(1);
    wrapper.unmount();
  });

  it('skips gain update when nodes are missing', async () => {
    const { wrapper } = await mountWithApp(StageAudioAttach, { props: { volume: 0.5 } });
    await wrapper.setProps({ volume: 0.9 });
    wrapper.unmount();
  });
});
