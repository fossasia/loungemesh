import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import IconButton from './IconButton.vue';

vi.mock('@/utils/uiSounds', () => ({
  playUiSound: vi.fn(),
}));

describe('IconButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('plays the default tap sound on click', async () => {
    const { playUiSound } = await import('@/utils/uiSounds');
    const wrapper = mount(IconButton, {
      props: { label: 'Test' },
      slots: { icon: '<span class="ico">x</span>' },
    });
    await wrapper.trigger('click');
    expect(playUiSound).toHaveBeenCalledWith('tap');
  });

  it('plays a custom sound id', async () => {
    const { playUiSound } = await import('@/utils/uiSounds');
    const wrapper = mount(IconButton, {
      props: { label: 'Hand', sound: 'handRaise' },
      slots: { icon: '<span class="ico">x</span>' },
    });
    await wrapper.trigger('click');
    expect(playUiSound).toHaveBeenCalledWith('handRaise');
  });

  it('skips sound when disabled', async () => {
    const { playUiSound } = await import('@/utils/uiSounds');
    const wrapper = mount(IconButton, {
      props: { label: 'Quiet', sound: false },
      slots: { icon: '<span class="ico">x</span>' },
    });
    await wrapper.trigger('click');
    expect(playUiSound).not.toHaveBeenCalled();
  });

  it('shows an activity dot when requested', () => {
    const wrapper = mount(IconButton, {
      props: { label: 'Chat', activityDot: true },
      slots: { icon: '<span class="ico">x</span>' },
    });
    expect(wrapper.classes()).toContain('hasActivityDot');
  });
});
