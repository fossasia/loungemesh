import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mountWithApp } from '@/test/mountApp';
import NotFoundPage from './NotFoundPage.vue';

vi.mock('@/utils/uiSounds', () => ({
  playUiSound: vi.fn(),
}));

describe('NotFoundPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders 404 text and triggers sound on button click', async () => {
    const { playUiSound } = await import('@/utils/uiSounds');
    const { wrapper } = await mountWithApp(NotFoundPage);

    expect(wrapper.text()).toContain('404 - Space Not Found');
    const btn = wrapper.find('.notfound-btn');
    expect(btn.exists()).toBe(true);

    await btn.trigger('click');
    expect(playUiSound).toHaveBeenCalledWith('tap');

    wrapper.unmount();
  });
});
