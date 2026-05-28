import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { useConnectionStore } from '@/stores/connectionStore';
import { useConferenceStore } from '@/stores/conferenceStore';
import { SESSION_ERROR_CODES } from '@/services/sessionErrorCodes';
import ErrorHandler from './ErrorHandler.vue';

describe('ErrorHandler', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('shows generic messages with codes and clears errors', async () => {
    const conn = useConnectionStore();
    const conf = useConferenceStore();
    conn.$patch({ error: SESSION_ERROR_CODES.CONNECTION_FAILED });
    conf.$patch({ error: SESSION_ERROR_CODES.JOIN_FAILED });
    const { wrapper } = await mountWithApp(ErrorHandler);
    expect(wrapper.text()).toContain("Couldn't connect to the session.");
    expect(wrapper.text()).toContain('FS-E001');
    expect(wrapper.text()).toContain("Couldn't join this session.");
    expect(wrapper.text()).toContain('FS-E003');
    expect(wrapper.text()).not.toContain('xmpp');
    await wrapper.find('button.close').trigger('click');
    expect(conn.error).toBeUndefined();
    wrapper.unmount();
  });

  it('hides session-unavailable errors while joined', async () => {
    const conf = useConferenceStore();
    conf.$patch({ error: SESSION_ERROR_CODES.SESSION_UNAVAILABLE, isJoined: true });
    const { wrapper } = await mountWithApp(ErrorHandler);
    expect(wrapper.text()).not.toContain('FS-E004');
    wrapper.unmount();
  });
});
