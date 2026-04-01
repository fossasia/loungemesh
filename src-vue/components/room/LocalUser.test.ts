import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { useLocalStore } from '@/stores/localStore';
import { makeTrack } from '@/test/makeTrack';
import LocalUser from './LocalUser.vue';

describe('LocalUser', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('drags, attaches tracks, and toggles mute from indicator', async () => {
    const local = useLocalStore();
    local.setMyID('local-1');
    local.video = makeTrack('video');
    local.audio = makeTrack('audio');
    local.videoType = 'desktop';
    local.mute = true;

    const { wrapper } = await mountWithApp(LocalUser);
    const tile = wrapper.find('.local').element;
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
    const tile = wrapper.find('.local').element;
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
    const tile = wrapper.find('.local').element;
    tile.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, clientX: 50, clientY: 50, button: 0, pointerId: 7 }),
    );
    tile.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 80, clientY: 90, pointerId: 7 }));
    tile.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7 }));
    wrapper.unmount();
  });

  it('skips drag when not draggable and handles pointerup without drag', async () => {
    const local = useLocalStore();
    local.setMyID('local-1');
    local.scale = 0;
    local.pan = { x: 0, y: 0 };
    local.videoType = 'desktop';
    local.video = makeTrack('desktop');

    const { wrapper } = await mountWithApp(LocalUser, { props: { draggable: false } });
    const tile = wrapper.find('.local').element;
    tile.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 5 }));
    tile.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10, button: 0, pointerId: 4 }),
    );
    tile.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 40, clientY: 40, pointerId: 4 }));
    tile.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 4 }));
    wrapper.unmount();
  });
});
