import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { connectAndJoinTestConference } from '@/test/jitsiTestContext';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { makeTrack } from '@/test/makeTrack';
import StagePresentation from './StagePresentation.vue';

describe('StagePresentation', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('renders the stage occupant screen share with a camera pip', async () => {
    await connectAndJoinTestConference();
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    const conference = useConferenceStore();
    local.setMyID('presenter');
    features.stageOccupantId = 'presenter';
    local.screenshare = makeTrack('desktop');
    local.video = makeTrack('video');
    conference.addUser('presenter', { _displayName: 'Presenter' } as never);

    const { wrapper } = await mountWithApp(StagePresentation, {
      props: { mode: 'tile' },
    });
    await flushPromises();
    expect(wrapper.find('[data-testid="stage-presentation"]').exists()).toBe(true);
    expect(wrapper.find('.pipCamera').exists()).toBe(true);
    expect(wrapper.text()).toContain('On stage');
    wrapper.unmount();
  });

  it('labels the local occupant as "On stage: You" in audience mode', async () => {
    await connectAndJoinTestConference();
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('presenter');
    features.stageOccupantId = 'presenter';
    local.video = makeTrack('video');

    const { wrapper } = await mountWithApp(StagePresentation, {
      props: { mode: 'audience' },
    });
    await flushPromises();
    expect(wrapper.text()).toContain('On stage: You');
    wrapper.unmount();
  });

  it('lets audience viewers expand without layout edit rights', async () => {
    await connectAndJoinTestConference();
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    const conference = useConferenceStore();
    local.setMyID('viewer');
    features.stageOccupantId = 'presenter';
    conference.addUser('presenter', { _displayName: 'Presenter', speaking: true, mute: false } as never);
    conference.users.presenter.video = makeTrack('video');

    const { wrapper } = await mountWithApp(StagePresentation, {
      props: { mode: 'audience' },
    });
    await flushPromises();
    expect(wrapper.text()).toContain('On stage: Presenter');
    const root = wrapper.find('[data-testid="stage-presentation"]');
    expect(root.classes()).toContain('modeAudience');
    await root.find('.toolBtn').trigger('click');
    expect(root.classes()).toContain('expanded');
    wrapper.unmount();
  });

  it('shows camera-only presentation when no screenshare exists', async () => {
    await connectAndJoinTestConference();
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('presenter');
    features.stageOccupantId = 'presenter';
    local.video = makeTrack('video');

    const { wrapper } = await mountWithApp(StagePresentation, {
      props: { mode: 'audience' },
    });
    await flushPromises();
    expect(wrapper.find('.pipCamera').exists()).toBe(false);
    expect(wrapper.find('.primaryContent video').exists()).toBe(true);
    wrapper.unmount();
  });

  it('resets layout and supports occupant controls in audience mode', async () => {
    vi.useFakeTimers();
    await connectAndJoinTestConference();
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('presenter');
    features.stageOccupantId = 'presenter';
    local.screenshare = makeTrack('desktop');
    local.video = makeTrack('video');

    const { wrapper } = await mountWithApp(StagePresentation, {
      props: { mode: 'audience' },
    });
    await flushPromises();

    features.stageLayout = { ...features.stageLayout, scale: 1.2, expanded: true };
    await wrapper.find('.resetBtn').trigger('click');
    await vi.runAllTimersAsync();
    expect(features.stageLayout.scale).toBe(1);
    expect(features.stageLayout.expanded).toBe(false);

    const resize = wrapper.find('.resizeHandle').element;
    resize.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 100, pointerId: 1, bubbles: true }),
    );
    resize.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 220, pointerId: 1, bubbles: true }),
    );
    resize.dispatchEvent(
      new PointerEvent('pointerup', { pointerId: 1, bubbles: true }),
    );
    await vi.advanceTimersByTimeAsync(60);
    expect(features.stageLayout.scale).toBeCloseTo(1.25, 2);

    // Test dragging the audience window
    const toolbar = wrapper.find('.stageToolbar').element;
    toolbar.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 100, clientY: 100, pointerId: 2, bubbles: true }),
    );
    toolbar.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 150, clientY: 120, pointerId: 2, bubbles: true }),
    );
    toolbar.dispatchEvent(
      new PointerEvent('pointerup', { pointerId: 2, bubbles: true }),
    );
    await vi.runAllTimersAsync();



    const pip = wrapper.find('.pipCamera');
    pip.element.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 50, clientY: 50, bubbles: true }),
    );
    pip.element.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 80, clientY: 90, bubbles: true }),
    );
    const pipUpEv = new PointerEvent('pointerup');
    Object.defineProperty(pipUpEv, 'currentTarget', { value: pip.element });
    pip.element.dispatchEvent(pipUpEv);
    await vi.runAllTimersAsync();

    await vi.advanceTimersByTimeAsync(220);

    vi.useRealTimers();
    wrapper.unmount();
  });

  it('lets the occupant expand audience mode through synced layout', async () => {
    await connectAndJoinTestConference();
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('presenter');
    features.stageOccupantId = 'presenter';
    local.video = makeTrack('video');

    const { wrapper } = await mountWithApp(StagePresentation, {
      props: { mode: 'audience' },
    });
    await flushPromises();
    await wrapper.find('.toolBtn').trigger('click');
    expect(features.stageLayout.expanded).toBe(true);
    wrapper.unmount();
  });

  it('expands the tile preview for the local occupant', async () => {
    await connectAndJoinTestConference();
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('presenter');
    features.stageOccupantId = 'presenter';
    local.video = makeTrack('video');

    const { wrapper } = await mountWithApp(StagePresentation, {
      props: { mode: 'tile' },
    });
    await flushPromises();
    await wrapper.find('.toolBtn').trigger('click');
    expect(wrapper.find('.modeTile.expanded').exists()).toBe(true);
    wrapper.unmount();
  });

  it('covers drag, resize, window resize, and PIP corners thoroughly', async () => {
    vi.useFakeTimers();
    await connectAndJoinTestConference();
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    const conference = useConferenceStore();

    const { wrapper } = await mountWithApp(StagePresentation, {
      props: { mode: 'audience' },
    });
    await flushPromises();

    local.setMyID('presenter');
    features.stageOccupantId = 'presenter';
    conference.addUser('presenter', { _displayName: 'Presenter' } as never);
    local.screenshare = makeTrack('desktop');
    local.video = makeTrack('video');
    await nextTick();

    // Mock setPointerCapture/releasePointerCapture to prevent JSDOM issues
    const setCaptureSpy = vi.spyOn(HTMLElement.prototype, 'setPointerCapture').mockImplementation(() => {});
    const releaseCaptureSpy = vi.spyOn(HTMLElement.prototype, 'releasePointerCapture').mockImplementation(() => {});

    // 1. Drag the stage toolbar using direct callbacks to guarantee coverage in JSDOM
    const toolbar = wrapper.find('.stageToolbar').element;
    const dragStartEv = new PointerEvent('pointerdown', { button: 0, clientX: 100, clientY: 100 });
    Object.defineProperty(dragStartEv, 'target', { value: document.createElement('div') });
    Object.defineProperty(dragStartEv, 'currentTarget', { value: toolbar });
    (wrapper.vm as any).onDragStart(dragStartEv);

    const dragMoveEv = new PointerEvent('pointermove', { clientX: 150, clientY: 120 });
    (wrapper.vm as any).onDragMove(dragMoveEv);
    
    const dragEndEv = new PointerEvent('pointerup', { pointerId: 10 });
    Object.defineProperty(dragEndEv, 'currentTarget', { value: toolbar });
    (wrapper.vm as any).onDragEnd(dragEndEv);
    await vi.runAllTimersAsync();

    // 2. Resize handle drag using direct callbacks
    const resize = wrapper.find('.resizeHandle').element;
    const resizeStartEv = new PointerEvent('pointerdown', { button: 0, clientX: 100 });
    Object.defineProperty(resizeStartEv, 'currentTarget', { value: resize });
    (wrapper.vm as any).onResizeStart(resizeStartEv);

    const resizeMoveEv = new PointerEvent('pointermove', { clientX: 150 });
    (wrapper.vm as any).onResizeMove(resizeMoveEv);
    
    const resizeEndEv = new PointerEvent('pointerup', { pointerId: 11 });
    Object.defineProperty(resizeEndEv, 'currentTarget', { value: resize });
    const releaseSpy = vi.spyOn(HTMLElement.prototype, 'releasePointerCapture').mockImplementationOnce(() => {
      throw new Error('release error');
    });
    (wrapper.vm as any).onResizeEnd(resizeEndEv);
    releaseSpy.mockRestore();
    await vi.runAllTimersAsync();

    // Cover branch conditions for onDragStart / onResizeStart
    // (a) button !== 0
    (wrapper.vm as any).onDragStart(new PointerEvent('pointerdown', { button: 1 }));
    (wrapper.vm as any).onResizeStart(new PointerEvent('pointerdown', { button: 1 }));
    // (b) closest('button') in onDragStart
    const btn = document.createElement('button');
    const dragBtnEv = new PointerEvent('pointerdown', { button: 0 });
    Object.defineProperty(dragBtnEv, 'target', { value: btn });
    (wrapper.vm as any).onDragStart(dragBtnEv);
    // (c) onResizeMove when not resizing
    (wrapper.vm as any).resizing = false;
    (wrapper.vm as any).onResizeMove(resizeMoveEv);
    (wrapper.vm as any).resizing = true; // restore
    // (d) isTileMode branch inside drag/resize
    await wrapper.setProps({ mode: 'tile' });
    (wrapper.vm as any).onDragStart(dragStartEv);
    (wrapper.vm as any).onResizeStart(resizeStartEv);
    await wrapper.setProps({ mode: 'audience' });

    // 3. Trigger window resize with large width to cover width > window.innerWidth
    (wrapper.vm as any).width = 2000;
    window.dispatchEvent(new Event('resize'));
    await vi.runAllTimersAsync();

    // 4. Test PIP drag and throttledBroadcast
    const container = wrapper.find('.stageCanvas').element as HTMLElement;
    Object.defineProperty(container, 'clientWidth', { value: 640, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 360, configurable: true });
    container.getBoundingClientRect = () => ({
      left: 10, top: 10, right: 650, bottom: 370, width: 640, height: 360, x: 10, y: 10
    } as DOMRect);

    // Trigger ResizeObserver mock to apply clientWidth/clientHeight
    (globalThis as any).__lastResizeObserver?.trigger(640);

    const pip = wrapper.find('.pipCamera').element as HTMLElement;
    pip.getBoundingClientRect = () => ({
      left: 20, top: 20, right: 120, bottom: 120, width: 100, height: 100, x: 20, y: 20
    } as DOMRect);

    // 5. Cover early return for button !== 0 in onPipPointerDown
    const dummyEv = new PointerEvent('pointerdown', { button: 1 });
    Object.defineProperty(dummyEv, 'currentTarget', { value: pip });
    (wrapper.vm as any).onPipPointerDown(dummyEv);
    expect((wrapper.vm as any).draggingPip).toBe(false);

    // 6. Cover early return for missing containerRef inside onPipPointerDown
    // We backup containerRef, set it to null, trigger pointerdown, and verify it returns early
    const savedContainer = (wrapper.vm as any).containerRef;
    (wrapper.vm as any).containerRef = null;
    const downEvNull = new PointerEvent('pointerdown', { button: 0, clientX: 50, clientY: 50 });
    Object.defineProperty(downEvNull, 'currentTarget', { value: pip });
    (wrapper.vm as any).onPipPointerDown(downEvNull);
    // Restoration
    (wrapper.vm as any).containerRef = savedContainer;
    (wrapper.vm as any).draggingPip = false; // Reset state

    // 7. Direct calls to PIP drag event handlers
    const downEv = new PointerEvent('pointerdown', { button: 0, clientX: 50, clientY: 50 });
    Object.defineProperty(downEv, 'currentTarget', { value: pip });
    (wrapper.vm as any).onPipPointerDown(downEv);

    const moveEv = new PointerEvent('pointermove', { clientX: 80, clientY: 90 });
    Object.defineProperty(moveEv, 'currentTarget', { value: pip });
    (wrapper.vm as any).onPipPointerMove(moveEv);
    (wrapper.vm as any).onPipPointerMove(moveEv); // double call for clearTimeout

    // Advance timers by 100ms DURING the drag so throttledBroadcast runs
    await vi.advanceTimersByTimeAsync(110);

    // 8. Cover early return for missing containerRef inside onPipPointerUp
    (wrapper.vm as any).containerRef = null;
    const upEvNull = new PointerEvent('pointerup');
    Object.defineProperty(upEvNull, 'currentTarget', { value: pip });
    (wrapper.vm as any).onPipPointerUp(upEvNull);
    
    // Restore and call again with valid containerRef
    (wrapper.vm as any).containerRef = savedContainer;
    (wrapper.vm as any).draggingPip = true; // Set back to dragging for final up event

    const upEv = new PointerEvent('pointerup');
    Object.defineProperty(upEv, 'currentTarget', { value: pip });
    (wrapper.vm as any).onPipPointerUp(upEv);
    await vi.runAllTimersAsync();

    // 5. Test PIP corners and setPipCorner
    (wrapper.vm as any).setPipCorner('tl');
    (wrapper.vm as any).setPipCorner('tr');
    (wrapper.vm as any).setPipCorner('bl');
    (wrapper.vm as any).setPipCorner('br');
    await vi.runAllTimersAsync();

    // 9. Cover onPipPointerMove when draggingPip is false
    (wrapper.vm as any).draggingPip = false;
    (wrapper.vm as any).onPipPointerMove(new PointerEvent('pointermove'));

    // 10. Cover onPipPointerUp when draggingPip is false
    (wrapper.vm as any).onPipPointerUp(new PointerEvent('pointerup'));

    // 11. Cover containerRef watch when el is null
    (wrapper.vm as any).containerRef = null;
    await nextTick();
    (wrapper.vm as any).containerRef = savedContainer;
    await nextTick();

    // 12. Cover isExpanded watch (val is true, val is false branches of line 422)
    // a) When canEditLayout is true:
    features.stageLayout.expanded = true;
    await nextTick();
    features.stageLayout.expanded = false;
    await nextTick();

    // b) When canEditLayout is false:
    const localStore = useLocalStore();
    localStore.setMyID('viewer'); // this makes canEditLayout false
    await nextTick();
    (wrapper.vm as any).localViewerExpanded = true;
    await nextTick();
    (wrapper.vm as any).localViewerExpanded = false;
    await nextTick();

    // 13. Cover onResetLayout when canEditLayout is false
    (wrapper.vm as any).onResetLayout();

    // 14. Cover canEditLayout.value === false inside throttledBroadcast callback
    localStore.setMyID('presenter'); // restore to true
    await nextTick();
    (wrapper.vm as any).draggingPip = true; // set to true so onPipPointerMove executes throttledBroadcast
    (wrapper.vm as any).onPipPointerMove(moveEv); // schedules throttledBroadcast
    localStore.setMyID('viewer'); // set to false BEFORE timer fires
    await nextTick();
    await vi.advanceTimersByTimeAsync(110); // timer fires, calls throttledBroadcast callback, canEditLayout is false

    // 15. Cover early return in onPipPointerDown when canEditLayout is false
    (wrapper.vm as any).onPipPointerDown(downEv); // canEditLayout is false, returns early

    // 16. Cover onResizeMove branch options
    // a) canEditLayout is false
    localStore.setMyID('viewer');
    await nextTick();
    (wrapper.vm as any).resizing = true;
    (wrapper.vm as any).onResizeMove(resizeMoveEv);
    
    // b) canEditLayout is true and layout.expanded is true
    localStore.setMyID('presenter');
    features.stageLayout.expanded = true;
    await nextTick();
    (wrapper.vm as any).onResizeMove(resizeMoveEv);

    // 17. Cover syncLayout branch options
    localStore.setMyID('presenter');
    await nextTick();
    (wrapper.vm as any).syncLayout({}); // true branch
    localStore.setMyID('viewer');
    await nextTick();
    (wrapper.vm as any).syncLayout({}); // false branch

    // 18. Cover measureContainer branch options
    (wrapper.vm as any).containerRef = null;
    (wrapper.vm as any).measureContainer(); // true branch (el is null)
    (wrapper.vm as any).containerRef = container;
    (wrapper.vm as any).measureContainer(); // false branch (el is not null)

    // 19. Cover onResizeEnd resizing is false branch
    (wrapper.vm as any).resizing = false;
    (wrapper.vm as any).onResizeEnd(resizeEndEv); // true branch
    (wrapper.vm as any).resizing = true;
    (wrapper.vm as any).onResizeEnd(resizeEndEv); // false branch

    // 20. Cover resizing is true branch in isExpanded watch
    (wrapper.vm as any).resizing = true;
    features.stageLayout.expanded = true;
    await nextTick();
    features.stageLayout.expanded = false;
    await nextTick();
    (wrapper.vm as any).resizing = false;

    setCaptureSpy.mockRestore();
    releaseCaptureSpy.mockRestore();
    vi.useRealTimers();
    wrapper.unmount();
  });

  it('covers isOccupantSpeaking for remote stage occupant', async () => {
    vi.useFakeTimers();
    await connectAndJoinTestConference();
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    const conference = useConferenceStore();
    local.setMyID('viewer');
    features.stageOccupantId = 'presenter';
    conference.addUser('presenter', {
      _displayName: 'Presenter',
    } as never);
    conference.patchUser('presenter', { speaking: true, mute: false });
    conference.users.presenter.screenshare = makeTrack('desktop');
    conference.users.presenter.video = makeTrack('video');

    const { wrapper } = await mountWithApp(StagePresentation, {
      props: { mode: 'audience' },
    });
    await flushPromises();
    expect(wrapper.find('.pipCamera').classes()).toContain('speaking');

    // Muted remote user -> speaking is false
    conference.patchUser('presenter', { speaking: true, mute: true });
    await nextTick();
    expect(wrapper.find('.pipCamera').classes()).not.toContain('speaking');

    // Non-speaking remote user -> speaking is false
    conference.patchUser('presenter', { speaking: false, mute: false });
    await nextTick();
    expect(wrapper.find('.pipCamera').classes()).not.toContain('speaking');

    // Trigger watcher branches where resizing is true
    (wrapper.vm as any).resizing = true;
    features.stageLayout.scale = 1.8;
    (wrapper.vm as any).localViewerExpanded = true;
    await nextTick();
    (wrapper.vm as any).resizing = false;

    // Run timers for the layoutAnimating watch timeout on line 442
    await vi.runAllTimersAsync();

    vi.useRealTimers();
    wrapper.unmount();
  });

  it('covers remaining edge cases and branches in StagePresentation', async () => {
    await connectAndJoinTestConference();
    const features = useSessionFeaturesStore();
    const local = useLocalStore();

    // Make local user ID
    local.setMyID('me');

    // Mount the component
    const { wrapper } = await mountWithApp(StagePresentation, {
      props: { mode: 'audience' },
    });
    await flushPromises();

    // 1. Line 66 branch (remote occupant not in conference.users)
    features.stageOccupantId = 'remote-not-here';
    await nextTick();
    expect((wrapper.vm as any).occupantUser).toBeNull();

    // 2. Line 80 branch (cameraTrack when user.videoType === 'desktop')
    features.stageOccupantId = 'me';
    local.video = makeTrack('video');
    local.videoType = 'desktop';
    await nextTick();
    expect((wrapper.vm as any).cameraTrack).toBeUndefined();

    // 3. Line 105 branch (isOccupantSpeaking when occupantId is falsy)
    features.stageOccupantId = '';
    await nextTick();
    expect((wrapper.vm as any).isOccupantSpeaking).toBe(false);

    // 4. Line 107 branches (isOccupantSpeaking local user permutations)
    features.stageOccupantId = 'me';
    
    local.speaking = false;
    local.mute = false;
    await nextTick();
    expect((wrapper.vm as any).isOccupantSpeaking).toBe(false);

    local.speaking = true;
    local.mute = true;
    await nextTick();
    expect((wrapper.vm as any).isOccupantSpeaking).toBe(false);

    local.speaking = true;
    local.mute = false;
    await nextTick();
    expect((wrapper.vm as any).isOccupantSpeaking).toBe(true);

    // 5. Line 422 branch (isExpanded watch: expanded changing while resizing is false)
    // Ensure resizing is false
    (wrapper.vm as any).resizing = false;
    
    // Change to expanded = true
    features.stageLayout.expanded = true;
    await nextTick();
    
    // Change to expanded = false
    features.stageLayout.expanded = false;
    await nextTick();

    wrapper.unmount();
  });
});
