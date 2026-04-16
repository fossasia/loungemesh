<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import IconButton from '@/components/ui/IconButton.vue';
import ChatIcon from '@/components/icons/ChatIcon.vue';
import MenuCard from '@/components/common/MenuCard.vue';
import { splitMessage } from './splitMessage';
import { displayNameForMessage } from './displayNameForMessage';
import {
  addEmojiToInput,
  commitChatSend,
  handleChatKeydown,
  scrollChatToBottom,
} from './chatPanelActions';
import { CHAT_EMOJIS } from './insertEmoji';

const conference = useConferenceStore();
const local = useLocalStore();
const open = ref(false);
const chatRoot = ref<HTMLElement | null>(null);
const inputEl = ref<HTMLTextAreaElement | null>(null);

function sendMessage() {
  const el = inputEl.value as HTMLTextAreaElement;
  commitChatSend(
    el.value,
    !!conference.conferenceObject,
    (text) => conference.sendTextMessage(text),
    () => {
      el.value = '';
    },
  );
}

function onKeydown(e: KeyboardEvent) {
  const el = inputEl.value as HTMLTextAreaElement;
  handleChatKeydown(e, el, sendMessage);
}

function addEmoji(emoji: string) {
  addEmojiToInput(inputEl.value, emoji);
}

watch(
  () => conference.messages.length,
  async () => {
    await nextTick();
    scrollChatToBottom(chatRoot.value);
  },
);
</script>

<template>
  <div class="wrap">
    <MenuCard v-if="open" title="Chat" class="chatCard" :onClose="() => (open = false)">
      <div ref="chatRoot" class="messages">
        <p v-if="!conference.messages.length" class="empty">No messages yet.</p>
        <div
          v-for="message in conference.messages"
          :key="`${message.id}-${message.nr}`"
          class="chatEl"
        >
          <div class="userName">
            {{ displayNameForMessage(message.id, local.id, conference.users) }}
          </div>
          <span class="msgText">
            <template v-for="(seg, i) in splitMessage(message.text)" :key="i">
              <a v-if="seg.href" :href="seg.href" target="_blank" rel="noopener noreferrer">{{
                seg.text
              }}</a>
              <span v-else>{{ seg.text }}</span>
            </template>
          </span>
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

    <IconButton label="Chat" :active="open" ghost @click="open = !open">
      <template #icon><ChatIcon class="svg" /></template>
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
  width: min(320px, calc(100vw - 24px));
  height: min(420px, calc(100vh - 120px));
  bottom: 72px;
  right: 12px;
  top: auto;
}
.messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 4px;
  margin-bottom: 8px;
}
.empty {
  margin: 0;
  color: var(--color-mono30);
  font-size: var(--fs-small);
}
.chatEl {
  margin-bottom: 12px;
  text-align: left;
}
.userName {
  color: #79809a;
  font-size: 0.85em;
  line-height: 1.2;
  padding-bottom: 2px;
  font-weight: 600;
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
.emojiRow {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}
.emojiBtn {
  border: none;
  background: var(--color-mono95);
  border-radius: 6px;
  padding: 4px 6px;
  font-size: 1.1rem;
  cursor: pointer;
  line-height: 1;
}
.emojiBtn:hover {
  background: var(--btn-default-bg-hover);
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
.svg :deep(path),
.svg :deep(rect),
.svg :deep(ellipse) {
  stroke: var(--btn-default-fg);
}
</style>
