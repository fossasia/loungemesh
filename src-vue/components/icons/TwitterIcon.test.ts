import { describe, it, expect } from 'vitest';
import { mountWithApp } from '@/test/mountApp';
import TwitterIcon from './TwitterIcon.vue';

describe('TwitterIcon', () => {
  it('renders svg markup', async () => {
    const { wrapper } = await mountWithApp(TwitterIcon);
    expect(wrapper.find('svg').exists()).toBe(true);
    wrapper.unmount();
  });
});
