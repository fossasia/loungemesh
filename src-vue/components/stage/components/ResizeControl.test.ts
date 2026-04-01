import { describe, it, expect, vi } from 'vitest';
import { mountWithApp } from '@/test/mountApp';
import ResizeControl from './ResizeControl.vue';

describe('ResizeControl', () => {
  it('invokes onClick when clicked', async () => {
    const onClick = vi.fn();
    const { wrapper } = await mountWithApp(ResizeControl, { props: { onClick } });
    await wrapper.find('.resizeContainer').trigger('click');
    expect(onClick).toHaveBeenCalled();
    wrapper.unmount();
  });
});
