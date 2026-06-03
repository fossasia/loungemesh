import { describe, it, expect } from 'vitest';
import { mountWithApp } from '@/test/mountApp';
import MuteIndicator from './MuteIndicator.vue';

describe('MuteIndicator', () => {
  it('renders a mic-off badge for remote users', async () => {
    const { wrapper } = await mountWithApp(MuteIndicator);
    expect(wrapper.find('.muteBadge').exists()).toBe(true);
    expect(wrapper.find('svg').exists()).toBe(true);
    wrapper.unmount();
  });

  it('renders an unmute button when clickable', async () => {
    const { wrapper } = await mountWithApp(MuteIndicator, { props: { clickable: true } });
    expect(wrapper.find('button.muteBtn').attributes('aria-label')).toBe('Unmute');
    wrapper.unmount();
  });
});
