import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import WhiteboardOverlay from './WhiteboardOverlay.vue';
import * as whiteboardCanvas from '@/utils/whiteboardCanvas';

describe('WhiteboardOverlay', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const local = useLocalStore();
    const features = useSessionFeaturesStore();
    local.setMyID('host');
    features.setHost('host');
  });

  function mockCanvas() {
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

  it('stops overlay pointer and wheel propagation', async () => {
    const features = useSessionFeaturesStore();
    features.panel = 'whiteboard';
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCanvas() as never);
    const { wrapper } = await mountWithApp(WhiteboardOverlay, {
      props: { onClose: () => {} },
    });
    await flushPromises();
    await wrapper.find('.wbOverlay').trigger('pointerdown');
    await wrapper.find('.wbOverlay').trigger('wheel');
    wrapper.unmount();
  });

  it('renders overlay and clears strokes', async () => {
    const features = useSessionFeaturesStore();
    features.panel = 'whiteboard';
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCanvas() as never);
    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');
    const onClose = vi.fn();
    const { wrapper } = await mountWithApp(WhiteboardOverlay, {
      props: { onClose },
    });
    await flushPromises();
    expect(wrapper.find('.wbOverlay').exists()).toBe(true);
    expect(wrapper.find('.wbCanvas').exists()).toBe(true);
    await wrapper.find('.wbClear').trigger('click');
    expect(cmdSpy).toHaveBeenCalledWith('wb', JSON.stringify({ action: 'clear' }));
    await wrapper.find('button.ibtn').trigger('click');
    expect(onClose).toHaveBeenCalled();
    wrapper.unmount();
  });

  it('draws and publishes strokes', async () => {
    const features = useSessionFeaturesStore();
    features.setRoomDefault('whiteboard', true);
    features.panel = 'whiteboard';
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCanvas() as never);
    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');
    const { wrapper } = await mountWithApp(WhiteboardOverlay, {
      props: { onClose: () => {} },
    });
    await flushPromises();
    const canvas = wrapper.find('.wbCanvas').element as HTMLCanvasElement;
    Object.defineProperty(canvas.parentElement, 'clientWidth', { value: 400, configurable: true });
    Object.defineProperty(canvas.parentElement, 'clientHeight', { value: 300, configurable: true });
    canvas.setPointerCapture = vi.fn();
    canvas.releasePointerCapture = vi.fn();
    canvas.dispatchEvent(
      new PointerEvent('pointerdown', { clientX: 10, clientY: 10, pointerId: 1, bubbles: true }),
    );
    canvas.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 30, clientY: 30, pointerId: 1, bubbles: true }),
    );
    canvas.dispatchEvent(
      new PointerEvent('pointerup', { clientX: 30, clientY: 30, pointerId: 1, bubbles: true }),
    );
    expect(cmdSpy).toHaveBeenCalledWith('wb', expect.stringContaining('stroke'));
    wrapper.unmount();
  });

  it('renders read-only canvas for guests without access', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('guest');
    features.setHost('host');
    features.roomDefaults = { notes: false, whiteboard: false, poll: false, stage: false };
    features.panel = 'whiteboard';
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCanvas() as never);
    const { wrapper } = await mountWithApp(WhiteboardOverlay, {
      props: { onClose: () => {} },
    });
    await flushPromises();
    expect(wrapper.find('.wbCanvas').classes()).toContain('readonly');
    expect(wrapper.find('.wbClear').exists()).toBe(false);
    wrapper.unmount();
  });

  it('continues stroke on pointermove', async () => {
    const features = useSessionFeaturesStore();
    features.panel = 'whiteboard';
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCanvas() as never);
    const { wrapper } = await mountWithApp(WhiteboardOverlay, {
      props: { onClose: () => {} },
    });
    await flushPromises();
    const canvas = wrapper.find('.wbCanvas').element as HTMLCanvasElement;
    canvas.setPointerCapture = vi.fn();
    canvas.dispatchEvent(
      new PointerEvent('pointerdown', { clientX: 8, clientY: 8, pointerId: 6, bubbles: true }),
    );
    canvas.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 16, clientY: 16, pointerId: 6, bubbles: true }),
    );
    wrapper.unmount();
  });

  it('ends stroke on pointercancel', async () => {
    const features = useSessionFeaturesStore();
    features.panel = 'whiteboard';
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCanvas() as never);
    const { wrapper } = await mountWithApp(WhiteboardOverlay, {
      props: { onClose: () => {} },
    });
    await flushPromises();
    const canvas = wrapper.find('.wbCanvas').element as HTMLCanvasElement;
    canvas.setPointerCapture = vi.fn();
    canvas.releasePointerCapture = vi.fn();
    canvas.dispatchEvent(
      new PointerEvent('pointerdown', { clientX: 5, clientY: 5, pointerId: 7, bubbles: true }),
    );
    canvas.dispatchEvent(
      new PointerEvent('pointercancel', { clientX: 5, clientY: 5, pointerId: 7, bubbles: true }),
    );
    wrapper.unmount();
  });

  it('ignores invalid pointer mapping', async () => {
    const features = useSessionFeaturesStore();
    features.panel = 'whiteboard';
    vi.spyOn(whiteboardCanvas, 'clientToCanvasPoint').mockReturnValue(null);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCanvas() as never);
    const { wrapper } = await mountWithApp(WhiteboardOverlay, {
      props: { onClose: () => {} },
    });
    await flushPromises();
    const canvas = wrapper.find('.wbCanvas').element as HTMLCanvasElement;
    canvas.dispatchEvent(
      new PointerEvent('pointerdown', { clientX: 1, clientY: 1, pointerId: 4, bubbles: true }),
    );
    vi.mocked(whiteboardCanvas.clientToCanvasPoint).mockRestore();
    wrapper.unmount();
  });
});
