<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { useMediaEngine } from '@/composables/useMediaEngine';
import { isChatReady } from '@/utils/chatConferenceReady';
import { createChatMessage } from '@/utils/chatMessage';
import {
  canEditChatMessage,
  chatAuthorStyle,
  formatEditedAt,
} from '@/utils/chatMessage';
import IconButton from '@/components/ui/IconButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import MenuCard from '@/components/common/MenuCard.vue';
import { splitMessage } from './splitMessage';
import { displayNameForMessage } from './displayNameForMessage';
import {
  addEmojiToInput,
  commitChatEdit,
  commitChatSend,
  handleChatKeydown,
  scrollChatToBottom,
} from './chatPanelActions';
import { CHAT_EMOJIS } from './insertEmoji';
import { chatPanelWidth, sessionPanelLayout } from '@/constants/sessionPanels';
import { playUiSound } from '@/utils/uiSounds';

const conference = useConferenceStore();
const local = useLocalStore();
const features = useSessionFeaturesStore();
const { engine, joined: engineJoined } = useMediaEngine();
const open = ref(false);
const chatSeenCount = ref(0);
const chatRoot = ref<HTMLElement | null>(null);
const inputEl = ref<HTMLTextAreaElement | null>(null);
const chatError = ref('');
const editingId = ref<string | null>(null);
const editDraft = ref('');
const historyOpen = ref<Record<string, boolean>>({});

const localUserId = computed(() => local.id || engine.getLocalUserId() || '');

const hasUnreadChat = computed(
  () => !open.value && conference.messages.length > chatSeenCount.value,
);

function markChatSeen() {
  chatSeenCount.value = conference.messages.length;
}

function chatReady() {
  return isChatReady(
    conference.conferenceObject,
    engine.getConference(),
    conference.isJoined,
    engineJoined.value,
    localUserId.value,
  );
}

function sendMessage() {
  const el = inputEl.value as HTMLTextAreaElement;
  const senderId = localUserId.value;
  const result = commitChatSend(
    el.value,
    chatReady(),
    (text) => conference.sendTextMessage(text),
    (text, messageId) => {
      conference.appendChatMessage(createChatMessage(senderId, text, -Date.now(), messageId));
      el.value = '';
      chatError.value = '';
      playUiSound('send');
    },
  );
  if (!result.ok && result.reason === 'not_ready') {
    chatError.value = 'Waiting to connect to the room…';
  }
  if (!result.ok && result.reason === 'send_failed') {
    chatError.value = 'Could not send message. Try again.';
  }
}

function startEdit(messageId: string, text: string) {
  editingId.value = messageId;
  editDraft.value = text;
}

function cancelEdit() {
  editingId.value = null;
  editDraft.value = '';
}

function saveEdit(messageId: string) {
  const result = commitChatEdit(
    editDraft.value,
    chatReady(),
    (id, text, editedAt) => {
      conference.editChatMessage(id, text, editedAt);
      engine.sendCommand(
        'chat',
        JSON.stringify({ action: 'edit', messageId: id, text, editedAt }),
      );
    },
    messageId,
  );
  if (!result.ok) {
    chatError.value = 'Could not save edit.';
    return;
  }
  chatError.value = '';
  cancelEdit();
}

function onEditKeydown(e: KeyboardEvent, messageId: string) {
  if (e.key === 'Escape') {
    e.preventDefault();
    cancelEdit();
    return;
  }
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    saveEdit(messageId);
  }
}

function toggleHistory(messageId: string) {
  historyOpen.value[messageId] = !historyOpen.value[messageId];
}

function onKeydown(e: KeyboardEvent) {
  const el = inputEl.value as HTMLTextAreaElement;
  handleChatKeydown(e, el, sendMessage);
}

function addEmoji(emoji: string) {
  addEmojiToInput(inputEl.value, emoji);
}

async function scrollChatIfOpen() {
  await nextTick();
  scrollChatToBottom(chatRoot.value);
}

async function onChatPanelOpen(isOpen: boolean) {
  if (!isOpen) return;
  markChatSeen();
  chatError.value = '';
  await nextTick();
  scrollChatToBottom(chatRoot.value);
}

function onIncomingMessages(nextCount: number, prevCount: number) {
  if (nextCount <= prevCount) return;
  if (open.value) {
    markChatSeen();
    void scrollChatIfOpen();
    return;
  }
  const latest = conference.messages[nextCount - 1];
  if (latest && latest.id !== localUserId.value) {
    playUiSound('chatMessage');
  }
}

watch(() => conference.messages.length, onIncomingMessages);
watch(open, onChatPanelOpen);
watch(
  () => [conference.isJoined, engineJoined.value, conference.conferenceObject],
  () => {
    if (chatReady()) chatError.value = '';
  },
);
</script>

