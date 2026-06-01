import { describe, it, expect, vi } from 'vitest';
import { mountWithApp } from '@/test/mountApp';
import Card from './Card.vue';

describe('Card', () => {
  it('calls onClose when close is clicked', async () => {
    const onClose = vi.fn();
    const { wrapper } = await mountWithApp(Card, { props: { title: 'T', onClose } });
    await wrapper.find('.close').trigger('click');
    expect(onClose).toHaveBeenCalled();
    wrapper.unmount();
  });
});
