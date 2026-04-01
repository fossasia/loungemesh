import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { useConferenceStore } from '@/stores/conferenceStore';
import LocalNameContainer from './LocalNameContainer.vue';

describe('LocalNameContainer', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('edits display name on enter', async () => {
    const conference = useConferenceStore();
    conference.setDisplayName('Alice');
    const { wrapper } = await mountWithApp(LocalNameContainer);
    await wrapper.find('.nameTagClick').trigger('click');
    const input = wrapper.find('input');
    await input.setValue('Bob');
    input.element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    expect(conference.displayName).toBe('Bob');
    wrapper.unmount();
  });

  it('edits display name on numpad enter', async () => {
    const conference = useConferenceStore();
    conference.setDisplayName('Alice');
    const { wrapper } = await mountWithApp(LocalNameContainer);
    await wrapper.find('.nameTagClick').trigger('click');
    const input = wrapper.find('input');
    await input.setValue('Bob');
    input.element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'NumpadEnter', bubbles: true, cancelable: true }),
    );
    expect(conference.displayName).toBe('Bob');
    wrapper.unmount();
  });

  it('commits draft on escape', async () => {
    const conference = useConferenceStore();
    conference.setDisplayName('Alice');
    const { wrapper } = await mountWithApp(LocalNameContainer);
    await wrapper.find('.nameTagClick').trigger('click');
    const input = wrapper.find('input');
    await input.setValue('Carol');
    await input.trigger('keydown', { key: 'Escape' });
    expect(conference.displayName).toBe('Carol');
    wrapper.unmount();
  });

  it('does not sync draft while editing', async () => {
    const conference = useConferenceStore();
    conference.setDisplayName('Alice');
    const { wrapper } = await mountWithApp(LocalNameContainer);
    await wrapper.find('.nameTagClick').trigger('click');
    const input = wrapper.find('input');
    await input.setValue('Draft');
    conference.setDisplayName('Changed');
    await wrapper.vm.$nextTick();
    expect((input.element as HTMLInputElement).value).toBe('Draft');
    wrapper.unmount();
  });

  it('syncs draft when display name changes while inactive', async () => {
    const conference = useConferenceStore();
    conference.setDisplayName('Alice');
    const { wrapper } = await mountWithApp(LocalNameContainer);
    conference.setDisplayName('Dana');
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('Dana');
    wrapper.unmount();
  });

  it('uses default draft when opening edit with no display name', async () => {
    const conference = useConferenceStore();
    conference.setDisplayName('');
    const { wrapper } = await mountWithApp(LocalNameContainer);
    await wrapper.find('.nameTagClick').trigger('click');
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('Enter Your Name');
    wrapper.unmount();
  });

  it('commits on blur', async () => {
    const conference = useConferenceStore();
    conference.setDisplayName('Alice');
    const { wrapper } = await mountWithApp(LocalNameContainer);
    await wrapper.find('.nameTagClick').trigger('click');
    const input = wrapper.find('input');
    await input.setValue('Eve');
    await input.trigger('blur');
    expect(conference.displayName).toBe('Eve');
    wrapper.unmount();
  });

  it('ignores unrelated keys while editing', async () => {
    const conference = useConferenceStore();
    conference.setDisplayName('Alice');
    const { wrapper } = await mountWithApp(LocalNameContainer);
    await wrapper.find('.nameTagClick').trigger('click');
    const input = wrapper.find('input');
    await input.setValue('Draft');
    await input.trigger('keydown', { key: 'a' });
    expect(conference.displayName).toBe('Alice');
    expect((input.element as HTMLInputElement).value).toBe('Draft');
    wrapper.unmount();
  });

  it('keeps previous name when draft is empty', async () => {
    const conference = useConferenceStore();
    conference.setDisplayName('Alice');
    const { wrapper } = await mountWithApp(LocalNameContainer);
    await wrapper.find('.nameTagClick').trigger('click');
    const input = wrapper.find('input');
    await input.setValue('   ');
    await input.trigger('keydown', { key: 'Enter' });
    expect(conference.displayName).toBe('Alice');
    wrapper.unmount();
  });
});
