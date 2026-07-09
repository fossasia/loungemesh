import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { connectAndJoinTestConference } from '@/test/jitsiTestContext';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import AppIcon from '@/components/ui/AppIcon.vue';
import SessionPage from './SessionPage.vue';
import { playUiSound } from '@/utils/uiSounds';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';

vi.mock('@/utils/uiSounds', () => ({
  playUiSound: vi.fn(),
  resetUiSoundsForTests: vi.fn(),
}));

vi.mock('@/components/screenshare/SharedScreens.vue', () => ({
  __esModule: true,
  __v_isVNode: false,
  __isTeleport: false,
  __isKeepAlive: false,
  name: 'SharedScreens',
  __name: 'SharedScreens',
  default: {
    name: 'SharedScreens',
    template: '<div class="shared-screens-mock" />',
  },
}));

vi.mock('@/components/chat/ChatPanel.vue', () => ({
  __esModule: true,
  __v_isVNode: false,
  __isTeleport: false,
  __isKeepAlive: false,
  name: 'ChatPanel',
  __name: 'ChatPanel',
  default: {
    name: 'ChatPanel',
    template: '<div class="chat-stub" />',
  },
}));

vi.mock('@/components/stage/StagePresentation.vue', () => ({
  __esModule: true,
  __v_isVNode: false,
  __isTeleport: false,
  __isKeepAlive: false,
  name: 'StagePresentation',
  __name: 'StagePresentation',
  default: {
    name: 'StagePresentation',
    template: '<div class="stage-presentation-stub" />',
  },
}));

vi.mock('@/components/session/SessionTools.vue', () => ({
  __esModule: true,
  __v_isVNode: false,
  __isTeleport: false,
  __isKeepAlive: false,
  name: 'SessionTools',
  __name: 'SessionTools',
  default: {
    name: 'SessionTools',
    template: '<div class="session-tools-stub" />',
  },
}));

vi.mock('@/components/session/SessionFeaturePanels.vue', () => ({
  __esModule: true,
  __v_isVNode: false,
  __isTeleport: false,
  __isKeepAlive: false,
  name: 'SessionFeaturePanels',
  __name: 'SessionFeaturePanels',
  default: {
    name: 'SessionFeaturePanels',
    template: '<div class="session-panels-stub" />',
  },
}));

vi.mock('@/components/session/LobbyOverlay.vue', () => ({
  __esModule: true,
  __v_isVNode: false,
  __isTeleport: false,
  __isKeepAlive: false,
  name: 'LobbyOverlay',
  __name: 'LobbyOverlay',
  default: {
    name: 'LobbyOverlay',
    template: '<div />',
  },
}));

vi.mock('@/components/session/WhiteboardOverlay.vue', () => ({
  __esModule: true,
  __v_isVNode: false,
  __isTeleport: false,
  __isKeepAlive: false,
  name: 'WhiteboardOverlay',
  __name: 'WhiteboardOverlay',
  default: {
    name: 'WhiteboardOverlay',
    template: '<div />',
  },
}));

