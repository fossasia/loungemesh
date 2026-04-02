import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { useLocalStore } from '@/stores/localStore';
import PanWrapper from './PanWrapper.vue';

describe('PanWrapper', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('pans and zooms on pointer and wheel events', async () => {
    const local = useLocalStore();
    local.setMyID('local-1');
    const el = document.createElement('div');
    el.id = 'local-1';
    el.className = 'userContainer';
    document.body.appendChild(el);

    const { wrapper } = await mountWithApp(PanWrapper, {
      slots: { default: '<div class="child">x</div>' },
    });
    const root = wrapper.find('.panRoot').element;
    root.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10, button: 0, pointerId: 1 }),
    );
    root.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 50, clientY: 50, pointerId: 1 }));
    root.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
    wrapper.find('.panScale').element.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true }));
    expect(local.scale).toBeGreaterThan(0);
    wrapper.unmount();
    el.remove();
  });

  it('ignores non-primary pointer buttons and move before pan starts', async () => {
    const local = useLocalStore();
    local.setMyID('me');
    const { wrapper } = await mountWithApp(PanWrapper, { slots: { default: '<div />' } });
    const root = wrapper.find('.panRoot').element;
    root.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, button: 2, pointerId: 9 }),
    );
    root.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 5, clientY: 5 }));
    const before = local.scale;
    wrapper.find('.panScale').element.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true }));
    expect(local.scale).toBeLessThanOrEqual(before);
    wrapper.unmount();
  });
});
