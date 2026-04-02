import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { conferenceNameDefault } from '@/config/jitsiOptions';
import NameInputForm from './NameInputForm.vue';

describe('NameInputForm', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('emits trimmed custom session name', async () => {
    const { wrapper } = await mountWithApp(NameInputForm);
    await wrapper.find('input').setValue('  my-room  ');
    await wrapper.find('form').trigger('submit');
    expect(wrapper.emitted('submit')?.[0]).toEqual(['my-room']);
    wrapper.unmount();
  });

  it('does not emit when trimmed name is empty', async () => {
    const { wrapper } = await mountWithApp(NameInputForm);
    await wrapper.find('input').setValue('   ');
    await wrapper.find('form').trigger('submit');
    expect(wrapper.emitted('submit')).toBeUndefined();
    wrapper.unmount();
  });

  it('emits default session name when input is empty', async () => {
    const { wrapper } = await mountWithApp(NameInputForm);
    await wrapper.find('form').trigger('submit');
    expect(wrapper.emitted('submit')?.[0]).toEqual([conferenceNameDefault]);
    wrapper.unmount();
  });
});
