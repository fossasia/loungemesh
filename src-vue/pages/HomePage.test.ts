import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import HomePage from './HomePage.vue';

describe('HomePage', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('releases local media on mount', async () => {
    const local = useLocalStore();
    const stopSpy = vi.spyOn(local, 'stopAllLocalMedia');
    const { wrapper } = await mountWithApp(HomePage, { route: '/' });
    expect(stopSpy).toHaveBeenCalled();
    wrapper.unmount();
  });

  it('mounts and submits username and session', async () => {
    const { wrapper, router } = await mountWithApp(HomePage, { route: '/' });
    expect(wrapper.text()).toContain('Flowspace');
    const push = vi.spyOn(router, 'push');
    const inputs = wrapper.findAll('input[type="text"]');
    await inputs[0].setValue('Alex');
    await inputs[1].setValue('my-room');
    await wrapper.find('form').trigger('submit');
    expect(useConferenceStore().displayName).toBe("Alex's Sphere");
    expect(push).toHaveBeenCalledWith('/session/my-room');
    wrapper.unmount();
  });
});
