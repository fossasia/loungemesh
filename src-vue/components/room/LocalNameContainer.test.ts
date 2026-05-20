import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import LocalNameContainer from './LocalNameContainer.vue';

describe('LocalNameContainer', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('edits display name on enter', async () => {
    const conference = useConferenceStore();
    conference.setDisplayName('Alice');
    const { wrapper } = await mountWithApp(LocalNameContainer);
    await wrapper.find('.editBtn').trigger('click');
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
    await wrapper.find('.editBtn').trigger('click');
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
    await wrapper.find('.editBtn').trigger('click');
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
    await wrapper.find('.editBtn').trigger('click');
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
    await wrapper.find('.editBtn').trigger('click');
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('Enter Your Name');
    wrapper.unmount();
  });

  it('commits on blur', async () => {
    const conference = useConferenceStore();
    conference.setDisplayName('Alice');
    const { wrapper } = await mountWithApp(LocalNameContainer);
    await wrapper.find('.editBtn').trigger('click');
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
    await wrapper.find('.editBtn').trigger('click');
    const input = wrapper.find('input');
    await input.setValue('Draft');
    await input.trigger('keydown', { key: 'a' });
    expect(conference.displayName).toBe('Alice');
    expect((input.element as HTMLInputElement).value).toBe('Draft');
    wrapper.unmount();
  });

  it('broadcasts renamed sphere to the room', async () => {
    const conference = useConferenceStore();
    const local = useLocalStore();
    conference.setDisplayName('Alice');
    conference.isJoined = true;
    local.setMyID('me');
    conference.addUser('me', { _displayName: 'Alice' });
    const sendCommand = vi.spyOn(getMediaEngineInstance(), 'sendCommand');
    const setDisplayName = vi.spyOn(getMediaEngineInstance(), 'setDisplayName');

    const { wrapper } = await mountWithApp(LocalNameContainer);
    await wrapper.find('.editBtn').trigger('click');
    await wrapper.find('input').setValue('Bob');
    await wrapper.find('input').trigger('keydown', { key: 'Enter' });

    expect(conference.displayName).toBe('Bob');
    expect(conference.users.me.user?._displayName).toBe('Bob');
    expect(setDisplayName).toHaveBeenCalledWith('Bob');
    expect(sendCommand).toHaveBeenCalledWith(
      'name',
      JSON.stringify({ id: 'me', name: 'Bob' }),
    );
    wrapper.unmount();
  });

  it('stops pointer and click events from bubbling out of the edit root', async () => {
    const conference = useConferenceStore();
    conference.setDisplayName('Alice');
    const { wrapper } = await mountWithApp(LocalNameContainer);
    const root = wrapper.find('.nameEditRoot');
    await root.trigger('pointerdown');
    await root.trigger('pointermove');
    await root.trigger('click');
    expect(wrapper.find('.nameEditRoot').exists()).toBe(true);
    wrapper.unmount();
  });

  it('updates the local label without broadcasting when not joined', async () => {
    const conference = useConferenceStore();
    const local = useLocalStore();
    conference.setDisplayName('Alice');
    conference.isJoined = false;
    local.setMyID('me');
    conference.addUser('me', { _displayName: 'Alice' });
    const sendCommand = vi.spyOn(getMediaEngineInstance(), 'sendCommand');
    const { wrapper } = await mountWithApp(LocalNameContainer);
    await wrapper.find('.editBtn').trigger('click');
    await wrapper.find('input').setValue('Bob');
    await wrapper.find('input').trigger('keydown', { key: 'Enter' });
    expect(conference.users.me.user?._displayName).toBe('Bob');
    expect(sendCommand).not.toHaveBeenCalledWith('name', expect.any(String));
    wrapper.unmount();
  });

  it('keeps previous name when draft is empty', async () => {
    const conference = useConferenceStore();
    conference.setDisplayName('Alice');
    const { wrapper } = await mountWithApp(LocalNameContainer);
    await wrapper.find('.editBtn').trigger('click');
    const input = wrapper.find('input');
    await input.setValue('   ');
    await input.trigger('keydown', { key: 'Enter' });
    expect(conference.displayName).toBe('Alice');
    wrapper.unmount();
  });
});
