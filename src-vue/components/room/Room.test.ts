import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import Room from './Room.vue';

describe('Room', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('sizes the room from store bounds', async () => {
    const { wrapper } = await mountWithApp(Room, { props: { identifier: 'evt-1' } });
    const style = wrapper.find('.room').attributes('style');
    expect(style).toContain('width:');
    expect(style).toContain('height:');
    wrapper.unmount();
  });

  it('uses a transparent canvas so the viewport wallpaper shows through', async () => {
    const { wrapper } = await mountWithApp(Room);
    expect(wrapper.find('.room').attributes('style')).not.toContain('url(');
    wrapper.unmount();
  });
});
