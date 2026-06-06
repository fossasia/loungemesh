import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { useLocalStore } from '@/stores/localStore';
import PanWrapper from './PanWrapper.vue';

describe('PanWrapper', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('renders a viewport background layer when wallpaper is set', async () => {
    const { useSessionFeaturesStore } = await import('@/stores/sessionFeaturesStore');
    useSessionFeaturesStore().gridBackgroundUrl = 'data:image/jpeg;base64,wall';
    const { wrapper } = await mountWithApp(PanWrapper, { slots: { default: '<div />' } });
    expect(wrapper.find('.viewportBackground').exists()).toBe(true);
    wrapper.unmount();
  });

  it('handles pointercancel on pan root', async () => {
    const { wrapper } = await mountWithApp(PanWrapper, { slots: { default: '<div />' } });
    await wrapper.find('.panRoot').trigger('pointercancel');
    wrapper.unmount();
  });

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

  it('does not pan when pointer starts on zoom controls', async () => {
    const local = useLocalStore();
    const startPan = { ...local.pan };
    const { wrapper } = await mountWithApp(PanWrapper, { slots: { default: '<div />' } });
    const zoomBtn = wrapper.find('[aria-label="Zoom in"]');
    zoomBtn.element.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, clientX: 0, clientY: 0, button: 0, pointerId: 2 }),
    );
    expect(local.pan).toEqual(startPan);
    wrapper.unmount();
  });

  it('ignores wheel on zoom controls', async () => {
    const local = useLocalStore();
    const before = local.scale;
    const { wrapper } = await mountWithApp(PanWrapper, { slots: { default: '<div />' } });
    const root = wrapper.find('.panRoot').element;
    const zoomBtn = wrapper.find('[aria-label="Zoom in"]').element;
    const onZoom = new WheelEvent('wheel', { deltaY: -500, bubbles: true });
    Object.defineProperty(onZoom, 'target', { value: zoomBtn, configurable: true });
    root.dispatchEvent(onZoom);
    expect(local.scale).toBe(before);
    wrapper.unmount();
  });

  it('zooms when wheel target is not an HTMLElement', async () => {
    const local = useLocalStore();
    const before = local.scale;
    const { wrapper } = await mountWithApp(PanWrapper, { slots: { default: '<div />' } });
    const root = wrapper.find('.panRoot').element;
    const onText = new WheelEvent('wheel', { deltaY: -500, bubbles: true });
    Object.defineProperty(onText, 'target', { value: document.createTextNode('t'), configurable: true });
    root.dispatchEvent(onText);
    expect(local.scale).not.toBe(before);
    wrapper.unmount();
  });

  it('stops panning on pointercancel', async () => {
    const local = useLocalStore();
    const { wrapper } = await mountWithApp(PanWrapper, { slots: { default: '<div />' } });
    const root = wrapper.find('.panRoot').element;
    const startPan = { ...local.pan };
    root.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, clientX: 0, clientY: 0, button: 0, pointerId: 3 }),
    );
    root.dispatchEvent(
      new PointerEvent('pointermove', { bubbles: true, clientX: 40, clientY: 40, pointerId: 3 }),
    );
    expect(local.pan).not.toEqual(startPan);
    root.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 3 }));
    const afterCancel = { ...local.pan };
    root.dispatchEvent(
      new PointerEvent('pointermove', { bubbles: true, clientX: 80, clientY: 80, pointerId: 3 }),
    );
    expect(local.pan).toEqual(afterCancel);
    wrapper.unmount();
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
