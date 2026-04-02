import { describe, it, expect, beforeEach } from 'vitest';
import { nextTick } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import MoreTab from './MoreTab.vue';

describe('MoreTab', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('opens the menu and closes it from MenuCard', async () => {
    const { wrapper } = await mountWithApp(MoreTab);
    await wrapper.find('button.ibtn').trigger('click');
    expect(wrapper.text()).toContain('GitHub');
    await wrapper.find('.close').trigger('click');
    await nextTick();
    expect(wrapper.find('.list').exists()).toBe(false);
    wrapper.unmount();
  });
});
