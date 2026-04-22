import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { useConnectionStore } from '@/stores/connectionStore';
import { useConferenceStore } from '@/stores/conferenceStore';
import ErrorHandler from './ErrorHandler.vue';

describe('ErrorHandler', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('shows and clears connection and conference errors', async () => {
    const conn = useConnectionStore();
    const conf = useConferenceStore();
    conn.$patch({ error: 'conn fail' });
    conf.$patch({ error: 'conf fail' });
    const { wrapper } = await mountWithApp(ErrorHandler);
    expect(wrapper.text()).toContain('conn fail');
    await wrapper.find('button.close').trigger('click');
    expect(conn.error).toBeUndefined();
    wrapper.unmount();
  });

  it('hides generic conference errors while joined', async () => {
    const conf = useConferenceStore();
    conf.$patch({ error: 'conference_error', isJoined: true });
    const { wrapper } = await mountWithApp(ErrorHandler);
    expect(wrapper.text()).not.toContain('conference_error');
    wrapper.unmount();
  });
});
