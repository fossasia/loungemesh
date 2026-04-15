import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { connectAndJoinTestConference } from '@/test/jitsiTestContext';
import { useLocalStore } from '@/stores/localStore';
import MicIcon from '@/components/icons/MicIcon.vue';
import MicOffIcon from '@/components/icons/MicOffIcon.vue';
import SessionPage from './SessionPage.vue';

const sessionStubs = {
  LocalStoreLogic: { template: '<div />' },
  JitsiConnection: { template: '<div />' },
  PanWrapper: { template: '<div><slot /></div>' },
  Room: { template: '<div><slot /></div>' },
  RemoteUsers: { template: '<div />' },
  LocalUser: { template: '<div />' },
  FooterBar: { template: '<div><slot /><slot name="right" /></div>' },
  StageButton: { template: '<div />' },
  ScreenshareButton: { template: '<div />' },
  ZoomControls: { template: '<div class="zoom-stub" />' },
};

describe('SessionPage', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('shows mic state and leaves session', async () => {
    await connectAndJoinTestConference();
    const local = useLocalStore();
    local.mute = false;
    local.onStage = true;

    const { wrapper, router } = await mountWithApp(SessionPage, {
      route: '/session/flowspace',
      props: { id: 'flowspace' },
      global: {
        stubs: {
          ...sessionStubs,
          ChatPanel: { template: '<div />' },
          StagePanel: { template: '<div />' },
        },
      },
    });
    await flushPromises();
    expect(wrapper.findComponent(MicIcon).exists()).toBe(true);
    expect(wrapper.findComponent(MicOffIcon).exists()).toBe(false);

    const push = vi.spyOn(router, 'push');
    await wrapper.find('button.ibtn').trigger('click');
    await wrapper.find('.btn-leave-call').trigger('click');
    await flushPromises();
    expect(push).toHaveBeenCalledWith('/');
    wrapper.unmount();
    await flushPromises();
  });

  it('handles missing route id param', async () => {
    const { createRouter, createMemoryHistory } = await import('vue-router');
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/session/:id?', name: 'session-opt', component: SessionPage, props: true }],
    });
    await router.push('/session');
    await router.isReady();
    const { wrapper } = await mountWithApp(SessionPage, {
      router,
      props: { id: '' },
      global: { stubs: sessionStubs },
    });
    expect(wrapper.exists()).toBe(true);
    wrapper.unmount();
  });

  it('shows unmute label when muted', async () => {
    const local = useLocalStore();
    local.mute = true;
    const { wrapper } = await mountWithApp(SessionPage, {
      route: '/session/flowspace',
      props: { id: 'flowspace' },
      global: {
        stubs: {
          ...sessionStubs,
          ChatPanel: { template: '<div />' },
          StagePanel: { template: '<div />' },
        },
      },
    });
    await flushPromises();
    expect(wrapper.html()).toContain('Unmute');
    wrapper.unmount();
  });

  it('resets viewport when route id changes', async () => {
    const local = useLocalStore();
    const resetSpy = vi.spyOn(local, 'resetViewportForRoom');
    const { wrapper, router } = await mountWithApp(SessionPage, {
      route: '/session/room-a',
      props: { id: 'room-a' },
      global: {
        stubs: {
          ChatPanel: { template: '<div />' },
          StagePanel: { template: '<div />' },
          ...sessionStubs,
        },
      },
    });
    await flushPromises();
    await router.push('/session/room-b');
    await flushPromises();
    expect(resetSpy).toHaveBeenCalled();
    resetSpy.mockRestore();
    wrapper.unmount();
  });
});