<template>
  <div class="wrap">
    <MenuCard
      v-if="open"
      title="Chat"
      class="chatCard"
      :style="{
        width: chatPanelWidth,
        height: sessionPanelLayout.height,
        bottom: sessionPanelLayout.bottom,
        right: sessionPanelLayout.right,
      }"
      :onClose="() => (open = false)"
    >
      <div ref="chatRoot" class="messages">
        <p v-if="!conference.messages.length" class="empty">No messages yet.</p>
        <div
          v-for="message in conference.messages"
          :key="`${message.id}-${message.nr}`"
          class="chatEl"
          :class="{ mine: message.id === localUserId }"
        >
          <div class="bubble">
            <div class="userName" :style="chatAuthorStyle(message.id)">
              {{ displayNameForMessage(message.id, localUserId, conference.users) }}
            </div>

            <div v-if="editingId === message.messageId" class="editBox">
              <textarea
                v-model="editDraft"
                class="editTa"
                rows="2"
                @keydown="onEditKeydown($event, message.messageId)"
              />
              <div class="editActions">
                <button type="button" class="linkBtn" @click="saveEdit(message.messageId)">
                  Save
                </button>
                <button type="button" class="linkBtn subtle" @click="cancelEdit">Cancel</button>
              </div>
            </div>

            <template v-else>
              <span class="msgText">
                <template v-for="(seg, i) in splitMessage(message.text)" :key="i">
                  <a
                    v-if="seg.href"
                    :href="seg.href"
                    target="_blank"
                    rel="noopener noreferrer"
                    >{{ seg.text }}</a
                  >
                  <span v-else>{{ seg.text }}</span>
                </template>
              </span>
              <p v-if="message.editedAt" class="edited">
                Edited {{ formatEditedAt(message.editedAt) }}
              </p>
              <div
                v-if="features.isHost && message.history?.length"
                class="historyBlock"
              >
                <button
                  type="button"
                  class="linkBtn subtle"
                  @click="toggleHistory(message.messageId)"
                >
                  {{ historyOpen[message.messageId] ? 'Hide' : 'Show' }} previous versions
                </button>
                <ul v-if="historyOpen[message.messageId]" class="historyList">
                  <li v-for="(prev, idx) in message.history" :key="idx">{{ prev }}</li>
                </ul>
              </div>
            </template>

            <div
              v-if="editingId !== message.messageId && canEditChatMessage(message, localUserId, features.isHost)"
              class="msgActions"
            >
              <button
                type="button"
                class="linkBtn subtle"
                @click="startEdit(message.messageId, message.text)"
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="emojiRow">
        <button
          v-for="emoji in CHAT_EMOJIS"
          :key="emoji"
          type="button"
          class="emojiBtn"
          :title="`Insert ${emoji}`"
          @click="addEmoji(emoji)"
        >
          {{ emoji }}
        </button>
      </div>

      <p v-if="chatError" class="chatErr" role="alert">{{ chatError }}</p>

      <div class="input">
        <textarea
          ref="inputEl"
          id="chatInput"
          class="ta"
          rows="2"
          placeholder="Message…"
          @keydown="onKeydown"
        />
        <button type="button" class="send" title="Send message" @click="sendMessage">Send</button>
      </div>
    </MenuCard>

    <IconButton
      label="Chat"
      :highlight="open"
      :activity-dot="hasUnreadChat"
      sound="panel"
      @click="open = !open"
    >
      <template #icon><AppIcon name="chat" /></template>
    </IconButton>
  </div>
</template>

<style scoped>
.wrap {
  position: relative;
  display: inline-flex;
}
.chatCard {
  display: flex;
  flex-direction: column;
  top: auto;
}
.messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 0;
  margin-bottom: 10px;
}
.empty {
  margin: 0;
  color: var(--color-mono30);
  font-size: var(--fs-small);
}
.chatEl {
  margin-bottom: 12px;
  display: flex;
}
.chatEl.mine {
  justify-content: flex-end;
}
.bubble {
  max-width: 92%;
  padding: 8px 12px;
  border-radius: 12px;
  background: #fff;
  border: 1px solid var(--line-light);
  text-align: left;
}
.chatEl.mine .bubble {
  background: var(--color-mono95);
  border-color: var(--color-mono80);
}
.userName {
  font-size: 0.8em;
  line-height: 1.2;
  padding-bottom: 4px;
  font-weight: 700;
}
.msgText {
  color: #272a35;
  font-size: 1em;
  line-height: 1.35;
  white-space: pre-wrap;
  word-break: break-word;
}
.msgText a {
  color: var(--color-blue100);
}
.edited {
  margin: 6px 0 0;
  font-size: var(--fs-small);
  color: var(--color-mono30);
  font-style: italic;
}
.historyBlock {
  margin-top: 6px;
}
.historyList {
  margin: 6px 0 0;
  padding-left: 1.1rem;
  font-size: var(--fs-small);
  color: var(--color-mono30);
}
.msgActions {
  margin-top: 6px;
}
.editBox {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.editTa {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--line-dark);
  border-radius: var(--radius-sm);
  padding: 6px;
  font-family: var(--font-body);
  font-size: var(--fs-body);
  resize: vertical;
}
.editActions {
  display: flex;
  gap: 10px;
}
.linkBtn {
  border: none;
  background: none;
  padding: 0;
  font-size: var(--fs-small);
  font-weight: 600;
  color: var(--color-blue100);
  cursor: pointer;
  font-family: var(--font-body);
}
.linkBtn.subtle {
  color: var(--color-mono30);
  font-weight: 500;
}
.emojiRow {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
  max-height: 120px;
  overflow-y: auto;
  padding: 4px 2px;
  flex-shrink: 0;
}
.emojiBtn {
  border: none;
  background: var(--color-mono95);
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 1.2rem;
  cursor: pointer;
  line-height: 1;
  min-width: 36px;
}
.emojiBtn:hover {
  background: var(--btn-default-bg-hover);
}
.chatErr {
  margin: 0 0 8px;
  font-size: var(--fs-small);
  color: var(--color-red100);
}
.input {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  border-radius: 4px;
  min-height: 52px;
  background: #fff;
  border: 1px solid rgba(220, 222, 225, 1);
}
.ta {
  flex: 1;
  resize: none;
  margin: 6px;
  border: none;
  outline: none;
  font-family: var(--font-body);
  font-size: var(--fs-body);
}
.send {
  border: none;
  background: transparent;
  padding: 0 14px;
  cursor: pointer;
  font-weight: 600;
  color: var(--color-blue100);
}
</style>
