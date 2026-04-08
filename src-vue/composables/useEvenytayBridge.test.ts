import { describe, expect, it, vi, afterEach } from 'vitest';
import { defineComponent, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { setJwtRefreshCallback, useEventyayBridge } from './useEvenytayBridge';

describe('useEventyayBridge', () => {
  const originalParent = window.parent;

  afterEach(() => {
    Object.defineProperty(window, 'parent', { value: originalParent, configurable: true });
    vi.unstubAllEnvs();
  });

  function setParent(value: object) {
    Object.defineProperty(window, 'parent', { value, configurable: true });
  }

  it('detects iframe by checking window.parent !== window', () => {
    setParent({} as Window);
    const Comp = defineComponent({ setup: () => useEventyayBridge(), template: '<div />' });
    const wrapper = mount(Comp);
    expect(wrapper.vm.inIframe).toBe(true);
    wrapper.unmount();
  });

  it('removes message listener on unmount in iframe', async () => {
    vi.stubEnv('VITE_ALLOW_IFRAME_FROM', 'https://eventyay.com');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    setParent({ postMessage: vi.fn() });

    const wrapper = mount(
      defineComponent({ setup: () => useEventyayBridge(), template: '<div />' }),
    );
    await nextTick();
    wrapper.unmount();
    expect(removeSpy).toHaveBeenCalledWith('message', expect.any(Function));
    removeSpy.mockRestore();
  });

  it('is a no-op outside iframe', async () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const wrapper = mount(
      defineComponent({ setup: () => useEventyayBridge(), template: '<div />' }),
    );
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
    setParent({ postMessage });
    const refresh = vi.fn();
    setJwtRefreshCallback(refresh);

    const wrapper = mount(
      defineComponent({ setup: () => useEventyayBridge(), template: '<div />' }),
    );
    await nextTick();
    expect(postMessage).toHaveBeenCalled();

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://eventyay.com',
        data: { source: 'eventyay', type: 'flowspace:new_token', jwt: 'jwt-1' },
      }),
    );
    expect(refresh).toHaveBeenCalledWith('jwt-1');

    // Message from disallowed origin is ignored
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
    setParent({ postMessage });
    const wrapper = mount(
      defineComponent({ setup: () => useEventyayBridge(), template: '<div />' }),
    );
    await nextTick();
    expect(postMessage).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('ignores postMessage failures and empty jwt tokens', async () => {
    vi.stubEnv('VITE_ALLOW_IFRAME_FROM', 'https://eventyay.com,https://other.com');
    const postMessage = vi.fn().mockImplementation(() => { throw new Error('blocked'); });
    setParent({ postMessage });
    const refresh = vi.fn();
    setJwtRefreshCallback(refresh);

    const wrapper = mount(
      defineComponent({ setup: () => useEventyayBridge(), template: '<div />' }),
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
    setParent({ postMessage: vi.fn() });
    const wrapper = mount(
      defineComponent({ setup: () => useEventyayBridge(), template: '<div />' }),
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
    setParent({ postMessage: vi.fn() });
    const wrapper = mount(
      defineComponent({ setup: () => useEventyayBridge(), template: '<div />' }),
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
