import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
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

  it('labels the local occupant as "You are on stage"', async () => {
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
    expect(wrapper.text()).toContain('On stage');
    wrapper.unmount();
  });

  it('lets audience viewers expand without layout edit rights', async () => {
    await connectAndJoinTestConference();
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    const conference = useConferenceStore();
    local.setMyID('viewer');
    features.stageOccupantId = 'presenter';
    conference.addUser('presenter', { _displayName: 'Presenter' } as never);
    conference.users.presenter.video = makeTrack('video');

    const { wrapper } = await mountWithApp(StagePresentation, {
      props: { mode: 'audience' },
    });
    await flushPromises();
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
    pip.element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
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
});
