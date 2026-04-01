import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { makeTrack } from '@/test/makeTrack';
import StagePanel from './StagePanel.vue';

describe('StagePanel', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('ignores users not marked for the stage', async () => {
    const conference = useConferenceStore();
    conference.addUser('on-stage');
    conference.users['on-stage'].properties = { onStage: 'true' };
    conference.addUser('off-stage');
    conference.users['off-stage'].properties = { onStage: false };
    conference.addUser('no-props');
    conference.users['no-props'].properties = undefined as never;
    const { wrapper } = await mountWithApp(StagePanel);
    expect(wrapper.find('.scroll').exists()).toBe(true);
    expect(wrapper.findAllComponents({ name: 'StageUser' }).length).toBe(1);
    wrapper.unmount();
  });

  it('shows remote stage users with boolean onStage and desktop video', async () => {
    const conference = useConferenceStore();
    const local = useLocalStore();
    local.onStage = false;
    conference.addUser('remote-bool');
    conference.users['remote-bool'].properties = { onStage: true };
    conference.users['remote-bool'].video = makeTrack('video', 'remote-bool');
    conference.users['remote-bool'].videoType = 'desktop';

    const { wrapper } = await mountWithApp(StagePanel);
    expect(wrapper.find('.scroll').exists()).toBe(true);
    expect(wrapper.findAllComponents({ name: 'StageUser' }).length).toBeGreaterThan(0);
    wrapper.unmount();
  });

  it('renders local camera and non-camera stage video', async () => {
    const local = useLocalStore();
    local.onStage = true;
    local.stageVisible = true;
    local.video = makeTrack('video');
    local.videoType = 'camera';

    const { wrapper } = await mountWithApp(StagePanel);
    expect(wrapper.find('.userContainer').exists()).toBe(true);

    local.videoType = 'desktop';
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.userContainer').exists()).toBe(true);
    wrapper.unmount();
  });

  it('toggles stage visibility and mute controls', async () => {
    const conference = useConferenceStore();
    const local = useLocalStore();
    local.onStage = true;
    local.stageVisible = false;
    local.stageMute = false;
    local.video = makeTrack('video');
    conference.addUser('u-stage');
    conference.users['u-stage'].properties = { onStage: 'true' };
    conference.users['u-stage'].video = makeTrack('video', 'u-stage');
    conference.users['u-stage'].audio = makeTrack('audio', 'u-stage');

    const { wrapper } = await mountWithApp(StagePanel);
    const clickLabel = async (label: string) => {
      for (const btn of wrapper.findAll('button.ibtn')) {
        if (btn.find('.sr-only').text() === label) {
          await btn.trigger('click');
          return;
        }
      }
      throw new Error(`missing button: ${label}`);
    };
    await clickLabel('show');
    expect(local.stageVisible).toBe(true);
    await clickLabel('mute');
    expect(local.stageMute).toBe(true);
    await clickLabel('unmute');
    await clickLabel('hide');
    expect(local.stageVisible).toBe(false);
    wrapper.unmount();
  });
});
