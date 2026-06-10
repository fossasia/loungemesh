import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import SessionRecordButton from './SessionRecordButton.vue';

function mountButton(props: Record<string, unknown> = {}) {
  return mount(SessionRecordButton, {
    props: {
      isRecording: false,
      quality: '720p',
      ...props,
    },
  });
}

describe('SessionRecordButton', () => {
  it('renders and emits toggle on click', async () => {
    const wrapper = mountButton({ isRecording: false });
    const btn = wrapper.find('.recordBtn');
    expect(btn.text()).toContain('Rec');
    expect(wrapper.find('.dot').classes()).not.toContain('live');
    expect(btn.classes()).not.toContain('recording');
    
    await btn.trigger('click');
    expect(wrapper.emitted('toggle')).toHaveLength(1);
  });

  it('renders active recording state', () => {
    const wrapper = mountButton({ isRecording: true });
    const btn = wrapper.find('.recordBtn');
    expect(btn.text()).toContain('Stop');
    expect(wrapper.find('.dot').classes()).toContain('live');
    expect(btn.classes()).toContain('recording');
  });

  it('emits quality updates and disables picker when recording', async () => {
    const wrapper = mountButton({ isRecording: false, quality: '720p' });
    const picker = wrapper.find('.qualityPicker');
    expect((picker.element as HTMLSelectElement).value).toBe('720p');
    expect((picker.element as HTMLSelectElement).disabled).toBe(false);

    await picker.setValue('480p');
    expect(wrapper.emitted('update:quality')?.[0]).toEqual(['480p']);

    const wrapperActive = mountButton({ isRecording: true, quality: '720p' });
    const pickerActive = wrapperActive.find('.qualityPicker');
    expect((pickerActive.element as HTMLSelectElement).disabled).toBe(true);
  });
});
