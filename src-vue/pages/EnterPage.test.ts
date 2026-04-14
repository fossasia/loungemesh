import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import MicIcon from '@/components/icons/MicIcon.vue';
import MicOffIcon from '@/components/icons/MicOffIcon.vue';
import EnterPage from './EnterPage.vue';

describe('EnterPage', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('mounts and navigates to session on join', async () => {
    const { wrapper, router } = await mountWithApp(EnterPage, {
      route: '/enter/flowspace',
      props: { id: 'flowspace' },
    });
    expect(wrapper.text()).toContain('Join');
    const push = vi.spyOn(router, 'push');
    await wrapper.find('.btn-primary-round').trigger('click');
    await flushPromises();
    expect(push).toHaveBeenCalledWith('/session/flowspace');
    wrapper.unmount();
  });

  it('shows MicIcon when unmuted and MicOffIcon when muted', async () => {
    const local = useLocalStore();
    local.mute = false;
    const unmuted = await mountWithApp(EnterPage, {
      route: '/enter/flowspace',
      props: { id: 'flowspace' },
    });
    expect(unmuted.wrapper.findComponent(MicIcon).exists()).toBe(true);
    expect(unmuted.wrapper.findComponent(MicOffIcon).exists()).toBe(false);
    unmuted.wrapper.unmount();

    local.mute = true;
    const muted = await mountWithApp(EnterPage, {
      route: '/enter/flowspace',
      props: { id: 'flowspace' },
    });
    expect(muted.wrapper.html()).toContain('sr-only');
    muted.wrapper.unmount();
  });

  it('skips conference name when id prop is empty', async () => {
    const conference = useConferenceStore();
    conference.setConferenceName('keep-name');
    const { wrapper } = await mountWithApp(EnterPage, {
      route: '/enter/flowspace',
      props: { id: '' },
    });
    expect(conference.conferenceName).toBe('keep-name');
    wrapper.unmount();
  });

  it('toggles mute from footer control', async () => {
    const local = useLocalStore();
    local.mute = false;
    const { wrapper } = await mountWithApp(EnterPage, {
      route: '/enter/flowspace',
      props: { id: 'flowspace' },
    });
    await wrapper.find('button.ibtn').trigger('click');
    wrapper.unmount();
  });
});
