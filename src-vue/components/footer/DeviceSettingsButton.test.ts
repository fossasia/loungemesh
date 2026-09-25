import { describe, it, expect, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import DeviceSettingsButton from './DeviceSettingsButton.vue';

describe('DeviceSettingsButton', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('opens and closes the device panel', async () => {
    const { wrapper } = await mountWithApp(DeviceSettingsButton);
    expect(wrapper.find('[aria-label="Device settings"]').exists()).toBe(true);
    await wrapper.find('[aria-label="Device settings"]').trigger('click');
    await flushPromises();
    expect(wrapper.findComponent({ name: 'DeviceSettingsPanel' }).exists()).toBe(true);
    await wrapper.find('[aria-label="Device settings"]').trigger('click');
    expect(wrapper.findComponent({ name: 'DeviceSettingsPanel' }).exists()).toBe(false);
    await wrapper.find('[aria-label="Device settings"]').trigger('click');
    wrapper.findComponent({ name: 'DeviceSettingsPanel' }).vm.$emit('close');
    await wrapper.vm.$nextTick();
    expect(wrapper.findComponent({ name: 'DeviceSettingsPanel' }).exists()).toBe(false);
    wrapper.unmount();
  });
});
