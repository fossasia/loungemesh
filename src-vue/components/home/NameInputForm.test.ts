import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { conferenceNameDefault } from '@/config/jitsiOptions';
import NameInputForm from './NameInputForm.vue';

describe('NameInputForm', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('emits display name and trimmed session name', async () => {
    const { wrapper } = await mountWithApp(NameInputForm);
    const inputs = wrapper.findAll('input[type="text"]');
    await inputs[0].setValue('Alex');
    await inputs[1].setValue('  my-room  ');
    await wrapper.find('form').trigger('submit');
    expect(wrapper.emitted('submit')?.[0]).toEqual([
      { displayName: 'Alex', sessionName: 'my-room' },
    ]);
    wrapper.unmount();
  });

  it('does not emit when session name is empty after trim', async () => {
    const { wrapper } = await mountWithApp(NameInputForm);
    const inputs = wrapper.findAll('input[type="text"]');
    await inputs[1].setValue('   ');
    await wrapper.find('form').trigger('submit');
    expect(wrapper.emitted('submit')).toBeUndefined();
    wrapper.unmount();
  });

  it('emits default session name when room input is empty', async () => {
    const { wrapper } = await mountWithApp(NameInputForm);
    await wrapper.find('form').trigger('submit');
    expect(wrapper.emitted('submit')?.[0]).toEqual([
      { displayName: '', sessionName: conferenceNameDefault },
    ]);
    wrapper.unmount();
  });
});
