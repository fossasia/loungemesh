import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { triggerLastResizeObserver } from '@/test/setup';
import EmojiPickerPanel from './EmojiPickerPanel.vue';

vi.mock('emoji-mart-vue-fast/src', () => ({
  EmojiIndex: class MockEmojiIndex {},
  Picker: {
    name: 'Picker',
    props: [
      'data',
      'native',
      'perLine',
      'emojiSize',
      'showPreview',
      'showSkinTones',
      'title',
      'pickerStyles',
    ],
    emits: ['select'],
    template:
      '<button type="button" class="pickerStub" @click="$emit(\'select\', { native: \'🎉\' })">pick</button>',
  },
}));

vi.mock('emoji-mart-vue-fast/css/emoji-mart.css', () => ({}));

describe('EmojiPickerPanel', () => {
  it('emits native emoji on select', async () => {
    const wrapper = mount(EmojiPickerPanel, { attachTo: document.body });
    await wrapper.find('.pickerStub').trigger('click');
    expect(wrapper.emitted('select')?.[0]).toEqual(['🎉']);
    wrapper.unmount();
  });

  it('sizes per line from container width', async () => {
    const wrapper = mount(EmojiPickerPanel, { attachTo: document.body });
    Object.defineProperty(wrapper.element, 'clientWidth', {
      configurable: true,
      value: 360,
    });
    triggerLastResizeObserver(360);
    await wrapper.vm.$nextTick();
    const picker = wrapper.findComponent({ name: 'Picker' });
    expect(picker.props('perLine')).toBe(9);
    expect(picker.props('pickerStyles')).toEqual({ width: '100%', maxWidth: '100%' });
    wrapper.unmount();
  });

  it('passes custom layout props to the picker', () => {
    const wrapper = mount(EmojiPickerPanel, {
      props: {
        emojiSize: 28,
        minPerLine: 5,
        maxPerLine: 8,
        showPreview: true,
        showSkinTones: false,
      },
      attachTo: document.body,
    });
    const picker = wrapper.findComponent({ name: 'Picker' });
    expect(picker.props('emojiSize')).toBe(28);
    expect(picker.props('showPreview')).toBe(true);
    expect(picker.props('showSkinTones')).toBe(false);
    expect(picker.props('native')).toBe('');
    wrapper.unmount();
  });

  it('falls back to element clientWidth when resize entries are empty', async () => {
    const wrapper = mount(EmojiPickerPanel, { attachTo: document.body });
    Object.defineProperty(wrapper.element, 'clientWidth', {
      configurable: true,
      value: 400,
    });
    triggerLastResizeObserver();
    await wrapper.vm.$nextTick();
    expect(wrapper.findComponent({ name: 'Picker' }).props('perLine')).toBe(10);
    wrapper.unmount();
  });

  it('disconnects resize observer on unmount', () => {
    const wrapper = mount(EmojiPickerPanel, { attachTo: document.body });
    const disconnect = vi.spyOn(
      (globalThis as { __lastResizeObserver?: { disconnect: () => void } }).__lastResizeObserver!,
      'disconnect',
    );
    wrapper.unmount();
    expect(disconnect).toHaveBeenCalled();
  });
});