vi.mock('@/components/stage/StagePreviewDialog.vue', () => ({
  __esModule: true,
  __v_isVNode: false,
  __isTeleport: false,
  __isKeepAlive: false,
  name: 'StagePreviewDialog',
  __name: 'StagePreviewDialog',
  default: {
    name: 'StagePreviewDialog',
    template: '<button class="stage-preview-dialog-stub" @click="$emit(\'close\')">Close Dialog</button>',
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
  ScreenshareButton: { template: '<div />' },
  StagePresentation: { template: '<div class="stage-presentation-stub" />' },
  ZoomControls: { template: '<div class="zoom-stub" />' },
  SessionTools: { template: '<div class="session-tools-stub" />' },
  SessionFeaturePanels: { template: '<div class="session-panels-stub" />' },
  LobbyOverlay: { template: '<div />' },
  ChatPanel: { template: '<div class="chat-stub" />' },
  WhiteboardOverlay: { template: '<div />' },
};

describe('SessionPage', () => {
  beforeEach(() => setActivePinia(createPinia()));

  afterEach(async () => {
    await flushPromises();
  });

  it('hides shared screens while stage mode is active', async () => {
    const features = useSessionFeaturesStore();
    features.stageOccupantId = 'presenter';
    const { wrapper } = await mountWithApp(SessionPage, {
      route: '/session/loungemesh',
      props: { id: 'loungemesh' },
      global: { stubs: sessionStubs },
    });
    await flushPromises();
    expect(wrapper.find('.shared-screens-mock').exists()).toBe(false);
    wrapper.unmount();
  });

  it('shows the stage view for everyone, including the occupant', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('presenter');
    features.stageOccupantId = 'presenter';
    local.onStage = true;
    const { wrapper } = await mountWithApp(SessionPage, {
      route: '/session/loungemesh',
      props: { id: 'loungemesh' },
      global: { stubs: sessionStubs },
    });
    await flushPromises();
    expect(wrapper.find('.stage-presentation-stub').exists()).toBe(true);
    wrapper.unmount();

    local.setMyID('viewer');
    features.stageOccupantId = 'presenter';
    const audience = await mountWithApp(SessionPage, {
      route: '/session/loungemesh',
      props: { id: 'loungemesh' },
      global: { stubs: sessionStubs },
    });
    await flushPromises();
    expect(audience.wrapper.find('.stage-presentation-stub').exists()).toBe(true);
    audience.wrapper.unmount();
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
          StagePresentation: { template: '<div />' },
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
          StagePresentation: { template: '<div />' },
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
          StagePresentation: { template: '<div />' },
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
          StagePresentation: { template: '<div />' },
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
          StagePresentation: { template: '<div />' },
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
          StagePresentation: { template: '<div />' },
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

  it('plays persistent invitation sound when stageInvitationPending is true', async () => {
    vi.mocked(playUiSound).mockClear();
    vi.useFakeTimers();

    const features = useSessionFeaturesStore();
    features.stageInvitationPending = false;

    const { wrapper } = await mountWithApp(SessionPage, {
      route: '/session/loungemesh',
      props: { id: 'loungemesh' },
      global: { stubs: sessionStubs },
    });
    await flushPromises();

    expect(playUiSound).not.toHaveBeenCalled();

    features.stageInvitationPending = true;
    await flushPromises();

    expect(playUiSound).toHaveBeenLastCalledWith('stageInvite');
    expect(playUiSound).toHaveBeenCalledTimes(1);

    // Fast-forward time
    vi.advanceTimersByTime(4000);
    expect(playUiSound).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(4000);
    expect(playUiSound).toHaveBeenCalledTimes(3);

    features.stageInvitationPending = false;
    await flushPromises();

    vi.advanceTimersByTime(4000);
    expect(playUiSound).toHaveBeenCalledTimes(3); // should stop playing

    vi.useRealTimers();
    wrapper.unmount();
  });

  it('renders stageToast when stageMessage is set', async () => {
    const features = useSessionFeaturesStore();
    features.stageMessage = 'Stage message toast text';
    const { wrapper } = await mountWithApp(SessionPage, {
      route: '/session/loungemesh',
      props: { id: 'loungemesh' },
      global: { stubs: sessionStubs },
    });
    await flushPromises();
    const toast = wrapper.find('.stageToast');
    expect(toast.exists()).toBe(true);
    expect(toast.text()).toBe('Stage message toast text');
    
    // Clear it
    features.stageMessage = '';
    await flushPromises();
    expect(wrapper.find('.stageToast').exists()).toBe(false);
    wrapper.unmount();
  });

  it('loads async components when not stubbed', async () => {
    const features = useSessionFeaturesStore();
    // Enable stage presentation, whiteboard, and stage preview dialog to trigger all loaders
    features.stageOccupantId = 'someone';
    features.panel = 'whiteboard';
    features.stageInvitationPending = true;

    const { wrapper } = await mountWithApp(SessionPage, {
      route: '/session/loungemesh',
      props: { id: 'loungemesh' },
      global: {
        stubs: {
          LocalStoreLogic: true,
          JitsiConnection: true,
          PanWrapper: true,
          Room: true,
          RemoteUsers: true,
          LocalUser: true,
          ScreenshareButton: true,
          ChatPanel: true,
        }
      }
    });
    await flushPromises();
    wrapper.unmount();
  });

  it('covers all LeaveDialog event handlers and stageBtn toggle on SessionPage', async () => {
    const local = useLocalStore();
    const features = useSessionFeaturesStore();
    local.setMyID('host');
    features.setHost('host');

    // Mock URL object creation APIs
    const createObjectURL = window.URL.createObjectURL;
    const revokeObjectURL = window.URL.revokeObjectURL;
    window.URL.createObjectURL = vi.fn(() => 'blob:url');
    window.URL.revokeObjectURL = vi.fn();

    const { wrapper } = await mountWithApp(SessionPage, {
      route: '/session/loungemesh',
      props: { id: 'loungemesh' },
      global: { stubs: sessionStubs },
    });
    await flushPromises();

    // 1. Trigger stageBtn click
    features.stageInvitationPending = true;
    await flushPromises();
    expect(wrapper.vm.showStagePreviewDialog).toBe(true);
    await wrapper.find('.stageBtn').trigger('click');
    expect(wrapper.vm.showStagePreviewDialog).toBe(false);
    await wrapper.find('.stageBtn').trigger('click');
    expect(wrapper.vm.showStagePreviewDialog).toBe(true);

    // 2. Show LeaveDialog
    await wrapper.find('.btn-leave-call').trigger('click');
    await flushPromises();

    const leaveDialog = wrapper.findComponent({ name: 'LeaveDialog' });
    expect(leaveDialog.exists()).toBe(true);

    // 3. Emit all event handlers
    leaveDialog.vm.$emit('export-notes');
    leaveDialog.vm.$emit('export-whiteboard');
    leaveDialog.vm.$emit('export-recording');
    leaveDialog.vm.$emit('toggle-recording', '720p');
    leaveDialog.vm.$emit('update:quality', '480p');
    leaveDialog.vm.$emit('cancel');

    await flushPromises();
    wrapper.unmount();

    // Restore URL mocks
    window.URL.createObjectURL = createObjectURL;
    window.URL.revokeObjectURL = revokeObjectURL;
  });

  it('covers remaining template logic (StagePreviewDialog close, stage presentation, panel backdrop click, and record settings)', async () => {
    const local = useLocalStore();
    const features = useSessionFeaturesStore();

    // Set up state. stageInvitationPending=true with isLocalStageOccupant=false triggers showStagePreviewDialog=true.
    local.setMyID('host');
    features.setHost('host');
    local.onStage = false;
    features.stageOccupantId = '';
    features.stageInvitationPending = false;
    features.panel = 'moderator'; // renders panelBackdrop

    // Mock MediaRecorder support for SessionRecordButton
    const savedRecorder = (globalThis as { MediaRecorder?: unknown }).MediaRecorder;
    const savedCapture = HTMLCanvasElement.prototype.captureStream;
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = function MockRecorder() {} as never;
    HTMLCanvasElement.prototype.captureStream = function () {
      return {} as MediaStream;
    } as never;

    const { wrapper } = await mountWithApp(SessionPage, {
      route: '/session/loungemesh',
      props: { id: 'loungemesh' },
      global: {
        stubs: {
          ...sessionStubs,
          StagePreviewDialog: {
            template: '<button class="stage-preview-dialog-stub" @click="$emit(\'close\')">Close Dialog</button>'
          }
        }
      },
    });
    await flushPromises();

    // Trigger watcher to show StagePreviewDialog
    features.stageInvitationPending = true;
    await flushPromises();

    // Verify backdrop exists and click it to dismiss panel
    const backdrop = wrapper.find('.panelBackdrop');
    expect(backdrop.exists()).toBe(true);
    await backdrop.trigger('click');
    expect(features.panel).toBe('');

    // Click close on StagePreviewDialog stub to emit close event
    const dialogCloseBtn = wrapper.find('.stage-preview-dialog-stub');
    expect(dialogCloseBtn.exists()).toBe(true);
    await dialogCloseBtn.trigger('click');
    expect(wrapper.vm.showStagePreviewDialog).toBe(false);

    // Set stage mode active to render StagePresentation
    local.onStage = true;
    features.stageOccupantId = 'host';
    await flushPromises();
    expect(wrapper.find('.stage-presentation-stub').exists()).toBe(true);

    // Verify SessionRecordButton is rendered and interact with it
    const recordBtn = wrapper.find('[aria-label="Record session"]');
    expect(recordBtn.exists()).toBe(true);
    await recordBtn.trigger('click'); // triggers @toggle

    const select = wrapper.find('.qualityPicker');
    expect(select.exists()).toBe(true);
    (select.element as HTMLSelectElement).value = '480p';
    await select.trigger('change'); // triggers v-model update
    expect(wrapper.vm.selectedQuality).toBe('480p');

    wrapper.unmount();
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = savedRecorder;
    if (savedCapture) HTMLCanvasElement.prototype.captureStream = savedCapture;
    else delete (HTMLCanvasElement.prototype as { captureStream?: unknown }).captureStream;
  });

  it('renders lobby notification banner for host/moderator and handles admit/deny', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('host');
    features.setHost('host');
    features.lobbyWaiting = [
      { id: 'guest-1', name: 'Bob', email: 'bob@example.com', reason: 'To present' }
    ];

    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');

    const { wrapper } = await mountWithApp(SessionPage, {
      route: '/session/loungemesh',
      props: { id: 'loungemesh' },
      global: { stubs: sessionStubs },
    });
    await flushPromises();

    // Click trigger to open dropdown
    const trigger = wrapper.find('.lobbyMenuBtn');
    expect(trigger.exists()).toBe(true);
    await trigger.trigger('click');

    // Check dropdown render
    const dropdown = wrapper.find('.lobbyDropdownCard');
    expect(dropdown.exists()).toBe(true);
    expect(dropdown.text()).toContain('Bob');
    expect(dropdown.text()).toContain('bob@example.com');
    expect(dropdown.text()).toContain('To present');

    // Click Admit
    await dropdown.find('.btnAdmit').trigger('click');
    expect(cmdSpy).toHaveBeenCalledWith('lobby', expect.stringContaining('"action":"approve"'));
    expect(cmdSpy).toHaveBeenCalledWith('lobby', expect.stringContaining('"id":"guest-1"'));

    // Reset lobby wait for reject test
    features.lobbyWaiting = [
      { id: 'guest-2', name: 'Alice' }
    ];
    await flushPromises();

    // Click Deny
    await wrapper.find('.btnDeny').trigger('click');
    expect(cmdSpy).toHaveBeenCalledWith('lobby', expect.stringContaining('"action":"reject"'));
    expect(cmdSpy).toHaveBeenCalledWith('lobby', expect.stringContaining('"id":"guest-2"'));

    wrapper.unmount();
  });
});

