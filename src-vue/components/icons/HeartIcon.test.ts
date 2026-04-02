import { describe, it, expect } from 'vitest';
import { mountWithApp } from '@/test/mountApp';
import HeartIcon from './HeartIcon.vue';

describe('HeartIcon', () => {
  it('renders svg markup', async () => {
    const { wrapper } = await mountWithApp(HeartIcon);
    expect(wrapper.find('svg').exists()).toBe(true);
    wrapper.unmount();
  });
});
