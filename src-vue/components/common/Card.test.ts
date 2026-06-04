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

  it('renders optional content immediately after the title', async () => {
    const { wrapper } = await mountWithApp(Card, {
      props: { title: 'Chat' },
      slots: { afterTitle: '<button type="button" class="extra">Sound</button>' },
    });
    const row = wrapper.find('.titleRow');
    expect(row.find('.title').text()).toBe('Chat');
    expect(row.find('.extra').exists()).toBe(true);
    wrapper.unmount();
  });
});
