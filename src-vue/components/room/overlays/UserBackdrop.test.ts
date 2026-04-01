import { describe, it, expect } from 'vitest';
import { mountWithApp } from '@/test/mountApp';
import UserBackdrop from './UserBackdrop.vue';

describe('UserBackdrop', () => {
  it('shows presenting state when on stage', async () => {
    const { wrapper } = await mountWithApp(UserBackdrop, { props: { onStage: true } });
    expect(wrapper.text()).toContain('Presenting');
    wrapper.unmount();
  });

  it('shows reload hint when not on stage', async () => {
    const { wrapper } = await mountWithApp(UserBackdrop, { props: { onStage: false } });
    expect(wrapper.text()).toContain('reload');
    wrapper.unmount();
  });
});
