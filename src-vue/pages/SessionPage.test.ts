import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { connectAndJoinTestConference } from '@/test/jitsiTestContext';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import AppIcon from '@/components/ui/AppIcon.vue';
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
  SessionTools: { template: '<div class="session-tools-stub" />' },
  SessionFeaturePanels: { template: '<div class="session-panels-stub" />' },
  LobbyOverlay: { template: '<div />' },
};

describe('SessionPage', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('hides moderator control for non-host participants', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('guest');
    features.setHost('host');
    const { wrapper } = await mountWithApp(SessionPage, {
      route: '/session/flowspace',
      props: { id: 'flowspace' },
      global: {
        stubs: {
          ...sessionStubs,
          ChatPanel: { template: '<div class="chat-stub" />' },
          StagePanel: { template: '<div />' },
          SessionTools: { template: '<div />' },
          SessionFeaturePanels: { template: '<div />' },
          LobbyOverlay: { template: '<div />' },
        },
      },
    });
    await flushPromises();
    expect(wrapper.find('[aria-label="Moderator"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('shows moderator control to the right of chat for hosts', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('host');
    features.setHost('host');
    const { wrapper } = await mountWithApp(SessionPage, {
      route: '/session/flowspace',
      props: { id: 'flowspace' },
      global: {
        stubs: {
          ...sessionStubs,
          ChatPanel: { template: '<div class="chat-stub" />' },
          StagePanel: { template: '<div />' },
          SessionTools: { template: '<div />' },
          SessionFeaturePanels: { template: '<div />' },
          LobbyOverlay: { template: '<div />' },
        },
      },
    });
    await flushPromises();
    expect(wrapper.find('[aria-label="Moderator"]').exists()).toBe(true);
    await wrapper.find('[aria-label="Moderator"]').trigger('click');
    expect(features.panel).toBe('moderator');
    wrapper.unmount();
  });

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
          SessionTools: { template: '<div />' },
          SessionFeaturePanels: { template: '<div />' },
          LobbyOverlay: { template: '<div />' },
        },
      },
    });
    await flushPromises();
    expect(wrapper.findAllComponents(AppIcon).length).toBeGreaterThan(0);

    const push = vi.spyOn(router, 'push');
    const stopSpy = vi.spyOn(local, 'stopAllLocalMedia');
    await wrapper.find('[aria-label="Mute"]').trigger('click');
    await wrapper.find('.btn-leave-call').trigger('click');
    expect(stopSpy).toHaveBeenCalled();
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
          SessionTools: { template: '<div />' },
          SessionFeaturePanels: { template: '<div />' },
          LobbyOverlay: { template: '<div />' },
        },
      },
    });
    await flushPromises();
    expect(wrapper.html()).toContain('Unmute');
    wrapper.unmount();
  });

  it('falls back to props id when route param is missing', async () => {
    const { createRouter, createMemoryHistory } = await import('vue-router');
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/session/:id?', name: 'session-opt', component: SessionPage, props: true }],
    });
    await router.push('/session');
    await router.isReady();
    const { wrapper } = await mountWithApp(SessionPage, {
      router,
      props: { id: 'props-room' },
      global: {
        stubs: {
          ...sessionStubs,
          Room: { props: ['identifier'], template: '<div class="room-id">{{ identifier }}</div>' },
        },
      },
    });
    await flushPromises();
    expect(wrapper.find('.room-id').text()).toBe('props-room');
    wrapper.unmount();
  });

  it('passes route id into the room', async () => {
    const { wrapper } = await mountWithApp(SessionPage, {
      route: '/session/test-room',
      props: { id: 'test-room' },
      global: {
        stubs: {
          ...sessionStubs,
          Room: { props: ['identifier'], template: '<div class="room-id">{{ identifier }}</div>' },
        },
      },
    });
    await flushPromises();
    expect(wrapper.find('.room-id').text()).toBe('test-room');
    wrapper.unmount();
  });

  it('closes the whiteboard overlay from the session page', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('host');
    features.setHost('host');
    features.panel = 'whiteboard';
    const { wrapper } = await mountWithApp(SessionPage, {
      route: '/session/flowspace',
      props: { id: 'flowspace' },
      global: {
        stubs: {
          ...sessionStubs,
          ChatPanel: { template: '<div />' },
          StagePanel: { template: '<div />' },
          WhiteboardOverlay: {
            props: ['onClose'],
            template: '<button class="wb-close" @click="onClose()">Close</button>',
          },
        },
      },
    });
    await flushPromises();
    await wrapper.find('.wb-close').trigger('click');
    expect(features.panel).toBe('');
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
