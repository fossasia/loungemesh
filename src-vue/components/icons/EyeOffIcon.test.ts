import { describe, it, expect } from 'vitest';
import { mountWithApp } from '@/test/mountApp';
import EyeOffIcon from './EyeOffIcon.vue';

describe('EyeOffIcon', () => {
  it('renders svg markup', async () => {
    const { wrapper } = await mountWithApp(EyeOffIcon);
    expect(wrapper.find('svg').exists()).toBe(true);
    wrapper.unmount();
  });
});
