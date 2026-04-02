import { describe, it, expect } from 'vitest';
import { mountWithApp } from '@/test/mountApp';
import VolumeXIcon from './VolumeXIcon.vue';

describe('VolumeXIcon', () => {
  it('renders svg markup', async () => {
    const { wrapper } = await mountWithApp(VolumeXIcon);
    expect(wrapper.find('svg').exists()).toBe(true);
    wrapper.unmount();
  });
});
