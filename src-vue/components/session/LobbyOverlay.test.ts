import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { useLocalStore } from '@/stores/localStore';
import { useAuthStore } from '@/stores/authStore';
import LobbyOverlay from './LobbyOverlay.vue';

const mockSendCommand = vi.fn();
const mockLeaveRoom = vi.fn();
const mockDisconnect = vi.fn();

vi.mock('@/composables/useMediaEngine', () => ({
  useMediaEngine: () => ({
    engine: {
      sendCommand: mockSendCommand,
    },
    leaveRoom: mockLeaveRoom,
    disconnect: mockDisconnect,
  }),
}));

describe('LobbyOverlay', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockSendCommand.mockClear();
    mockLeaveRoom.mockClear();
    mockDisconnect.mockClear();

    // Configure the local user as a guest (non-host) so lobby is blocked correctly
    const local = useLocalStore();
    local.setMyID('local-id');
    const features = useSessionFeaturesStore();
    features.setHost('some-other-host-id');
  });

  it('hides when not blocked', async () => {
    const { wrapper } = await mountWithApp(LobbyOverlay);
    expect(wrapper.find('.lobby').exists()).toBe(false);
    wrapper.unmount();
  });

  it('shows waiting message when lobby blocks guest', async () => {
    const features = useSessionFeaturesStore();
    const conference = useConferenceStore();
    conference.setDisplayName('Guest');
    features.lobbyEnabled = true;
    features.localLobbyPending = true;
    const { wrapper } = await mountWithApp(LobbyOverlay);
    expect(wrapper.text()).toContain('Asking to join...');
    wrapper.unmount();
  });

  it('shows entry declined message when rejected', async () => {
    const features = useSessionFeaturesStore();
    features.lobbyEnabled = true;
    features.lobbyRejected = true;
    const { wrapper } = await mountWithApp(LobbyOverlay);
    expect(wrapper.text()).toContain('Entry Declined');
    wrapper.unmount();
  });

  it('switches tabs between guest join, sign in, and register', async () => {
    const features = useSessionFeaturesStore();
    features.lobbyEnabled = true;
    features.localLobbyPending = false;
    const { wrapper } = await mountWithApp(LobbyOverlay);

    // Tab buttons
    const tabs = wrapper.findAll('.tab');
    expect(tabs.length).toBe(3);

    // Default guest join active
    expect(wrapper.find('form').text()).toContain('Request Entry');

    // Click Sign In
    await tabs[1].trigger('click');
    expect(wrapper.find('form').text()).toContain('Sign In to Account');

    // Click Register
    await tabs[2].trigger('click');
    expect(wrapper.find('form').text()).toContain('Create an Account');

    // Click Guest Join
    await tabs[0].trigger('click');
    expect(wrapper.find('form').text()).toContain('Request Entry');

    wrapper.unmount();
  });

  it('handles guest join validations and submission', async () => {
    const features = useSessionFeaturesStore();
    features.lobbyEnabled = true;
    features.localLobbyPending = false;

    const { wrapper } = await mountWithApp(LobbyOverlay);

    // Clear name to test validation failure
    await wrapper.find('#lobbyGuestName').setValue('');
    await wrapper.find('form').trigger('submit');
    expect(wrapper.find('.errorAlert').exists()).toBe(true);
    expect(wrapper.find('.errorAlert').text()).toBe('Please enter your name.');

    // Fill valid name, email, and reason
    await wrapper.find('#lobbyGuestName').setValue('Test Guest');
    await wrapper.find('#lobbyGuestEmail').setValue('test@example.com');
    await wrapper.find('#lobbyGuestReason').setValue('Testing reasons');

    await wrapper.find('form').trigger('submit');
    expect(features.localLobbyPending).toBe(true);
    expect(mockSendCommand).toHaveBeenCalledWith(
      'lobby',
      JSON.stringify({
        action: 'wait',
        id: 'local-id',
        name: 'Test Guest',
        email: 'test@example.com',
        reason: 'Testing reasons',
      })
    );

    wrapper.unmount();
  });

  it('handles guest join validations and submission with empty optional fields', async () => {
    const features = useSessionFeaturesStore();
    features.lobbyEnabled = true;
    features.localLobbyPending = false;
    const conference = useConferenceStore();
    conference.setDisplayName(''); // force empty fallback on line 18

    const { wrapper } = await mountWithApp(LobbyOverlay);

    // Verify guestName is empty
    expect(wrapper.find('#lobbyGuestName').element.value).toBe('');

    // Fill only name (email/reason left empty)
    await wrapper.find('#lobbyGuestName').setValue('Test Guest No Extras');
    await wrapper.find('form').trigger('submit');

    expect(features.localLobbyPending).toBe(true);
    expect(mockSendCommand).toHaveBeenCalledWith(
      'lobby',
      JSON.stringify({
        action: 'wait',
        id: 'local-id',
        name: 'Test Guest No Extras',
        email: undefined,
        reason: undefined,
      })
    );

    // Since guestName is set, detailsPreview should be rendered in pending state
    expect(wrapper.find('.detailsPreview').exists()).toBe(true);

    wrapper.unmount();
  });

  it('does not render detailsPreview in pending state when guestName is empty', async () => {
    const features = useSessionFeaturesStore();
    const conference = useConferenceStore();
    conference.setDisplayName(''); // force empty
    features.lobbyEnabled = true;
    features.localLobbyPending = true;

    const { wrapper } = await mountWithApp(LobbyOverlay);
    // Since guestName is empty, .detailsPreview should not be rendered
    expect(wrapper.find('.detailsPreview').exists()).toBe(false);
    wrapper.unmount();
  });

  it('validates authentication form fields', async () => {
    const features = useSessionFeaturesStore();
    features.lobbyEnabled = true;
    features.localLobbyPending = false;
    const { wrapper } = await mountWithApp(LobbyOverlay);

    // Switch to Sign In tab
    await wrapper.findAll('.tab')[1].trigger('click');

    // Submit empty fields
    await wrapper.find('form').trigger('submit');
    expect(wrapper.find('.errorAlert').exists()).toBe(true);
    expect(wrapper.find('.errorAlert').text()).toBe('Please fill out all fields.');

    wrapper.unmount();
  });

  it('handles successful and failed sign in submission', async () => {
    const features = useSessionFeaturesStore();
    features.lobbyEnabled = true;
    features.localLobbyPending = false;
    const auth = useAuthStore();
    
    // Stub login to fail first, then succeed
    const loginMock = vi.spyOn(auth, 'login');
    loginMock.mockRejectedValueOnce(new Error('Invalid credentials'));

    const { wrapper } = await mountWithApp(LobbyOverlay);
    await wrapper.findAll('.tab')[1].trigger('click');

    await wrapper.find('#lobbyAuthEmail').setValue('user@example.com');
    await wrapper.find('#lobbyAuthPassword').setValue('password123');

    // First attempt fails
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.find('.errorAlert').text()).toBe('Invalid credentials');

    // Second attempt succeeds
    loginMock.mockResolvedValueOnce();
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.find('.errorAlert').exists()).toBe(false);

    wrapper.unmount();
  });

  it('uses default auth error message when err.message is empty', async () => {
    const features = useSessionFeaturesStore();
    features.lobbyEnabled = true;
    features.localLobbyPending = false;
    const auth = useAuthStore();
    
    // Stub login to reject with empty message / generic object
    const loginMock = vi.spyOn(auth, 'login');
    loginMock.mockRejectedValueOnce({});

    const { wrapper } = await mountWithApp(LobbyOverlay);
    await wrapper.findAll('.tab')[1].trigger('click');

    await wrapper.find('#lobbyAuthEmail').setValue('user@example.com');
    await wrapper.find('#lobbyAuthPassword').setValue('password123');

    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.find('.errorAlert').text()).toBe('Authentication failed. Please try again.');

    wrapper.unmount();
  });

  it('handles successful and failed registration submission', async () => {
    const features = useSessionFeaturesStore();
    features.lobbyEnabled = true;
    features.localLobbyPending = false;
    const auth = useAuthStore();
    
    // Stub signup to fail first, then succeed
    const signupMock = vi.spyOn(auth, 'signup');
    signupMock.mockRejectedValueOnce(new Error('Email already in use'));

    const { wrapper } = await mountWithApp(LobbyOverlay);
    await wrapper.findAll('.tab')[2].trigger('click');

    await wrapper.find('#lobbyAuthName').setValue('New User');
    await wrapper.find('#lobbyAuthEmail').setValue('new@example.com');
    await wrapper.find('#lobbyAuthPassword').setValue('password123');

    // First attempt fails
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.find('.errorAlert').text()).toBe('Email already in use');

    // Second attempt succeeds
    signupMock.mockResolvedValueOnce();
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.find('.errorAlert').exists()).toBe(false);

    wrapper.unmount();
  });

  it('exits lobby overlay and leaves conference when cancelling/exiting', async () => {
    const features = useSessionFeaturesStore();
    features.lobbyEnabled = true;
    features.localLobbyPending = true;

    const local = useLocalStore();
    const stopSpy = vi.spyOn(local, 'stopAllLocalMedia').mockResolvedValue();
    const conference = useConferenceStore();
    const leaveConfSpy = vi.spyOn(conference, 'leaveConference');

    const { wrapper, router } = await mountWithApp(LobbyOverlay);
    const routerSpy = vi.spyOn(router, 'push');

    // Cancel Request button in Pending view
    await wrapper.find('.btnCancel').trigger('click');
    await flushPromises();

    expect(stopSpy).toHaveBeenCalled();
    expect(mockLeaveRoom).toHaveBeenCalled();
    expect(leaveConfSpy).toHaveBeenCalled();
    expect(mockDisconnect).toHaveBeenCalled();
    expect(routerSpy).toHaveBeenCalledWith('/');

    wrapper.unmount();
  });
});
