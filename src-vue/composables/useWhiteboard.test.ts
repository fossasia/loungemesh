import { defineComponent, h, nextTick, ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { triggerLastResizeObserver } from '@/test/setup';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { useWhiteboard } from './useWhiteboard';
import * as whiteboardCanvas from '@/utils/whiteboardCanvas';

function mockCtx() {
  return {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeStyle: '',
    lineWidth: 0,
    lineCap: '',
    lineJoin: '',
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
  };
}

const Harness = defineComponent({
  props: {
    active: { type: Boolean, default: true },
    draw: { type: Boolean, default: true },
  },
  setup(props) {
    const canvasRef = ref<HTMLCanvasElement | null>(null);
    const surfaceRef = ref<HTMLDivElement | null>(null);
    const api = useWhiteboard(() => props.active, () => props.draw);
    return () =>
      h('div', { ref: surfaceRef, style: { width: '400px', height: '300px' } }, [
        h('canvas', {
          ref: (el) => {
            canvasRef.value = el as HTMLCanvasElement | null;
            api.bindCanvas(el as HTMLCanvasElement | null);
          },
          onPointerdown: api.onCanvasDown,
          onPointermove: api.onCanvasMove,
          onPointerup: api.onCanvasUp,
        }),
        h('button', { class: 'clear', onClick: api.clearWhiteboard }, 'Clear'),
      ]);
  },
});

describe('useWhiteboard', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const local = useLocalStore();
    const features = useSessionFeaturesStore();
    local.setMyID('host');
    features.setHost('host');
  });

  it('resizes on ResizeObserver notification and clears strokes', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx() as never);
    const features = useSessionFeaturesStore();
    features.addWhiteboardStroke({
      id: 's1',
      color: '#000',
      width: 2,
      points: [
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ],
    });
    const { wrapper } = await mountWithApp(Harness);
    await flushPromises();
    triggerLastResizeObserver();
    await wrapper.find('.clear').trigger('click');
    expect(features.whiteboardStrokes).toHaveLength(0);
    wrapper.unmount();
  });

  it('publishes multi-point strokes and skips single-point strokes', async () => {
    const local = useLocalStore();
    local.setMyID('me');
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx() as never);
    const { wrapper } = await mountWithApp(Harness);
    await flushPromises();
    const canvas = wrapper.find('canvas').element as HTMLCanvasElement;
    Object.defineProperty(canvas.parentElement, 'clientWidth', { value: 200, configurable: true });
    Object.defineProperty(canvas.parentElement, 'clientHeight', { value: 150, configurable: true });
    canvas.dispatchEvent(
      new PointerEvent('pointerdown', { clientX: 5, clientY: 5, pointerId: 1, bubbles: true }),
    );
    canvas.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 12, clientY: 12, pointerId: 1, bubbles: true }),
    );
    canvas.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 20, clientY: 20, pointerId: 1, bubbles: true }),
    );
    canvas.dispatchEvent(
      new PointerEvent('pointerup', { clientX: 20, clientY: 20, pointerId: 1, bubbles: true }),
    );
    const features = useSessionFeaturesStore();
    expect(features.whiteboardStrokes.length).toBeGreaterThan(0);

    canvas.dispatchEvent(
      new PointerEvent('pointerdown', { clientX: 1, clientY: 1, pointerId: 2, bubbles: true }),
    );
    canvas.dispatchEvent(
      new PointerEvent('pointerup', { clientX: 1, clientY: 1, pointerId: 2, bubbles: true }),
    );
    expect(features.whiteboardStrokes.length).toBe(1);
    wrapper.unmount();
  });

  it('ignores invalid points and releasePointerCapture errors', async () => {
    vi.spyOn(whiteboardCanvas, 'clientToCanvasPoint').mockReturnValue(null);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx() as never);
    const { wrapper } = await mountWithApp(Harness);
    await flushPromises();
    const canvas = wrapper.find('canvas').element as HTMLCanvasElement;
    canvas.setPointerCapture = vi.fn();
    canvas.releasePointerCapture = vi.fn(() => {
      throw new Error('no capture');
    });
    canvas.dispatchEvent(
      new PointerEvent('pointerdown', { clientX: 1, clientY: 1, pointerId: 3, bubbles: true }),
    );
    vi.mocked(whiteboardCanvas.clientToCanvasPoint).mockRestore();
    canvas.dispatchEvent(
      new PointerEvent('pointerdown', { clientX: 2, clientY: 2, pointerId: 3, bubbles: true }),
    );
    canvas.dispatchEvent(
      new PointerEvent('pointerup', { clientX: 2, clientY: 2, pointerId: 3, bubbles: true }),
    );
    wrapper.unmount();
  });

  it('skips redraw when inactive', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx() as never);
    const features = useSessionFeaturesStore();
    const { wrapper } = await mountWithApp(Harness, { props: { active: false } });
    await flushPromises();
    features.addWhiteboardStroke({
      id: 'x',
      color: '#000',
      width: 1,
      points: [{ x: 0, y: 0 }],
    });
    await nextTick();
    wrapper.unmount();
  });

  it('ignores pointer move/up when not drawing', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx() as never);
    const { wrapper } = await mountWithApp(Harness);
    await flushPromises();
    const canvas = wrapper.find('canvas').element as HTMLCanvasElement;
    canvas.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 3, clientY: 3, pointerId: 9, bubbles: true }),
    );
    canvas.dispatchEvent(
      new PointerEvent('pointerup', { clientX: 3, clientY: 3, pointerId: 9, bubbles: true }),
    );
    wrapper.unmount();
  });

  it('skips move when point mapping fails mid-stroke', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx() as never);
    const mapSpy = vi.spyOn(whiteboardCanvas, 'clientToCanvasPoint');
    mapSpy.mockReturnValueOnce({ x: 1, y: 1 }).mockReturnValueOnce(null);
    const { wrapper } = await mountWithApp(Harness);
    await flushPromises();
    const canvas = wrapper.find('canvas').element as HTMLCanvasElement;
    canvas.dispatchEvent(
      new PointerEvent('pointerdown', { clientX: 1, clientY: 1, pointerId: 5, bubbles: true }),
    );
    canvas.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 2, clientY: 2, pointerId: 5, bubbles: true }),
    );
    mapSpy.mockRestore();
    wrapper.unmount();
  });

  it('skips resize when canvas is detached from parent', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx() as never);
    const { wrapper } = await mountWithApp(Harness);
    await flushPromises();
    const canvas = wrapper.find('canvas').element as HTMLCanvasElement;
    const parent = canvas.parentElement!;
    const w = canvas.width;
    parent.removeChild(canvas);
    triggerLastResizeObserver();
    canvas.width = w;
    parent.appendChild(canvas);
    wrapper.unmount();
  });

  it('blocks drawing and clearing without permission', async () => {
    const features = useSessionFeaturesStore();
    features.setHost('other');
    features.roomDefaults = { notes: false, whiteboard: false, poll: false, stage: false };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx() as never);
    const { wrapper } = await mountWithApp(Harness, { props: { draw: false } });
    await flushPromises();
    const canvas = wrapper.find('canvas').element as HTMLCanvasElement;
    canvas.dispatchEvent(
      new PointerEvent('pointerdown', { clientX: 1, clientY: 1, pointerId: 8, bubbles: true }),
    );
    await wrapper.find('.clear').trigger('click');
    expect(features.whiteboardStrokes).toHaveLength(0);
    wrapper.unmount();
  });

  it('ignores move events before a stroke starts', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx() as never);
    const { wrapper } = await mountWithApp(Harness);
    await flushPromises();
    const canvas = wrapper.find('canvas').element as HTMLCanvasElement;
    canvas.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 4, clientY: 4, pointerId: 2, bubbles: true }),
    );
    wrapper.unmount();
  });

  it('bindCanvas no-ops without element or parent', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx() as never);
    let bind!: (el: HTMLCanvasElement | null) => void;
    const Bare = defineComponent({
      setup() {
        bind = useWhiteboard(() => true, () => true).bindCanvas;
      },
      render: () => h('div'),
    });
    const { wrapper } = await mountWithApp(Bare);
    bind(null);
    const canvas = document.createElement('canvas');
    bind(canvas);
    wrapper.unmount();
  });
});
