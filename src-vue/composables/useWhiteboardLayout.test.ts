import { describe, expect, it, vi } from 'vitest';
import { ref, defineComponent, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { triggerLastResizeObserver } from '@/test/setup';
import { useWhiteboardLayout } from './useWhiteboardLayout';

describe('useWhiteboardLayout', () => {
  it('sizes overlay from shell and scales on resize drag', async () => {
    const shell = document.createElement('div');
    Object.defineProperty(shell, 'clientWidth', { value: 1000, configurable: true });
    Object.defineProperty(shell, 'clientHeight', { value: 800, configurable: true });

    let layout!: ReturnType<typeof useWhiteboardLayout>;
    const Harness = defineComponent({
      setup() {
        layout = useWhiteboardLayout(ref(shell));
        return () => null;
      },
    });

    mount(Harness);
    await nextTick();

    expect(layout.overlayStyle.value).toEqual({
      position: 'absolute',
      width: '1000px',
      height: '800px',
      left: '0px',
      top: '0px',
    });
    expect(layout.canDrag.value).toBe(false);

    const handle = document.createElement('div');
    handle.setPointerCapture = vi.fn();
    handle.releasePointerCapture = vi.fn();

    const down = new PointerEvent('pointerdown', { button: 0, clientX: 200, clientY: 160 });
    Object.defineProperty(down, 'currentTarget', { value: handle });
    layout.onResizeDown(down);
    layout.onResizeMove(new PointerEvent('pointermove', { clientX: 0, clientY: 0 }));
    layout.onResizeUp(new PointerEvent('pointerup', { pointerId: 1 }));

    expect(layout.scale.value).toBeCloseTo(0.8);
    expect(layout.canDrag.value).toBe(true);
    expect(layout.overlayStyle.value).toEqual({
      position: 'absolute',
      width: '800px',
      height: '640px',
      left: '100px',
      top: '80px',
    });
  });

  it('drags the panel by the title bar when scaled down', async () => {
    const shell = document.createElement('div');
    Object.defineProperty(shell, 'clientWidth', { value: 1000, configurable: true });
    Object.defineProperty(shell, 'clientHeight', { value: 800, configurable: true });

    let layout!: ReturnType<typeof useWhiteboardLayout>;
    const Harness = defineComponent({
      setup() {
        layout = useWhiteboardLayout(ref(shell));
        return () => null;
      },
    });

    mount(Harness);
    await nextTick();

    layout.scale.value = 0.8;
    await nextTick();

    const chrome = document.createElement('div');
    chrome.setPointerCapture = vi.fn();
    chrome.releasePointerCapture = vi.fn();

    const down = new PointerEvent('pointerdown', { button: 0, clientX: 0, clientY: 0 });
    Object.defineProperty(down, 'currentTarget', { value: chrome });
    layout.onDragDown(down);
    layout.onDragMove(new PointerEvent('pointermove', { clientX: 80, clientY: -40 }));
    layout.onDragCancel(new PointerEvent('pointercancel', { pointerId: 2 }));

    expect(layout.offset.value).toEqual({ x: 80, y: -40 });
    expect(layout.overlayStyle.value.left).toBe('180px');
    expect(layout.overlayStyle.value.top).toBe('40px');
  });

  it('ignores drag and resize guards', async () => {
    const shell = document.createElement('div');
    Object.defineProperty(shell, 'clientWidth', { value: 400, configurable: true });
    Object.defineProperty(shell, 'clientHeight', { value: 300, configurable: true });

    let layout!: ReturnType<typeof useWhiteboardLayout>;
    const Harness = defineComponent({
      setup() {
        layout = useWhiteboardLayout(ref(shell));
        return () => null;
      },
    });

    mount(Harness);
    await nextTick();
    layout.scale.value = 0.8;

    const chrome = document.createElement('div');
    const button = document.createElement('button');
    chrome.appendChild(button);
    chrome.setPointerCapture = vi.fn();
    const dragDown = new PointerEvent('pointerdown', { button: 0, bubbles: true });
    Object.defineProperty(dragDown, 'target', { value: button });
    Object.defineProperty(dragDown, 'currentTarget', { value: chrome });
    layout.onDragDown(dragDown);
    layout.onDragDown(new PointerEvent('pointerdown', { button: 2 }));
    layout.onDragMove(new PointerEvent('pointermove', { clientX: 10, clientY: 10 }));

    layout.onResizeMove(new PointerEvent('pointermove', { clientX: 5, clientY: 5 }));
    layout.onResizeDown(new PointerEvent('pointerdown', { button: 2 }));
    layout.onResizeUp(new PointerEvent('pointerup', { pointerId: 1 }));

    const handle = document.createElement('div');
    handle.setPointerCapture = vi.fn();
    handle.releasePointerCapture = vi.fn(() => {
      throw new Error('no capture');
    });
    const resizeDown = new PointerEvent('pointerdown', { button: 0, clientX: 0, clientY: 0 });
    Object.defineProperty(resizeDown, 'currentTarget', { value: handle });
    layout.onResizeDown(resizeDown);
    layout.onResizeUp(new PointerEvent('pointerup', { pointerId: 3 }));
  });

  it('remeasures when the shell resizes', async () => {
    const shell = document.createElement('div');
    Object.defineProperty(shell, 'clientWidth', { value: 500, configurable: true });
    Object.defineProperty(shell, 'clientHeight', { value: 400, configurable: true });

    let layout!: ReturnType<typeof useWhiteboardLayout>;
    const Harness = defineComponent({
      setup() {
        layout = useWhiteboardLayout(ref(shell));
        return () => null;
      },
    });

    mount(Harness);
    await nextTick();
    Object.defineProperty(shell, 'clientWidth', { value: 600, configurable: true });
    triggerLastResizeObserver();
    await nextTick();
    expect(layout.overlayStyle.value.width).toBe('600px');
  });

  it('mounts without a shell element', async () => {
    let layout!: ReturnType<typeof useWhiteboardLayout>;
    const Harness = defineComponent({
      setup() {
        layout = useWhiteboardLayout(ref<HTMLElement | null>(null));
        return () => null;
      },
    });
    const mounted = mount(Harness);
    await nextTick();
    expect(layout.overlayStyle.value).toEqual({});
    mounted.unmount();
  });
});
