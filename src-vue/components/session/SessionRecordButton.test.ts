import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import SessionRecordButton from './SessionRecordButton.vue';

describe('SessionRecordButton', () => {
  it('shows the record label and emits toggle on click', async () => {
    const wrapper = mount(SessionRecordButton, { props: { isRecording: false } });
    expect(wrapper.find('[aria-label="Record session"]').exists()).toBe(true);
    await wrapper.find('.ibtn').trigger('click');
    expect(wrapper.emitted('toggle')).toHaveLength(1);
  });

  it('shows the stop label while recording', () => {
    const wrapper = mount(SessionRecordButton, { props: { isRecording: true } });
    expect(wrapper.find('[aria-label="Stop recording"]').exists()).toBe(true);
    expect(wrapper.find('.recordIcon.live').exists()).toBe(true);
  });
});
