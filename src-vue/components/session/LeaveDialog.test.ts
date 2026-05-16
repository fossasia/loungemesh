import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import LeaveDialog from './LeaveDialog.vue';

function mountDialog(props: Record<string, unknown>) {
  return mount(LeaveDialog, {
    props: {
      isHost: true,
      isRecording: false,
      recordingSupported: true,
      hasRecording: false,
      ...props,
    },
  });
}

describe('LeaveDialog', () => {
  it('shows export options and emits each action for hosts', async () => {
    const wrapper = mountDialog({ hasRecording: true });
    const buttons = wrapper.findAll('.export');
    expect(buttons).toHaveLength(3);
    await buttons[0].trigger('click');
    await buttons[1].trigger('click');
    await buttons[2].trigger('click');
    await wrapper.find('.record').trigger('click');
    await wrapper.find('.btn.leave').trigger('click');
    await wrapper.find('.btn.cancel').trigger('click');
    expect(wrapper.emitted('export-notes')).toHaveLength(1);
    expect(wrapper.emitted('export-whiteboard')).toHaveLength(1);
    expect(wrapper.emitted('export-recording')).toHaveLength(1);
    expect(wrapper.emitted('toggle-recording')).toHaveLength(1);
    expect(wrapper.emitted('leave')).toHaveLength(1);
    expect(wrapper.emitted('cancel')).toHaveLength(1);
  });

  it('disables the recording download until a recording exists', () => {
    const wrapper = mountDialog({ hasRecording: false });
    const recordingBtn = wrapper.findAll('.export')[2];
    expect((recordingBtn.element as HTMLButtonElement).disabled).toBe(true);
  });

  it('hides recording controls when recording is unsupported', () => {
    const wrapper = mountDialog({ recordingSupported: false });
    expect(wrapper.findAll('.export')).toHaveLength(2);
    expect(wrapper.find('.record').exists()).toBe(false);
  });

  it('shows the live recording state', () => {
    const wrapper = mountDialog({ isRecording: true });
    expect(wrapper.find('.dot.live').exists()).toBe(true);
    expect(wrapper.find('.record').text()).toContain('Stop recording');
  });

  it('emits cancel when the backdrop is clicked', async () => {
    const wrapper = mountDialog({});
    await wrapper.find('.leaveBackdrop').trigger('click');
    expect(wrapper.emitted('cancel')).toHaveLength(1);
  });

  it('shows a simple confirmation for non-hosts', () => {
    const wrapper = mountDialog({ isHost: false });
    expect(wrapper.findAll('.export')).toHaveLength(0);
    expect(wrapper.find('.sub').text()).toContain('disconnected');
  });
});
