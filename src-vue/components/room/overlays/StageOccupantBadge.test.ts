import { describe, expect, it } from 'vitest';
import { mountWithApp } from '@/test/mountApp';
import StageOccupantBadge from './StageOccupantBadge.vue';

describe('StageOccupantBadge', () => {
  it('renders the on-stage label', async () => {
    const { wrapper } = await mountWithApp(StageOccupantBadge);
    expect(wrapper.text()).toContain('Presenter');
    wrapper.unmount();
  });
});
