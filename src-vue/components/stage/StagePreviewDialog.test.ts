import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import StagePreviewDialog from './StagePreviewDialog.vue';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';

async function mountPreviewDialog() {
  return mountWithApp(StagePreviewDialog);
}

describe('StagePreviewDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders invitation prompt when stageInvitationPending is true', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('me');
    features.stageInvitationPending = true;

    const { wrapper } = await mountPreviewDialog();
    expect(wrapper.text()).toContain('Presenter Setup');
    expect(wrapper.text()).toContain('You are asked to present');
    wrapper.unmount();
  });

  it('allows going live when clicking Go Live button', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('me');
    features.stageInvitationPending = true;
    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');

    const { wrapper } = await mountPreviewDialog();
    await wrapper.find('.actionBtn.primary').trigger('click');
    expect(cmdSpy).toHaveBeenCalledWith('stage', expect.stringContaining('"action":"promote"'));
    expect(features.stageOccupantId).toBe('me');
    expect(local.onStage).toBe(true);
    wrapper.unmount();
  });

  it('declines invitation when clicking Decline button', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('me');
    features.stageInvitationPending = true;

    const { wrapper } = await mountPreviewDialog();
    await wrapper.find('.actionBtn.secondary').trigger('click');
    expect(features.stageInvitationPending).toBe(false);
    wrapper.unmount();
  });

  it('allows leaving stage when user is occupant', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('me');
    local.setOnStage(true);
    features.stageOccupantId = 'me';
    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');

    const { wrapper } = await mountPreviewDialog();
    expect(wrapper.text()).toContain('You are live as a presenter');
    await wrapper.find('.actionBtn.warn').trigger('click');
    expect(cmdSpy).toHaveBeenCalledWith('stage', expect.stringContaining('"action":"demote"'));
    wrapper.unmount();
  });

  it('covers PIP dragging, device toggles, and close buttons', async () => {
    vi.useFakeTimers();
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('me');
    features.stageOccupantId = 'other'; // not occupant initially

    const { wrapper } = await mountPreviewDialog();

    // 1. Mock canvas and client width/height
    const container = wrapper.find('.previewCanvas').element as HTMLElement;
    Object.defineProperty(container, 'clientWidth', { value: 480, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 270, configurable: true });
    container.getBoundingClientRect = () => ({
      left: 10, top: 10, right: 490, bottom: 280, width: 480, height: 270, x: 10, y: 10
    } as DOMRect);

    (wrapper.vm as any).containerRef = container;

    // 2. Setup screen & video to show PIP
    local.screenshare = { attach: vi.fn(), detach: vi.fn() } as any;
    local.cameraOff = false;
    local.video = { attach: vi.fn(), detach: vi.fn() } as any;
    local.videoType = 'camera';
    await flushPromises();

    const pip = wrapper.find('.previewPip').element as HTMLElement;
    pip.getBoundingClientRect = () => ({
      left: 20, top: 20, right: 120, bottom: 120, width: 100, height: 100, x: 20, y: 20
    } as DOMRect);

    // 3. Test onPipPointerDown buttons, move, up (when not occupant)
    const downEv1 = new PointerEvent('pointerdown', { button: 1 });
    (wrapper.vm as any).onPipPointerDown(downEv1); // button !== 0 branch

    const downEv = new PointerEvent('pointerdown', { button: 0, clientX: 50, clientY: 50 });
    Object.defineProperty(downEv, 'currentTarget', { value: pip });
    (wrapper.vm as any).onPipPointerDown(downEv);

    const moveEv = new PointerEvent('pointermove', { clientX: 80, clientY: 90 });
    Object.defineProperty(moveEv, 'currentTarget', { value: pip });
    (wrapper.vm as any).onPipPointerMove(moveEv);

    const upEv = new PointerEvent('pointerup');
    Object.defineProperty(upEv, 'currentTarget', { value: pip });
    (wrapper.vm as any).onPipPointerUp(upEv);

    // 4. Test onPipPointerMove when not dragging
    (wrapper.vm as any).draggingPip = false;
    (wrapper.vm as any).onPipPointerMove(moveEv);

    // 5. Test onPipPointerUp when not dragging
    (wrapper.vm as any).onPipPointerUp(upEv);

    // 6. Test with null containerRef
    (wrapper.vm as any).containerRef = null;
    (wrapper.vm as any).onPipPointerDown(downEv);
    (wrapper.vm as any).draggingPip = true;
    (wrapper.vm as any).onPipPointerUp(upEv);
    (wrapper.vm as any).containerRef = container;

    // 7. Test PIP drag and throttledBroadcast when occupant is true
    features.stageOccupantId = 'me';
    await flushPromises();
    (wrapper.vm as any).onPipPointerDown(downEv);
    (wrapper.vm as any).onPipPointerMove(moveEv);
    (wrapper.vm as any).onPipPointerMove(moveEv); // double call for clearTimeout
    await vi.advanceTimersByTimeAsync(110);
    (wrapper.vm as any).onPipPointerUp(upEv);

    // 8. Test setPipCorner for other corners
    (wrapper.vm as any).setPipCorner('tl');
    (wrapper.vm as any).setPipCorner('tr');
    (wrapper.vm as any).setPipCorner('bl');
    (wrapper.vm as any).setPipCorner('br');

    features.stageOccupantId = 'other'; // set back
    (wrapper.vm as any).setPipCorner('tl');
    (wrapper.vm as any).setPipCorner('tr');
    (wrapper.vm as any).setPipCorner('bl');
    (wrapper.vm as any).setPipCorner('br');

    // 8b. Test small container size fallback branches (: 0) in pointermove/up when usable size is <= 0
    (wrapper.vm as any).containerWidth = 10;
    (wrapper.vm as any).containerHeight = 10;
    (wrapper.vm as any).draggingPip = true;
    (wrapper.vm as any).onPipPointerMove(moveEv);
    (wrapper.vm as any).draggingPip = true;
    (wrapper.vm as any).onPipPointerUp(upEv);
    (wrapper.vm as any).containerWidth = 480; // restore
    (wrapper.vm as any).containerHeight = 270;

    // 8c. Test throttledBroadcast when isLocalStageOccupant changes to false before timer fires
    vi.useFakeTimers();
    features.stageOccupantId = 'me';
    (wrapper.vm as any).onPipPointerDown(downEv);
    (wrapper.vm as any).onPipPointerMove(moveEv);
    features.stageOccupantId = 'other';
    await vi.advanceTimersByTimeAsync(110);
    vi.useRealTimers();

    // Restore timers to real time before calling asynchronous device toggles
    vi.useRealTimers();

    // 9. Test device toggles
    const cameraSpy = vi.spyOn(local, 'toggleCamera').mockResolvedValue();
    const muteSpy = vi.spyOn(local, 'toggleMute').mockResolvedValue();
    await (wrapper.vm as any).handleMicToggle();
    await (wrapper.vm as any).handleCameraToggle();
    await (wrapper.vm as any).handleScreenshareToggle();
    expect(cameraSpy).toHaveBeenCalled();
    expect(muteSpy).toHaveBeenCalled();

    // 10. Click close buttons and verify emits
    await wrapper.find('.closeBtn').trigger('click');
    expect(wrapper.emitted('close')).toBeTruthy();

    await wrapper.find('.stagePreviewOverlay').trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(2);

    features.stageOccupantId = 'me';
    await flushPromises();
    await wrapper.find('.actionBtn.secondary').trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(3);

    // 10b. Test isLocalSpeaking computed combinations
    local.speaking = true;
    local.mute = false;
    await flushPromises();
    expect((wrapper.vm as any).isLocalSpeaking).toBe(true);

    local.speaking = true;
    local.mute = true;
    await flushPromises();
    expect((wrapper.vm as any).isLocalSpeaking).toBe(false);

    local.speaking = false;
    local.mute = false;
    await flushPromises();
    expect((wrapper.vm as any).isLocalSpeaking).toBe(false);

    // 11. Cover alternate icon slot template paths when mute and cameraOff are true
    local.mute = true;
    local.cameraOff = true;
    await flushPromises();

    wrapper.unmount();
  });
});
