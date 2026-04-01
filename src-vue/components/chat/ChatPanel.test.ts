import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextTick } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { connectAndJoinTestConference } from '@/test/jitsiTestContext';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import ChatPanel from './ChatPanel.vue';

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

    conference.conferenceObject = {} as never;
    await textarea.setValue('blocked');
    await textarea.trigger('keydown', { key: 'Enter' });
    conference.messages.push({ id: 'local-1', text: 'scroll', nr: 4 });
    await flushPromises();
    await nextTick();
    const chatRoot = wrapper.find('.contentArea').element as HTMLElement;
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
    expect(wrapper.text()).toContain('You');
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
      { id: 'bob', text: 'https://only.example', nr: 6 },
    ];

    const { wrapper } = await mountWithApp(ChatPanel);
    await wrapper.find('button.ibtn').trigger('click');
    expect(wrapper.text()).toContain('You');
    expect(wrapper.text()).toContain('Bob');
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
    expect(wrapper.find('.contentArea').exists()).toBe(false);
    wrapper.unmount();
  });

  it('ignores message watch when chat panel is closed', async () => {
    const conference = useConferenceStore();
    conference.conferenceObject = {} as never;
    const { wrapper } = await mountWithApp(ChatPanel);
    conference.messages.push({ id: 'u1', text: 'new', nr: 1 });
    await flushPromises();
    expect(wrapper.find('.contentArea').exists()).toBe(false);
    wrapper.unmount();
  });

  it('does not send when there is no conference', async () => {
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

  it('closes via MenuCard and scrolls when messages arrive', async () => {
    const conference = useConferenceStore();
    conference.conferenceObject = {} as never;
    const { wrapper } = await mountWithApp(ChatPanel);
    await wrapper.find('button.ibtn').trigger('click');
    const chatRoot = wrapper.find('.contentArea').element as HTMLElement;
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
    expect(wrapper.find('.contentArea').exists()).toBe(false);
    wrapper.unmount();
  });
});
