import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { connectAndJoinTestConference } from '@/test/jitsiTestContext';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import AppIcon from '@/components/ui/AppIcon.vue';
import SessionPage from './SessionPage.vue';

vi.mock('@/components/screenshare/SharedScreens.vue', () => ({
  default: {
    template: '<div class="shared-screens-mock" />',
  },
}));

/** Stub async SessionPage children so imports do not finish after test teardown. */
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
  ChatPanel: { template: '<div class="chat-stub" />' },
  StagePanel: { template: '<div />' },
  WhiteboardOverlay: { template: '<div />' },
};

describe('SessionPage', () => {
  beforeEach(() => setActivePinia(createPinia()));

  afterEach(async () => {
    await flushPromises();
  });

  it('hides moderator control for non-host participants', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('guest');
    features.setHost('host');
    const { wrapper } = await mountWithApp(SessionPage, {
      route: '/session/loungemesh',
      props: { id: 'loungemesh' },
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
      route: '/session/loungemesh',
      props: { id: 'loungemesh' },
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

  it('dismisses the host leave dialog on cancel', async () => {
    const local = useLocalStore();
    const features = useSessionFeaturesStore();
    local.setMyID('host');
    features.setHost('host');
    const { wrapper, router } = await mountWithApp(SessionPage, {
      route: '/session/loungemesh',
      props: { id: 'loungemesh' },
      global: { stubs: sessionStubs },
    });
    await flushPromises();
    const push = vi.spyOn(router, 'push');
    await wrapper.find('.btn-leave-call').trigger('click');
    expect(wrapper.find('.leaveCard').exists()).toBe(true);
    await wrapper.find('.leaveCard .btn.cancel').trigger('click');
    await flushPromises();
    expect(wrapper.find('.leaveCard').exists()).toBe(false);
    expect(push).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('shows mic state and leaves session', async () => {
    await connectAndJoinTestConference();
    const local = useLocalStore();
    local.setMyID('host');
    local.mute = false;
    local.onStage = true;

    const { wrapper, router } = await mountWithApp(SessionPage, {
      route: '/session/loungemesh',
      props: { id: 'loungemesh' },
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
    // Host leave opens the export dialog; confirm via its Leave button.
    await wrapper.find('.btn-leave-call').trigger('click');
    await flushPromises();
    await wrapper.find('.leaveCard .btn.leave').trigger('click');
    expect(stopSpy).toHaveBeenCalled();
    await flushPromises();
    expect(push).toHaveBeenCalledWith('/');
    wrapper.unmount();
    await flushPromises();
  });

  it('leaves immediately for non-host participants without the dialog', async () => {
    await connectAndJoinTestConference();
    const local = useLocalStore();
    const features = useSessionFeaturesStore();
    features.setHost('someone-else');
    const { wrapper, router } = await mountWithApp(SessionPage, {
      route: '/session/loungemesh',
      props: { id: 'loungemesh' },
      global: { stubs: sessionStubs },
    });
    await flushPromises();
    const push = vi.spyOn(router, 'push');
    const stopSpy = vi.spyOn(local, 'stopAllLocalMedia');
    await wrapper.find('.btn-leave-call').trigger('click');
    expect(wrapper.find('.leaveCard').exists()).toBe(false);
    expect(stopSpy).toHaveBeenCalled();
    await flushPromises();
    expect(push).toHaveBeenCalledWith('/');
    wrapper.unmount();
    await flushPromises();
  });

  it('shows recording controls in the footer and leave export for hosts', async () => {
    const local = useLocalStore();
    local.setMyID('host');
    useSessionFeaturesStore().setHost('host');
    const savedRecorder = (globalThis as { MediaRecorder?: unknown }).MediaRecorder;
    const savedCapture = HTMLCanvasElement.prototype.captureStream;
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = function MockRecorder() {} as never;
    HTMLCanvasElement.prototype.captureStream = function () {
      return {} as MediaStream;
    } as never;

    const { wrapper } = await mountWithApp(SessionPage, {
      route: '/session/loungemesh',
      props: { id: 'loungemesh' },
      global: { stubs: sessionStubs },
    });
    await flushPromises();
    expect(wrapper.find('[aria-label="Record session"]').exists()).toBe(true);
    expect(wrapper.find('.qualityPicker').exists()).toBe(true);
    await wrapper.find('.btn-leave-call').trigger('click');
    await flushPromises();
    const recordingExport = wrapper
      .findAll('.leaveCard .export')
      .find((btn) => btn.text().includes('Recording'));
    expect(recordingExport?.find('.ext').text()).toBe('.mp4');
    wrapper.unmount();

    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = savedRecorder;
    if (savedCapture) HTMLCanvasElement.prototype.captureStream = savedCapture;
    else delete (HTMLCanvasElement.prototype as { captureStream?: unknown }).captureStream;
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

  it('toggles camera from the footer control', async () => {
    const local = useLocalStore();
    local.cameraOff = false;
    const toggleSpy = vi.spyOn(local, 'toggleCamera').mockResolvedValue(undefined);
    const { wrapper } = await mountWithApp(SessionPage, {
      route: '/session/loungemesh',
      props: { id: 'loungemesh' },
      global: { stubs: sessionStubs },
    });
    await flushPromises();
    await wrapper.find('[aria-label="Turn off camera"]').trigger('click');
    expect(toggleSpy).toHaveBeenCalled();
    wrapper.unmount();
    await flushPromises();
  });

  it('shows camera-on label when camera is off', async () => {
    const local = useLocalStore();
    local.cameraOff = true;
    const { wrapper } = await mountWithApp(SessionPage, {
      route: '/session/loungemesh',
      props: { id: 'loungemesh' },
      global: { stubs: sessionStubs },
    });
    await flushPromises();
    expect(wrapper.find('[aria-label="Turn on camera"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('shows unmute label when muted', async () => {
    const local = useLocalStore();
    local.mute = true;
    const { wrapper } = await mountWithApp(SessionPage, {
      route: '/session/loungemesh',
      props: { id: 'loungemesh' },
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
      route: '/session/loungemesh',
      props: { id: 'loungemesh' },
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
