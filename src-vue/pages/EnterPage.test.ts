import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import AppIcon from '@/components/ui/AppIcon.vue';
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

  it('shows mic and camera controls', async () => {
    const local = useLocalStore();
    local.mute = false;
    local.cameraOff = false;
    const { wrapper } = await mountWithApp(EnterPage, {
      route: '/enter/flowspace',
      props: { id: 'flowspace' },
    });
    const labels = wrapper.findAll('button.ibtn').map((b) => b.attributes('aria-label'));
    expect(labels).toContain('Mute');
    expect(labels).toContain('Turn off camera');
    expect(wrapper.findAllComponents(AppIcon).length).toBeGreaterThan(0);
    wrapper.unmount();
  });

  it('shows off-state labels when camera and mic are disabled', async () => {
    const local = useLocalStore();
    local.mute = true;
    local.cameraOff = true;
    const { wrapper } = await mountWithApp(EnterPage, {
      route: '/enter/flowspace',
      props: { id: 'flowspace' },
    });
    const labels = wrapper.findAll('button.ibtn').map((b) => b.attributes('aria-label'));
    expect(labels).toContain('Unmute');
    expect(labels).toContain('Turn on camera');
    wrapper.unmount();
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

  it('toggles camera and mute from footer', async () => {
    const local = useLocalStore();
    const cameraSpy = vi.spyOn(local, 'toggleCamera').mockResolvedValue(undefined);
    const muteSpy = vi.spyOn(local, 'toggleMute').mockResolvedValue(undefined);
    const { wrapper } = await mountWithApp(EnterPage, {
      route: '/enter/flowspace',
      props: { id: 'flowspace' },
    });
    await wrapper.find('[aria-label="Turn off camera"]').trigger('click');
    await wrapper.find('[aria-label="Mute"]').trigger('click');
    expect(cameraSpy).toHaveBeenCalled();
    expect(muteSpy).toHaveBeenCalled();
    wrapper.unmount();
  });

  it('stops media when leaving without joining', async () => {
    const local = useLocalStore();
    const stopSpy = vi.spyOn(local, 'stopAllLocalMedia');
    const { wrapper } = await mountWithApp(EnterPage, {
      route: '/enter/flowspace',
      props: { id: 'flowspace' },
    });
    wrapper.unmount();
    expect(stopSpy).toHaveBeenCalled();
  });

  it('does not stop media when navigating to session', async () => {
    const local = useLocalStore();
    const stopSpy = vi.spyOn(local, 'stopAllLocalMedia');
    const { wrapper, router } = await mountWithApp(EnterPage, {
      route: '/enter/flowspace',
      props: { id: 'flowspace' },
    });
    vi.spyOn(router, 'push').mockResolvedValue(undefined as never);
    await wrapper.find('.btn-primary-round').trigger('click');
    await flushPromises();
    wrapper.unmount();
    expect(stopSpy).not.toHaveBeenCalled();
  });
});
