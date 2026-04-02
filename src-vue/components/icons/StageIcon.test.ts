import { describe, it, expect } from 'vitest';
import { mountWithApp } from '@/test/mountApp';
import StageIcon from './StageIcon.vue';

describe('StageIcon', () => {
  it('renders svg markup', async () => {
    const { wrapper } = await mountWithApp(StageIcon);
    expect(wrapper.find('svg').exists()).toBe(true);
    wrapper.unmount();
  });
});
