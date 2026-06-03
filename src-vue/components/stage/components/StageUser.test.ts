import { describe, it, expect } from 'vitest';
import { nextTick } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { mountWithApp } from '@/test/mountApp';
import { makeTrack } from '@/test/makeTrack';
import StageUser from './StageUser.vue';

describe('StageUser', () => {
  it('teleports when selected and reacts to volume changes', async () => {
    const track = makeTrack('audio');
    (track as { getOriginalStream?: () => MediaStream }).getOriginalStream = () => ({}) as MediaStream;
    const { wrapper } = await mountWithApp(StageUser, {
      props: { id: 'u1', volume: 0.5, selected: true, audio: track, video: makeTrack('video') },
    });
    await nextTick();
    expect(wrapper.find('.selectedUserContainer').exists()).toBe(true);
    await wrapper.setProps({ volume: 0.9 });
    await flushPromises();
    await wrapper.find('.resizeContainer').trigger('click');
    wrapper.unmount();
  });
});
