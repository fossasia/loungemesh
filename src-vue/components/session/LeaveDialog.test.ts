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
      quality: '720p' as const,
      ...props,
    },
    global: {
      // Teleport renders inline in tests
      stubs: { Teleport: true, Transition: false },
    },
  });
}

describe('LeaveDialog', () => {
  it('shows export options and emits each action for hosts', async () => {
    const wrapper = mountDialog({ hasRecording: true });
    const buttons = wrapper.findAll('.export');
    expect(buttons).toHaveLength(4);
    await buttons[0].trigger('click');
    await buttons[1].trigger('click');
    await buttons[2].trigger('click');
    await buttons[3].trigger('click');
    await wrapper.find('.btn.leave').trigger('click');
    await wrapper.find('.btn.cancel').trigger('click');
    expect(wrapper.emitted('export-notes')).toHaveLength(1);
    expect(wrapper.emitted('export-notes-rtf')).toHaveLength(1);
    expect(wrapper.emitted('export-whiteboard')).toHaveLength(1);
    expect(wrapper.emitted('export-recording')).toHaveLength(1);
    expect(wrapper.emitted('leave')).toHaveLength(1);
    expect(wrapper.emitted('cancel')).toHaveLength(1);
  });

  it('disables the recording download until a recording exists', () => {
    const wrapper = mountDialog({ hasRecording: false });
    const recordingBtn = wrapper.findAll('.export')[3];
    expect((recordingBtn.element as HTMLButtonElement).disabled).toBe(true);
  });

  it('hides the recording export when recording is unsupported', () => {
    const wrapper = mountDialog({ recordingSupported: false });
    expect(wrapper.findAll('.export')).toHaveLength(3);
  });

  it('shows LIVE pill on the recording export button while recording is active', () => {
    const wrapper = mountDialog({ isRecording: true, recordingSupported: true });
    expect(wrapper.find('.livePill').exists()).toBe(true);
  });

  it('shows .mp4 extension on the recording download button', () => {
    const wrapper = mountDialog({ hasRecording: true });
    const exts = wrapper.findAll('.ext');
    expect(exts[exts.length - 1].text()).toBe('.mp4');
  });

  it('emits cancel when the backdrop is clicked', async () => {
    const wrapper = mountDialog({});
    await wrapper.find('.leaveBackdrop').trigger('click');
    expect(wrapper.emitted('cancel')).toHaveLength(1);
  });

  it('shows a simple confirmation for non-hosts', () => {
    const wrapper = mountDialog({ isHost: false });
    expect(wrapper.findAll('.export')).toHaveLength(0);
    expect(wrapper.find('.sub').text()).toContain('removed');
  });

  it('emits leave on the leave button', async () => {
    const wrapper = mountDialog({});
    await wrapper.find('.btn.leave').trigger('click');
    expect(wrapper.emitted('leave')).toHaveLength(1);
  });

  it('covers the implicit else branch of onExport', () => {
    const wrapper = mountDialog({});
    (wrapper.vm as any).onExport('unknown');
  });
});
