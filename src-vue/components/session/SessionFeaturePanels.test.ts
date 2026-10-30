import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import SessionFeaturePanels from './SessionFeaturePanels.vue';

const notesEditorStub = {
  name: 'NotesEditor',
  props: ['modelValue', 'readonly'],
  emits: ['update:modelValue', 'blur'],
  template: `<textarea class="notesTa" :value="modelValue" :readonly="readonly" @input="$emit('update:modelValue', $event.target.value)" @blur="$emit('blur')" />`,
};

async function mountPanels() {
  return mountWithApp(SessionFeaturePanels, {
    global: { stubs: { NotesEditor: notesEditorStub } },
  });
}

describe('SessionFeaturePanels', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setActivePinia(createPinia());
  });

  it('syncs notes for host', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('me');
    features.setHost('me');
    features.panel = 'notes';
    const { wrapper } = await mountPanels();
    await flushPromises();
    const ta = wrapper.find('.notesTa');
    await ta.setValue('shared text');
    vi.advanceTimersByTime(500);
    expect(features.sharedNotes).toBe('shared text');
    wrapper.unmount();
  });

  it('flushes notes on blur when the draft changed', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('me');
    features.setHost('me');
    features.panel = 'notes';
    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');
    const { wrapper } = await mountPanels();
    await flushPromises();
    const ta = wrapper.find('.notesTa');
    await ta.setValue('blur published');
    await ta.trigger('blur');
    vi.advanceTimersByTime(500);
    expect(features.sharedNotes).toBe('blur published');
    expect(cmdSpy).toHaveBeenCalledWith('notes', expect.any(String));
    wrapper.unmount();
  });

  it('keeps scheduling while the user keeps typing', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('me');
    features.setHost('me');
    features.panel = 'notes';
    const { wrapper } = await mountPanels();
    const ta = wrapper.find('.notesTa');
    await ta.setValue('first');
    await ta.setValue('second');
    vi.advanceTimersByTime(500);
    expect(features.sharedNotes).toBe('second');
    wrapper.unmount();
  });

  it('does not republish when the scheduled draft equals the shared notes', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('me');
    features.setHost('me');
    features.sharedNotes = 'same';
    features.panel = 'notes';
    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');
    const { wrapper } = await mountPanels();
    await flushPromises();
    await wrapper.find('.notesTa').setValue('same');
    vi.advanceTimersByTime(500);
    expect(cmdSpy).not.toHaveBeenCalledWith('notes', expect.any(String));
    wrapper.unmount();
  });

  it('does not publish when shared notes changed before the debounce fired', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('me');
    features.setHost('me');
    features.sharedNotes = 'base';
    features.panel = 'notes';
    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');
    const { wrapper } = await mountPanels();
    await flushPromises();
    await wrapper.find('.notesTa').setValue('edited');
    features.sharedNotes = 'external';
    vi.advanceTimersByTime(500);
    expect(cmdSpy).not.toHaveBeenCalledWith('notes', expect.stringContaining('edited'));
    wrapper.unmount();
  });

  it('runs moderator flows for host', async () => {
    const features = useSessionFeaturesStore();
    const conference = useConferenceStore();
    const local = useLocalStore();
    local.setMyID('host');
    features.setHost('host');
    conference.addUser('host', { _displayName: 'Host' } as never);
    conference.addUser('peer', { _displayName: 'Peer' } as never);
    features.panel = 'moderator';
    features.lobbyEnabled = false;
    features.stagePromotionEnabled = false;
    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');
    const { wrapper } = await mountPanels();
    await flushPromises();
    features.lobbyWaiting = [{ id: 'w1', name: 'Waiter' }];
    const roomToggles = wrapper.findAll('.roomToggle input');
    await roomToggles[0].setValue(true);
    expect(cmdSpy).toHaveBeenCalledWith('lobby', expect.stringContaining('"enabled":true'));
    await roomToggles[1].setValue(true);
    expect(cmdSpy).toHaveBeenCalledWith('stage', expect.stringContaining('"stagePromotionEnabled":true'));
    await wrapper.find('.lobbyRow .pill').trigger('click');
    const peerCard = wrapper
      .findAll('.participantCard')
      .find((row) => row.text().includes('Peer'));
    expect(peerCard).toBeTruthy();
    await peerCard!.find('.pill').trigger('click');
    expect(cmdSpy).toHaveBeenCalledWith('stage', expect.stringContaining('"action":"invite"'));
    const muteBtn = peerCard!.find('button[title="Mute"]');
    const removeBtn = peerCard!.find('button[title="Remove"]');
    await muteBtn!.trigger('click');
    await removeBtn!.trigger('click');
    const peerGrant = peerCard!.find('.grantCheck input');
    await peerGrant.setValue(false);
    expect(cmdSpy).toHaveBeenCalledWith('access', expect.stringContaining('"userId":"peer"'));
    wrapper.unmount();
  });

  it('hides menu card when whiteboard panel is active', async () => {
    const features = useSessionFeaturesStore();
    features.panel = 'whiteboard';
    const { wrapper } = await mountPanels();
    expect(wrapper.find('.featureCard').exists()).toBe(false);
    wrapper.unmount();
  });

  it('syncs remote notes while the notes panel is open when not editing', async () => {
    const features = useSessionFeaturesStore();
    features.panel = 'notes';
    features.sharedNotes = 'local';
    const { wrapper } = await mountPanels();
    features.sharedNotes = 'remote';
    await nextTick();
    await flushPromises();
    expect((wrapper.find('.notesTa').element as HTMLTextAreaElement).value).toBe('remote');
    wrapper.unmount();
  });

  it('does not push notes when the user cannot edit', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('guest');
    features.setHost('host');
    features.userGrants.guest = { notes: false, whiteboard: false, poll: false };
    features.panel = 'notes';
    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');
    const { wrapper } = await mountPanels();
    const ta = wrapper.find('.notesTa').element as HTMLTextAreaElement;
    ta.value = 'blocked';
    await wrapper.find('.notesTa').trigger('input');
    vi.advanceTimersByTime(500);
    expect(cmdSpy).not.toHaveBeenCalledWith('notes', expect.any(String));
    wrapper.unmount();
  });

  it('does not publish stale notes when the user only focuses the textarea', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('me');
    features.setHost('me');
    features.panel = 'notes';
    features.sharedNotes = 'latest shared';
    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');
    const { wrapper } = await mountPanels();
    await wrapper.find('.notesTa').trigger('focus');
    vi.advanceTimersByTime(500);
    expect(cmdSpy).not.toHaveBeenCalledWith('notes', expect.any(String));
    wrapper.unmount();
  });

  it('applies remote notes while focused without local edits', async () => {
    const features = useSessionFeaturesStore();
    features.panel = 'notes';
    features.sharedNotes = 'before';
    const { wrapper } = await mountPanels();
    await wrapper.find('.notesTa').trigger('focus');
    features.sharedNotes = 'after';
    await flushPromises();
    expect((wrapper.find('.notesTa').element as HTMLTextAreaElement).value).toBe('after');
    wrapper.unmount();
  });

  it('syncs notes and whiteboard access toggles', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('host');
    features.setHost('host');
    features.panel = 'moderator';
    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');
    const { wrapper } = await mountPanels();
    const grantChecks = wrapper.findAll('.grantTable .grantCheck input');
    await grantChecks[0].setValue(true);
    await grantChecks[1].setValue(true);
    expect(cmdSpy).toHaveBeenCalledWith(
      'access',
      expect.stringContaining('"notes":true'),
    );
    expect(cmdSpy).toHaveBeenCalledWith(
      'access',
      expect.stringContaining('"whiteboard":true'),
    );
    wrapper.unmount();
  });

  it('shows moderator panel without a lobby queue', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('host');
    features.setHost('host');
    features.panel = 'moderator';
    const { wrapper } = await mountPanels();
    expect(wrapper.text()).toContain('Participants');
    expect(wrapper.find('.lobbyBlock').exists()).toBe(false);
    wrapper.unmount();
  });

  it('shows reset to template for host when a template is loaded', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('host');
    features.setHost('host');
    features.setNotesTemplate('# Agenda');
    features.sharedNotes = 'edited';
    features.panel = 'notes';
    const { wrapper } = await mountPanels();
    expect(wrapper.find('.notesResetBtn').exists()).toBe(true);
    wrapper.unmount();
  });

  it('hides reset to template without a host template', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('host');
    features.setHost('host');
    features.panel = 'notes';
    const { wrapper } = await mountPanels();
    expect(wrapper.find('.notesResetBtn').exists()).toBe(false);
    wrapper.unmount();
  });

  it('hides reset to template for non-host participants', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('guest');
    features.setHost('host');
    features.setNotesTemplate('# Agenda');
    features.panel = 'notes';
    const { wrapper } = await mountPanels();
    expect(wrapper.find('.notesResetBtn').exists()).toBe(false);
    wrapper.unmount();
  });

  it('resets shared notes to the host template and broadcasts', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('host');
    features.setHost('host');
    features.setNotesTemplate('# Agenda');
    features.sharedNotes = 'edited';
    features.panel = 'notes';
    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');
    const { wrapper } = await mountPanels();
    await flushPromises();
    await wrapper.find('.notesResetBtn').trigger('click');
    expect(features.sharedNotes).toBe('# Agenda');
    expect((wrapper.find('.notesTa').element as HTMLTextAreaElement).value).toBe('# Agenda');
    expect(cmdSpy).toHaveBeenCalledWith('notes', JSON.stringify({ action: 'yjs_begin', total: 1 }));
    wrapper.unmount();
  });

  it('syncs notes draft when remote notes change', async () => {
    const local = useLocalStore();
    local.setMyID('me');
    const features = useSessionFeaturesStore();
    features.setHost('me');
    features.panel = 'poll';
    const { wrapper } = await mountPanels();
    features.sharedNotes = 'updated remotely';
    await flushPromises();
    features.panel = 'notes';
    await flushPromises();
    expect((wrapper.find('.notesTa').element as HTMLTextAreaElement).value).toBe(
      'updated remotely',
    );
    wrapper.unmount();
  });

  it('uses an empty title for unknown panels', async () => {
    const features = useSessionFeaturesStore();
    (features as { panel: string }).panel = 'unknown';
    const { wrapper } = await mountPanels();
    expect(wrapper.find('.title').text()).toBe('');
    wrapper.unmount();
  });

  it('closes from the panel header', async () => {
    const features = useSessionFeaturesStore();
    features.panel = 'moderator';
    const { wrapper } = await mountPanels();
    await wrapper.find('.close').trigger('click');
    expect(features.panel).toBe('');
    wrapper.unmount();
  });

  it('hides menu card for reactions and poll panels', async () => {
    const features = useSessionFeaturesStore();
    features.panel = 'reactions';
    const { wrapper } = await mountPanels();
    expect(wrapper.find('.featureCard').exists()).toBe(false);
    features.panel = 'poll';
    await flushPromises();
    expect(wrapper.find('.featureCard').exists()).toBe(false);
    wrapper.unmount();
  });

  it('blocks promotion when the stage is occupied', async () => {
    const features = useSessionFeaturesStore();
    const conference = useConferenceStore();
    const local = useLocalStore();
    local.setMyID('host');
    features.setHost('host');
    features.stagePromotionEnabled = true;
    features.stageOccupantId = 'on-stage';
    conference.addUser('host', { _displayName: 'Host' } as never);
    conference.addUser('peer', { _displayName: 'Peer' } as never);
    features.panel = 'moderator';
    const { wrapper } = await mountPanels();
    await wrapper
      .findAll('.participantCard')
      .find((row) => row.text().includes('Peer'))!
      .find('.pill')
      .trigger('click');
    expect(features.stageMessage).toContain('occupied');
    wrapper.unmount();
  });

  it('shows participant id when display name is missing', async () => {
    const features = useSessionFeaturesStore();
    const conference = useConferenceStore();
    const local = useLocalStore();
    local.setMyID('host');
    features.setHost('host');
    conference.addUser('plain-id');
    features.panel = 'moderator';
    const { wrapper } = await mountPanels();
    expect(wrapper.text()).toContain('plain-id');
    wrapper.unmount();
  });

  it('allows the host to demote stage user or cancel invite', async () => {
    const features = useSessionFeaturesStore();
    const conference = useConferenceStore();
    const local = useLocalStore();
    local.setMyID('host');
    features.setHost('host');
    conference.addUser('host', { _displayName: 'Host' } as never);
    conference.addUser('peer', { _displayName: 'Peer' } as never);
    features.panel = 'moderator';
    features.stageOccupantId = 'peer';

    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');
    const { wrapper } = await mountPanels();
    await flushPromises();

    const peerCard = wrapper
      .findAll('.participantCard')
      .find((row) => row.text().includes('Peer'));
    expect(peerCard).toBeTruthy();
    
    const demoteBtn = peerCard!.find('.pill.subtle');
    expect(demoteBtn.text()).toBe('Remove presenter');
    await demoteBtn.trigger('click');
    expect(cmdSpy).toHaveBeenCalledWith('stage', expect.stringContaining('"action":"demote"'));

    wrapper.unmount();
  });

  it('covers remaining edge case branches of SessionFeaturePanels.vue', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('host');
    features.setHost('host');
    features.panel = 'notes';

    const { wrapper } = await mountPanels();
    await flushPromises();
    // 2. Cover watch(panel) when panel is not notes
    features.panel = 'moderator';
    await flushPromises();

    // 3. Cover promoteUser branches on line 170
    // Get the vm instance
    const vm = wrapper.vm as any;
    // We want result.ok is true
    features.stageOccupantId = '';
    features.stagePromotionEnabled = true;
    const conference = useConferenceStore();
    conference.addUser('peer1', { _displayName: 'Peer 1' } as never);
    await flushPromises();
    vm.promoteUser('peer1');

    // We want result.ok is false (stage is already occupied)
    features.stageOccupantId = 'peer1';
    vm.promoteUser('peer2');
    expect(features.stageMessage).toContain('occupied');

    wrapper.unmount();
  });

  it('renders distinct moderator view without host room settings or grant tables', async () => {
    const features = useSessionFeaturesStore();
    const conference = useConferenceStore();
    const local = useLocalStore();
    local.setMyID('mod1');
    features.setHost('host1');
    features.userGrants['mod1'] = { moderator: true };
    features.userGrants['mod2'] = { moderator: true };
    conference.addUser('host1', { _displayName: 'Host User' } as never);
    conference.addUser('mod1', { _displayName: 'Mod User' } as never);
    conference.addUser('mod2', { _displayName: 'Other Mod' } as never);
    conference.addUser('attendee1', { _displayName: 'Attendee User' } as never);
    features.panel = 'moderator';

    const { wrapper } = await mountPanels();
    await flushPromises();

    expect(wrapper.find('.title').text()).toBe('Moderator Controls');
    expect(wrapper.text()).toContain('Room appearance');
    expect(wrapper.text()).toContain('Notes template');
    expect(wrapper.text()).not.toContain('What people in the lobby enter');
    expect(wrapper.text()).not.toContain('Room features');
    expect(wrapper.text()).not.toContain('Allow presenter promotion');
    expect(wrapper.text()).not.toContain('Allow participant recording');
    expect(wrapper.text()).not.toContain('Whiteboard & Notes Review');
    expect(wrapper.find('.grantTable').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('Default permissions');

    // Host user card cannot be muted or kicked by moderator
    const hostCard = wrapper.findAll('.participantCard').find((c) => c.text().includes('Host User'));
    expect(hostCard).toBeTruthy();
    expect(hostCard!.find('button[title="Mute"]').exists()).toBe(false);
    expect(hostCard!.find('button[title="Remove"]').exists()).toBe(false);

    const selfCard = wrapper.findAll('.participantCard').find((c) => c.text().includes('You'));
    expect(selfCard!.find('button[title="Mute"]').exists()).toBe(false);
    const otherModCard = wrapper.findAll('.participantCard').find((c) => c.text().includes('Other Mod'));
    expect(otherModCard!.find('button[title="Mute"]').exists()).toBe(false);
    expect(otherModCard!.find('button[title="Remove"]').exists()).toBe(false);

    // Attendee card can be muted and kicked by moderator
    const attendeeCard = wrapper.findAll('.participantCard').find((c) => c.text().includes('Attendee User'));
    expect(attendeeCard).toBeTruthy();
    expect(attendeeCard!.find('button[title="Mute"]').exists()).toBe(true);
    expect(attendeeCard!.find('button[title="Remove"]').exists()).toBe(true);

    wrapper.unmount();
  });

  it('renders read-only participants view for attendees', async () => {
    const features = useSessionFeaturesStore();
    const conference = useConferenceStore();
    const local = useLocalStore();
    local.setMyID('attendee1');
    features.setHost('host1');
    conference.addUser('host1', { _displayName: 'Host User' } as never);
    conference.addUser('attendee1', { _displayName: 'Attendee User' } as never);
    features.panel = 'participants';

    const { wrapper } = await mountPanels();
    await flushPromises();

    expect(wrapper.find('.title').text()).toBe('Participants');
    expect(wrapper.find('.grantTable').exists()).toBe(false);
    expect(wrapper.find('.modActions').exists()).toBe(false);
    expect(wrapper.findAll('.participantCard').length).toBe(2);

    features.panel = 'moderator';
    await flushPromises();
    expect(wrapper.find('button[title="Mute"]').exists()).toBe(false);
    expect(wrapper.find('button[title="Remove"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('Allow presenter promotion');

    wrapper.unmount();
  });

  it('handles notes moderation queue in notes panel and moderator panel', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');

    local.setMyID('host');
    features.setHost('host');
    features.panel = 'notes';

    features.pendingModerationChanges = [
      {
        id: 'notes-mod-1',
        type: 'notes',
        authorId: 'guest-1',
        authorName: 'Guest 1',
        payload: 'Guest note edit',
        timestamp: Date.now(),
      },
    ];

    const { wrapper } = await mountPanels();
    await flushPromises();

    // Notes moderation queue in notes panel
    const queue = wrapper.find('[data-testid="notes-mod-queue"]');
    expect(queue.exists()).toBe(true);
    expect(queue.text()).toContain('Guest 1');

    await queue.find('.btnAccept').trigger('click');
    expect(features.pendingModerationChanges).toHaveLength(0);
    expect(features.sharedNotes).toBe('Guest note edit');

    // Reject in notes panel
    features.pendingModerationChanges = [
      {
        id: 'notes-mod-2',
        type: 'notes',
        authorId: 'guest-2',
        authorName: 'Guest 2',
        payload: 'Another note edit',
        timestamp: Date.now(),
      },
    ];
    await flushPromises();
    const queue2 = wrapper.find('[data-testid="notes-mod-queue"]');
    await queue2.find('.btnReject').trigger('click');
    expect(features.pendingModerationChanges).toHaveLength(0);

    // Switch to moderator panel
    features.panel = 'moderator';
    features.pendingModerationChanges = [
      {
        id: 'mod-change-3',
        type: 'whiteboard',
        authorId: 'guest-3',
        authorName: 'Guest 3',
        payload: { id: 's3' },
        timestamp: Date.now(),
      },
    ];
    await flushPromises();

    const modList = wrapper.find('[data-testid="mod-queue-list"]');
    expect(modList.exists()).toBe(true);
    expect(modList.text()).toContain('Whiteboard');
    expect(modList.text()).toContain('Guest 3');

    await modList.find('.btnAccept').trigger('click');
    expect(features.pendingModerationChanges).toHaveLength(0);

    wrapper.unmount();
  });

  it('publishes an attendee notes edit without waiting for approval', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');

    local.setMyID('guest');
    features.setHost('host'); // guest is attendee
    features.setRoomDefault('notes', true);
    features.panel = 'notes';

    const { wrapper } = await mountPanels();
    await flushPromises();

    const ta = wrapper.find('.notesTa');
    await ta.setValue('Attendee draft edit');
    vi.advanceTimersByTime(500);

    expect(cmdSpy).toHaveBeenCalledWith('notes', expect.any(String));
    expect(features.pendingModerationChanges).toHaveLength(0);
    expect(features.sharedNotes).toContain('Attendee draft edit');

    wrapper.unmount();
  });
});

