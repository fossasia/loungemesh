import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextTick } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { connectAndJoinTestConference } from '@/test/jitsiTestContext';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';
import { createChatMessage } from '@/utils/chatMessage';
import ChatPanel from './ChatPanel.vue';

function chatMsg(id: string, text: string, nr: number) {
  return createChatMessage(id, text, nr);
}

describe('ChatPanel', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('sends messages, parses links, and handles keyboard shortcuts', async () => {
    const { jitsi, conference } = await connectAndJoinTestConference();
    const local = useLocalStore();
    local.setMyID('local-1');
    conference.addUser('remote-1', { _displayName: 'Bob' } as never);
      conference.messages = [
        { id: 'local-1', text: 'https://only.example', nr: 0 },
        { id: 'remote-1', text: 'see https://example.com now', nr: 1 },
        { id: 'other', text: 'plain', nr: 2 },
        { id: 'unknown', text: 'no link', nr: 3 },
      ];

    const { wrapper } = await mountWithApp(ChatPanel);
    await wrapper.find('button.ibtn').trigger('click');
    const textarea = wrapper.find('textarea');
    await textarea.setValue('hello');
    await wrapper.find('.send').trigger('click');
    expect(jitsi.conference.sendTextMessage).toHaveBeenCalledWith('hello');

    await textarea.setValue('   ');
    await wrapper.find('.send').trigger('click');
    expect(jitsi.conference.sendTextMessage).toHaveBeenCalledTimes(1);
    await textarea.setValue('line');
    textarea.element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', altKey: true, bubbles: true, cancelable: true }),
    );
    expect((textarea.element as HTMLTextAreaElement).value).toContain('\n');
    textarea.element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    await flushPromises();

    conference.isJoined = false;
    conference.conferenceObject = undefined;
    local.setMyID('');
    const { engine } = await import('@/composables/useMediaEngine').then((m) => m.useMediaEngine());
    vi.spyOn(engine, 'getLocalUserId').mockReturnValue(undefined);
    vi.spyOn(engine, 'getConference').mockReturnValue(undefined);
    await textarea.setValue('blocked');
    await textarea.trigger('keydown', { key: 'Enter' });
    expect(textarea.element.value).toBe('blocked');
    conference.messages.push({ id: 'local-1', text: 'scroll', nr: 4 });
    await flushPromises();
    await nextTick();
    const chatRoot = wrapper.find('.messages').element as HTMLElement;
    Object.defineProperty(chatRoot, 'scrollHeight', { value: 400, configurable: true });
    conference.messages.push({ id: 'local-1', text: 'scroll-more', nr: 5 });
    await flushPromises();
    await nextTick();
    expect(chatRoot.scrollTop).toBe(400);
    wrapper.unmount();
  });

  it('labels unknown senders when local id is unset', async () => {
    const conference = useConferenceStore();
    conference.conferenceObject = {} as never;
    conference.messages = [{ id: 'someone', text: 'ping', nr: 0 }];
    const { wrapper } = await mountWithApp(ChatPanel);
    await wrapper.find('button.ibtn').trigger('click');
    expect(wrapper.text()).toContain('Guest');
    wrapper.unmount();
  });

  it('renders plain text, link segments, and display names', async () => {
    const conference = useConferenceStore();
    const local = useLocalStore();
    local.setMyID('me');
    conference.conferenceObject = {} as never;
    conference.addUser('bob', { _displayName: 'Bob' } as never);
    conference.addUser('named', { _displayName: '   ' } as never);
    conference.messages = [
      { id: '', text: 'no sender', nr: 0 },
      { id: 'me', text: '', nr: 1 },
      { id: 'me', text: 'hello', nr: 2 },
      { id: 'bob', text: 'before https://link.test/path after', nr: 3 },
      { id: 'ghost', text: 'anon', nr: 4 },
      { id: 'named', text: 'blank name', nr: 5 },
      { id: 'ghost', text: 'guest label', nr: 7 },
      { id: 'bob', text: 'https://only.example', nr: 6 },
    ];

    const { wrapper } = await mountWithApp(ChatPanel);
    await wrapper.find('button.ibtn').trigger('click');
    expect(wrapper.text()).toContain('You');
    expect(wrapper.text()).toContain('Bob');
    expect(wrapper.text()).toContain('Guest');
    expect(wrapper.find('a[href="https://link.test/path"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('does not scroll when the chat panel is closed', async () => {
    const conference = useConferenceStore();
    conference.conferenceObject = {} as never;
    const { wrapper } = await mountWithApp(ChatPanel);
    conference.messages = [{ id: 'u1', text: 'outside', nr: 1 }];
    await flushPromises();
    await nextTick();
    expect(wrapper.find('.messages').exists()).toBe(false);
    wrapper.unmount();
  });

  it('ignores message watch when chat panel is closed', async () => {
    const conference = useConferenceStore();
    conference.conferenceObject = {} as never;
    const { wrapper } = await mountWithApp(ChatPanel);
    conference.messages.push({ id: 'u1', text: 'new', nr: 1 });
    await flushPromises();
    expect(wrapper.find('.messages').exists()).toBe(false);
    wrapper.unmount();
  });

  it('shows a waiting message before the room join completes', async () => {
    const conference = useConferenceStore();
    conference.conferenceObject = undefined;
    conference.isJoined = false;
    const { wrapper } = await mountWithApp(ChatPanel);
    await wrapper.find('button.ibtn').trigger('click');
    const textarea = wrapper.find('textarea');
    await textarea.setValue('hello');
    await wrapper.find('.send').trigger('click');
    expect(wrapper.find('.chatErr').text()).toContain('Waiting to connect');
    wrapper.unmount();
  });

  it('sends when the local user id is known before join state syncs', async () => {
    const { jitsi, conference } = await connectAndJoinTestConference();
    conference.isJoined = false;
    const local = useLocalStore();
    local.setMyID('local-1');
    const { wrapper } = await mountWithApp(ChatPanel);
    await wrapper.find('button.ibtn').trigger('click');
    const textarea = wrapper.find('textarea');
    await textarea.setValue('hello');
    await wrapper.find('.send').trigger('click');
    expect(jitsi.conference.sendTextMessage).toHaveBeenCalledWith('hello');
    expect(wrapper.find('.chatErr').exists()).toBe(false);
    wrapper.unmount();
  });

  it('sends when only the engine conference handle is ready', async () => {
    const { jitsi, conference } = await connectAndJoinTestConference();
    conference.isJoined = true;
    conference.conferenceObject = undefined;
    const { engine } = await import('@/composables/useMediaEngine').then((m) => m.useMediaEngine());
    const { wrapper } = await mountWithApp(ChatPanel);
    await wrapper.find('button.ibtn').trigger('click');
    const textarea = wrapper.find('textarea');
    await textarea.setValue('via engine');
    await wrapper.find('.send').trigger('click');
    expect(jitsi.conference.sendTextMessage).toHaveBeenCalledWith('via engine');
    expect(engine.getConference()).toBeTruthy();
    wrapper.unmount();
  });

  it('does not send without a conference', async () => {
    const conference = useConferenceStore();
    conference.conferenceObject = undefined;
    const { wrapper } = await mountWithApp(ChatPanel);
    await wrapper.find('button.ibtn').trigger('click');
    const textarea = wrapper.find('textarea');
    await textarea.setValue('hello');
    await wrapper.find('.send').trigger('click');
    expect(conference.messages).toHaveLength(0);
    wrapper.unmount();
  });

  it('scrolls when messages change while panel is closed', async () => {
    const conference = useConferenceStore();
    conference.conferenceObject = {} as never;
    const { wrapper } = await mountWithApp(ChatPanel);
    conference.messages = [{ id: 'u1', text: 'hi', nr: 1 }];
    await flushPromises();
    expect(wrapper.find('.messages').exists()).toBe(false);
    conference.messages.push({ id: 'u1', text: 'again', nr: 2 });
    await flushPromises();
    wrapper.unmount();
  });

  it('shows empty state when there are no messages', async () => {
    const conference = useConferenceStore();
    conference.conferenceObject = {} as never;
    conference.messages = [];
    const { wrapper } = await mountWithApp(ChatPanel);
    await wrapper.find('button.ibtn').trigger('click');
    expect(wrapper.text()).toContain('No messages yet');
    wrapper.unmount();
  });

  it('inserts emoji from the picker', async () => {
    const conference = useConferenceStore();
    conference.conferenceObject = {} as never;
    const { wrapper } = await mountWithApp(ChatPanel);
    await wrapper.find('button.ibtn').trigger('click');
    const textarea = wrapper.find('textarea');
    await textarea.setValue('hi ');
    await wrapper.find('.emojiBtn').trigger('click');
    expect((textarea.element as HTMLTextAreaElement).value).toContain('😀');
    wrapper.unmount();
  });

  it('uses an empty sender id when neither local nor engine ids exist', async () => {
    const { conference } = await connectAndJoinTestConference();
    const local = useLocalStore();
    const { engine } = await import('@/composables/useMediaEngine').then((m) => m.useMediaEngine());
    local.setMyID('');
    vi.spyOn(engine, 'getLocalUserId').mockReturnValue(undefined);
    const { wrapper } = await mountWithApp(ChatPanel);
    await wrapper.find('button.ibtn').trigger('click');
    const textarea = wrapper.find('textarea');
    await textarea.setValue('hello');
    await wrapper.find('.send').trigger('click');
    expect(conference.messages[0]?.id).toBe('');
    wrapper.unmount();
  });

  it('uses engine user id for optimistic messages when local id is unset', async () => {
    const { conference } = await connectAndJoinTestConference();
    const local = useLocalStore();
    const { engine } = await import('@/composables/useMediaEngine').then((m) => m.useMediaEngine());
    local.setMyID('');
    vi.spyOn(engine, 'getLocalUserId').mockReturnValue('engine-user');
    const { wrapper } = await mountWithApp(ChatPanel);
    await wrapper.find('button.ibtn').trigger('click');
    const textarea = wrapper.find('textarea');
    await textarea.setValue('hello');
    await wrapper.find('.send').trigger('click');
    expect(conference.messages[0]?.id).toBe('engine-user');
    wrapper.unmount();
  });

  it('shows inline errors when send fails', async () => {
    const { conference } = await connectAndJoinTestConference();
    const local = useLocalStore();
    local.setMyID('local-1');
    const { getMediaEngineInstance } = await import('@/services/mediaEngineSingleton');
    vi.spyOn(getMediaEngineInstance(), 'sendTextMessage').mockReturnValue(false);
    const { wrapper } = await mountWithApp(ChatPanel);
    await wrapper.find('button.ibtn').trigger('click');
    const textarea = wrapper.find('textarea');
    await textarea.setValue('oops');
    await wrapper.find('.send').trigger('click');
    expect(wrapper.find('.chatErr').text()).toContain('Could not send');
    wrapper.unmount();
  });

  it('scrolls when the panel opens', async () => {
    const conference = useConferenceStore();
    conference.isJoined = true;
    const { wrapper } = await mountWithApp(ChatPanel);
    await wrapper.find('button.ibtn').trigger('click');
    await flushPromises();
    const chatRoot = wrapper.find('.messages').element as HTMLElement;
    Object.defineProperty(chatRoot, 'scrollHeight', { value: 300, configurable: true });
    conference.messages = [{ id: 'u1', text: 'hi', nr: 1 }];
    await flushPromises();
    await nextTick();
    expect(chatRoot.scrollTop).toBe(300);
    wrapper.unmount();
  });

  it('keeps the waiting message while the room is still not ready', async () => {
    const conference = useConferenceStore();
    const local = useLocalStore();
    local.setMyID('');
    conference.conferenceObject = undefined;
    conference.isJoined = false;
    const { engine } = await import('@/composables/useMediaEngine').then((m) => m.useMediaEngine());
    vi.spyOn(engine, 'getLocalUserId').mockReturnValue(undefined);
    vi.spyOn(engine, 'getConference').mockReturnValue(undefined);
    const { wrapper } = await mountWithApp(ChatPanel);
    await wrapper.find('button.ibtn').trigger('click');
    const textarea = wrapper.find('textarea');
    await textarea.setValue('hello');
    await wrapper.find('.send').trigger('click');
    expect(wrapper.find('.chatErr').exists()).toBe(true);
    conference.conferenceObject = {} as never;
    await flushPromises();
    expect(wrapper.find('.chatErr').text()).toContain('Waiting');
    wrapper.unmount();
  });

  it('clears the waiting message when the room becomes ready', async () => {
    const conference = useConferenceStore();
    const local = useLocalStore();
    local.setMyID('me');
    conference.conferenceObject = {} as never;
    conference.isJoined = false;
    const { wrapper } = await mountWithApp(ChatPanel);
    await wrapper.find('button.ibtn').trigger('click');
    const textarea = wrapper.find('textarea');
    await textarea.setValue('hello');
    await wrapper.find('.send').trigger('click');
    expect(wrapper.find('.chatErr').exists()).toBe(true);
    conference.isJoined = true;
    await flushPromises();
    expect(wrapper.find('.chatErr').exists()).toBe(false);
    wrapper.unmount();
  });

  it('clears chat errors when the panel closes', async () => {
    const conference = useConferenceStore();
    conference.conferenceObject = {} as never;
    conference.isJoined = false;
    const { wrapper } = await mountWithApp(ChatPanel);
    await wrapper.find('button.ibtn').trigger('click');
    const textarea = wrapper.find('textarea');
    await textarea.setValue('hello');
    await wrapper.find('.send').trigger('click');
    expect(wrapper.find('.chatErr').exists()).toBe(true);
    await wrapper.find('.close').trigger('click');
    await flushPromises();
    await wrapper.find('button.ibtn').trigger('click');
    expect(wrapper.find('.chatErr').exists()).toBe(false);
    wrapper.unmount();
  });

  it('edits messages, shows edited label, and reveals history for hosts', async () => {
    const conference = useConferenceStore();
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('me');
    features.setHost('me');
    conference.conferenceObject = {} as never;
    conference.isJoined = true;
    conference.messages = [
      { ...chatMsg('me', 'original', 1), history: ['older version'] },
      chatMsg('bob', 'from bob', 2),
    ];
    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');
    const { wrapper } = await mountWithApp(ChatPanel);
    await wrapper.find('button.ibtn').trigger('click');
    expect(wrapper.find('.chatEl.mine').exists()).toBe(true);
    const editBtn = wrapper.findAll('.linkBtn.subtle').find((b) => b.text() === 'Edit');
    expect(editBtn).toBeTruthy();
    await editBtn!.trigger('click');
    const editTa = wrapper.find('.editTa');
    await editTa.setValue('updated text');
    await wrapper.find('.linkBtn').trigger('click');
    expect(conference.messages[0].text).toBe('updated text');
    expect(conference.messages[0].editedAt).toBeTruthy();
    expect(cmdSpy).toHaveBeenCalledWith('chat', expect.stringContaining('"action":"edit"'));
    expect(wrapper.text()).toContain('Edited');
    await wrapper.find('.linkBtn.subtle').trigger('click');
    expect(wrapper.find('.historyList').exists()).toBe(true);
    await editTa.setValue('keyboard save');
    editTa.element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    expect(conference.messages[0].text).toBe('keyboard save');
    await editBtn!.trigger('click');
    await wrapper.find('.editTa').setValue('line two');
    await wrapper.find('.editTa').trigger('keydown', { key: 'Enter', shiftKey: true });
    expect(wrapper.find('.editTa').exists()).toBe(true);
    await editBtn!.trigger('click');
    await wrapper.find('.editTa').setValue('nope');
    await wrapper.find('.editActions .subtle').trigger('click');
    expect(wrapper.find('.editTa').exists()).toBe(false);
    await editBtn!.trigger('click');
    await wrapper.find('.editTa').setValue('x');
    await wrapper.find('.editTa').trigger('keydown', { key: 'Escape' });
    expect(wrapper.find('.editTa').exists()).toBe(false);
    wrapper.unmount();
  });

  it('ignores whitespace-only sends when the room is ready', async () => {
    const { conference } = await connectAndJoinTestConference();
    const local = useLocalStore();
    local.setMyID('me');
    const { wrapper } = await mountWithApp(ChatPanel);
    await wrapper.find('button.ibtn').trigger('click');
    await wrapper.find('textarea').setValue('   ');
    await wrapper.find('.send').trigger('click');
    expect(conference.messages).toHaveLength(0);
    expect(wrapper.find('.chatErr').exists()).toBe(false);
    wrapper.unmount();
  });

  it('scrolls on message updates while the panel stays open', async () => {
    const conference = useConferenceStore();
    conference.conferenceObject = {} as never;
    conference.messages = [chatMsg('u1', 'one', 1)];
    const { wrapper } = await mountWithApp(ChatPanel);
    await wrapper.find('button.ibtn').trigger('click');
    const chatRoot = wrapper.find('.messages').element as HTMLElement;
    Object.defineProperty(chatRoot, 'scrollHeight', { value: 250, configurable: true });
    conference.messages = [...conference.messages, chatMsg('u1', 'two', 2)];
    await flushPromises();
    await nextTick();
    expect(chatRoot.scrollTop).toBe(250);
    wrapper.unmount();
  });

  it('keeps chat errors when join state changes but chat is still unavailable', async () => {
    const conference = useConferenceStore();
    const local = useLocalStore();
    const { engine } = await import('@/composables/useMediaEngine').then((m) => m.useMediaEngine());
    local.setMyID('');
    conference.conferenceObject = undefined;
    conference.isJoined = false;
    vi.spyOn(engine, 'getConference').mockReturnValue(undefined);
    vi.spyOn(engine, 'getLocalUserId').mockReturnValue(undefined);
    const { wrapper } = await mountWithApp(ChatPanel);
    await wrapper.find('button.ibtn').trigger('click');
    await wrapper.find('textarea').setValue('hello');
    await wrapper.find('.send').trigger('click');
    expect(wrapper.find('.chatErr').text()).toContain('Waiting');
    conference.isJoined = true;
    await flushPromises();
    expect(wrapper.find('.chatErr').text()).toContain('Waiting');
    wrapper.unmount();
  });

  it('shows an error when edit cannot be published', async () => {
    const conference = useConferenceStore();
    const local = useLocalStore();
    const { engine } = await import('@/composables/useMediaEngine').then((m) => m.useMediaEngine());
    local.setMyID('');
    conference.conferenceObject = undefined;
    conference.isJoined = false;
    vi.spyOn(engine, 'getConference').mockReturnValue(undefined);
    vi.spyOn(engine, 'getLocalUserId').mockReturnValue(undefined);
    conference.messages = [chatMsg('', 'x', 1)];
    const { wrapper } = await mountWithApp(ChatPanel);
    await wrapper.find('button.ibtn').trigger('click');
    await wrapper.find('.linkBtn.subtle').trigger('click');
    await wrapper.find('.editTa').setValue('fail');
    await wrapper.find('.editActions .linkBtn').trigger('click');
    expect(wrapper.find('.chatErr').text()).toContain('Could not save');
    wrapper.unmount();
  });

  it('closes via MenuCard and scrolls when messages arrive', async () => {
    const conference = useConferenceStore();
    conference.conferenceObject = {} as never;
    const { wrapper } = await mountWithApp(ChatPanel);
    await wrapper.find('button.ibtn').trigger('click');
    const chatRoot = wrapper.find('.messages').element as HTMLElement;
    Object.defineProperty(chatRoot, 'scrollHeight', { value: 200, configurable: true });
    conference.messages = [{ id: 'u1', text: 'a', nr: 1 }];
    await flushPromises();
    await nextTick();
    expect(chatRoot.scrollTop).toBe(200);
    conference.messages.push({ id: 'u1', text: 'b', nr: 2 });
    await flushPromises();
    await nextTick();
    await wrapper.find('.close').trigger('click');
    await nextTick();
    expect(wrapper.find('.messages').exists()).toBe(false);
    wrapper.unmount();
  });
});
