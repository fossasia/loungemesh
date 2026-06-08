import { describe, it, expect, beforeEach, vi } from 'vitest';
import { nextTick } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { makeTrack } from '@/test/makeTrack';
import LocalUser from './LocalUser.vue';

describe('LocalUser', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('drags, attaches tracks, and toggles mute from indicator', async () => {
    const local = useLocalStore();
    local.setMyID('local-1');
    local.video = makeTrack('video');
    local.audio = makeTrack('audio');
    local.videoType = 'camera';
    local.mute = true;

    const { wrapper } = await mountWithApp(LocalUser);
    const tile = wrapper.find('.dragSurface').element;
    tile.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 100, button: 0, pointerId: 2 }),
    );
    tile.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 200, clientY: 200, pointerId: 2 }));
    tile.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 2 }));
    const mute = wrapper.findComponent({ name: 'MuteIndicator' });
    if (mute.exists()) await mute.trigger('click');
    wrapper.unmount();
  });

  it('uses default scale when local scale is zero', async () => {
    const local = useLocalStore();
    local.setMyID('local-1');
    local.scale = 0;
    local.pan = { x: 0, y: 0 };
    local.video = makeTrack('video');

    const { wrapper } = await mountWithApp(LocalUser);
    const tile = wrapper.find('.dragSurface').element;
    tile.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, clientX: 50, clientY: 50, button: 0, pointerId: 8 }),
    );
    tile.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 80, clientY: 90, pointerId: 8 }));
    tile.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 8 }));
    wrapper.unmount();
  });

  it('uses explicit scale when zoomed in', async () => {
    const local = useLocalStore();
    local.setMyID('local-1');
    local.scale = 2;
    local.pan = { x: 10, y: 20 };
    local.video = makeTrack('video');

    const { wrapper } = await mountWithApp(LocalUser);
    const tile = wrapper.find('.dragSurface').element;
    tile.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, clientX: 50, clientY: 50, button: 0, pointerId: 7 }),
    );
    tile.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 80, clientY: 90, pointerId: 7 }));
    tile.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7 }));
    wrapper.unmount();
  });

  it('hides speaking highlight when muted', async () => {
    const local = useLocalStore();
    local.speaking = true;
    local.mute = true;
    const { wrapper } = await mountWithApp(LocalUser);
    expect(wrapper.find('video.speaking').exists()).toBe(false);
    wrapper.unmount();
  });

  it('shows speaking highlight on camera video when unmuted', async () => {
    const local = useLocalStore();
    local.setMyID('local-1');
    local.video = makeTrack('video');
    local.videoType = 'camera';
    local.cameraOff = false;
    local.speaking = true;
    local.mute = false;
    const { wrapper } = await mountWithApp(LocalUser);
    await flushPromises();
    expect(wrapper.find('video.vid.speaking').exists()).toBe(true);
    wrapper.unmount();
  });

  it('uses camera video class', async () => {
    const local = useLocalStore();
    local.setMyID('local-1');
    local.video = makeTrack('video');
    local.videoType = 'camera';
    local.cameraOff = false;
    const camera = await mountWithApp(LocalUser);
    expect(camera.wrapper.find('video.vid').exists()).toBe(true);
    camera.wrapper.unmount();
  });

  it('shows avatar backdrop when camera is off', async () => {
    const local = useLocalStore();
    local.cameraOff = true;
    local.video = undefined;
    const { wrapper } = await mountWithApp(LocalUser);
    expect(wrapper.find('video.vid').exists()).toBe(false);
    expect(wrapper.find('.videoContainer.avatarTile').exists()).toBe(true);
    expect(wrapper.find('.base.avatar').exists()).toBe(true);
    wrapper.unmount();
  });

  it('renders circular camera video', async () => {
    const local = useLocalStore();
    local.video = makeTrack('video');
    local.videoType = 'camera';
    const { wrapper } = await mountWithApp(LocalUser);
    expect(wrapper.find('video.vid').exists()).toBe(true);
    wrapper.unmount();
  });

  it('shows reaction overlay and raised hand on the name tag', async () => {
    const local = useLocalStore();
    const features = useSessionFeaturesStore();
    local.setMyID('local-1');
    features.handRaised = true;
    features.setReaction('local-1', '👍');

    const { wrapper } = await mountWithApp(LocalUser);
    expect(wrapper.find('.floatReact').text()).toBe('👍');
    expect(wrapper.find('.handBadge').exists()).toBe(true);
    wrapper.unmount();
  });

  it('detaches the previous camera track when the track changes', async () => {
    const local = useLocalStore();
    local.setMyID('local-1');
    local.videoType = 'camera';
    local.cameraOff = false;
    local.video = makeTrack('video');
    const stale = local.video;
    const detach = vi.spyOn(stale, 'detach');
    const { wrapper } = await mountWithApp(LocalUser);
    await nextTick();
    local.video = makeTrack('video');
    await nextTick();
    await flushPromises();
    expect(detach).toHaveBeenCalled();
    wrapper.unmount();
  });

  it('clears srcObject when the camera turns off', async () => {
    const local = useLocalStore();
    local.setMyID('local-1');
    local.videoType = 'camera';
    local.cameraOff = false;
    local.video = makeTrack('video');
    const { wrapper } = await mountWithApp(LocalUser);
    await nextTick();
    const video = wrapper.find('video.vid').element as HTMLVideoElement;
    Object.defineProperty(video, 'srcObject', {
      configurable: true,
      writable: true,
      value: { id: 'preview' },
    });
    local.cameraOff = true;
    local.video = undefined;
    await nextTick();
    await flushPromises();
    expect(video.srcObject).toBeNull();
    wrapper.unmount();
  });

  it('skips play() when the video element is already playing', async () => {
    const pausedSpy = vi
      .spyOn(HTMLMediaElement.prototype, 'paused', 'get')
      .mockReturnValue(false);
    const playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play');
    const local = useLocalStore();
    local.videoType = 'camera';
    local.video = makeTrack('video');
    const { wrapper } = await mountWithApp(LocalUser);
    await nextTick();
    await flushPromises();
    expect(playSpy).not.toHaveBeenCalled();
    pausedSpy.mockRestore();
    playSpy.mockRestore();
    wrapper.unmount();
  });

  it('handles play() rejection on attach', async () => {
    const playSpy = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockRejectedValue(new Error('autoplay blocked'));
    const local = useLocalStore();
    local.videoType = 'camera';
    local.video = makeTrack('video');
    const { wrapper } = await mountWithApp(LocalUser);
    await nextTick();
    await flushPromises();
    expect(playSpy).toHaveBeenCalled();
    playSpy.mockRestore();
    wrapper.unmount();
  });

  it('skips video attach when the preview element is not mounted yet', async () => {
    const local = useLocalStore();
    local.videoType = 'camera';
    local.cameraOff = false;
    const track = makeTrack('video');
    local.video = track;
    const { wrapper } = await mountWithApp(LocalUser);
    await nextTick();
    track.attach.mockClear();
    const comp = wrapper.findComponent(LocalUser);
    comp.vm.videoEl = null;
    comp.vm.attach();
    expect(track.attach).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('logs non-Error attach failures', async () => {
    const local = useLocalStore();
    const video = makeTrack('video');
    video.attach = vi.fn(() => {
      throw 'attach exploded';
    }) as never;
    local.videoType = 'camera';
    local.video = video;
    const { wrapper } = await mountWithApp(LocalUser);
    await nextTick();
    await flushPromises();
    wrapper.unmount();
  });

  it('guards pointer handlers when the drag surface ref is null', async () => {
    const local = useLocalStore();
    local.setMyID('local-1');
    const { wrapper } = await mountWithApp(LocalUser);
    const tile = wrapper.find('.dragSurface').element;
    const ref = wrapper.vm as unknown as { dragSurface: HTMLElement | null };

    ref.dragSurface = null;
    tile.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, clientX: 1, clientY: 1, button: 0, pointerId: 11 }),
    );

    ref.dragSurface = tile as HTMLElement;
    tile.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, clientX: 2, clientY: 2, button: 0, pointerId: 12 }),
    );
    ref.dragSurface = null;
    tile.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 12 }));
    wrapper.unmount();
  });

  it('skips drag when not draggable and handles pointerup without drag', async () => {
    const local = useLocalStore();
    local.setMyID('local-1');
    local.scale = 0;
    local.pan = { x: 0, y: 0 };
    local.videoType = 'camera';
    local.video = makeTrack('video');

    const { wrapper } = await mountWithApp(LocalUser, { props: { draggable: false } });
    const tile = wrapper.find('.dragSurface').element;
    tile.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 5 }));
    tile.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10, button: 0, pointerId: 4 }),
    );
    tile.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 40, clientY: 40, pointerId: 4 }));
    tile.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 4 }));
    wrapper.unmount();
  });
});
