import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { setJwtRefreshCallback, useEventyayBridge } from './useEvenytayBridge';

describe('useEventyayBridge', () => {
  const originalParent = window.parent;
  const originalSelf = window.self;

  afterEach(() => {
    Object.defineProperty(window, 'parent', { value: originalParent, configurable: true });
    Object.defineProperty(window, 'self', { value: originalSelf, configurable: true });
    vi.unstubAllEnvs();
  });

  it('detects iframe when parent access throws', async () => {
    Object.defineProperty(window, 'self', {
      get() {
        throw new Error('cross-origin');
      },
      configurable: true,
    });
    const Comp = defineComponent({
      setup() {
        return useEventyayBridge();
      },
      template: '<div />',
    });
    const wrapper = mount(Comp);
    expect(wrapper.vm.inIframe).toBe(true);
    wrapper.unmount();
    Object.defineProperty(window, 'self', { value: originalSelf, configurable: true });
  });

  it('removes message listener on unmount in iframe', async () => {
    vi.stubEnv('VITE_ALLOW_IFRAME_FROM', 'https://eventyay.com');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const parentWin = { postMessage: vi.fn() };
    Object.defineProperty(window, 'parent', { value: parentWin, configurable: true });
    Object.defineProperty(window, 'top', { value: parentWin, configurable: true });
    Object.defineProperty(window, 'self', { value: window, configurable: true });

    const wrapper = mount(
      defineComponent({
        setup: () => useEventyayBridge(),
        template: '<div />',
      }),
    );
    await nextTick();
    wrapper.unmount();
    expect(removeSpy).toHaveBeenCalledWith('message', expect.any(Function));
    removeSpy.mockRestore();
    Object.defineProperty(window, 'parent', { value: originalParent, configurable: true });
    Object.defineProperty(window, 'top', { value: originalParent, configurable: true });
    Object.defineProperty(window, 'self', { value: originalSelf, configurable: true });
  });

  it('is a no-op outside iframe', async () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const Comp = defineComponent({
      setup() {
        const bridge = useEventyayBridge();
        return bridge;
      },
      template: '<div />',
    });
    const wrapper = mount(Comp);
    expect(wrapper.vm.inIframe).toBe(false);
    wrapper.vm.announce();
    wrapper.vm.notifyJoined(3);
    wrapper.vm.notifyLeft(2);
    wrapper.unmount();
    expect(removeSpy).not.toHaveBeenCalled();
    removeSpy.mockRestore();
  });

  it('posts to parent and handles token messages in iframe', async () => {
    vi.stubEnv('VITE_ALLOW_IFRAME_FROM', 'https://eventyay.com');
    const postMessage = vi.fn();
    const parentWin = { postMessage };
    Object.defineProperty(window, 'parent', { value: parentWin, configurable: true });
    Object.defineProperty(window, 'top', { value: parentWin, configurable: true });
    Object.defineProperty(window, 'self', { value: window, configurable: true });

    const refresh = vi.fn();
    setJwtRefreshCallback(refresh);

    const Comp = defineComponent({
      setup() {
        return useEventyayBridge();
      },
      template: '<div />',
    });
    const wrapper = mount(Comp);
    await nextTick();
    expect(postMessage).toHaveBeenCalled();

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://eventyay.com',
        data: { source: 'eventyay', type: 'flowspace:new_token', jwt: 'jwt-1' },
      }),
    );
    expect(refresh).toHaveBeenCalledWith('jwt-1');

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://evil.com',
        data: { source: 'eventyay', type: 'flowspace:new_token', jwt: 'bad' },
      }),
    );
    wrapper.unmount();
  });

  it('does not post when allowed origins list is empty', async () => {
    vi.stubEnv('VITE_ALLOW_IFRAME_FROM', '');
    const postMessage = vi.fn();
    Object.defineProperty(window, 'parent', { value: { postMessage }, configurable: true });
    Object.defineProperty(window, 'top', { value: { postMessage }, configurable: true });
    Object.defineProperty(window, 'self', { value: window, configurable: true });

    const Comp = defineComponent({
      setup: () => useEventyayBridge(),
      template: '<div />',
    });
    const wrapper = mount(Comp);
    await nextTick();
    expect(postMessage).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('ignores postMessage failures and empty jwt tokens', async () => {
    vi.stubEnv('VITE_ALLOW_IFRAME_FROM', 'https://eventyay.com,https://other.com');
    const postMessage = vi.fn().mockImplementation(() => {
      throw new Error('blocked');
    });
    const parentWin = { postMessage };
    Object.defineProperty(window, 'parent', { value: parentWin, configurable: true });
    Object.defineProperty(window, 'top', { value: parentWin, configurable: true });
    Object.defineProperty(window, 'self', { value: window, configurable: true });

    const refresh = vi.fn();
    setJwtRefreshCallback(refresh);

    const wrapper = mount(
      defineComponent({
        setup: () => useEventyayBridge(),
        template: '<div />',
      }),
    );
    await nextTick();
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://eventyay.com',
        data: { source: 'eventyay', type: 'flowspace:new_token', jwt: '' },
      }),
    );
    expect(refresh).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('ignores unrelated eventyay message types', async () => {
    vi.stubEnv('VITE_ALLOW_IFRAME_FROM', 'https://eventyay.com');
    const refresh = vi.fn();
    setJwtRefreshCallback(refresh);
    Object.defineProperty(window, 'parent', { value: { postMessage: vi.fn() }, configurable: true });
    Object.defineProperty(window, 'top', { value: { postMessage: vi.fn() }, configurable: true });
    Object.defineProperty(window, 'self', { value: window, configurable: true });

    const wrapper = mount(
      defineComponent({
        setup: () => useEventyayBridge(),
        template: '<div />',
      }),
    );
    await nextTick();
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://eventyay.com',
        data: { source: 'eventyay', type: 'other:event' },
      }),
    );
    expect(refresh).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('ignores messages with wrong source payload', async () => {
    vi.stubEnv('VITE_ALLOW_IFRAME_FROM', 'https://eventyay.com');
    const refresh = vi.fn();
    setJwtRefreshCallback(refresh);
    Object.defineProperty(window, 'parent', { value: { postMessage: vi.fn() }, configurable: true });
    Object.defineProperty(window, 'top', { value: { postMessage: vi.fn() }, configurable: true });
    Object.defineProperty(window, 'self', { value: window, configurable: true });

    const wrapper = mount(
      defineComponent({
        setup: () => useEventyayBridge(),
        template: '<div />',
      }),
    );
    await nextTick();
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://eventyay.com',
        data: { source: 'other', type: 'flowspace:new_token', jwt: 'x' },
      }),
    );
    expect(refresh).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
