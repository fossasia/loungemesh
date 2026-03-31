<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import IconButton from '@/components/ui/IconButton.vue';
import ChatIcon from '@/components/icons/ChatIcon.vue';
import MenuCard from '@/components/common/MenuCard.vue';
import { splitMessage } from './splitMessage';
import { displayNameForMessage } from './displayNameForMessage';
import { commitChatSend, handleChatKeydown, scrollChatToBottom } from './chatPanelActions';

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
    <MenuCard v-if="open" title="Chat" :onClose="() => (open = false)">
      <div ref="chatRoot" class="contentArea">
        <div v-for="(message, key) in conference.messages" :key="key" class="chatEl">
          <div class="userName">{{ displayNameForMessage(message.id, local.id, conference.users) }}</div>
          <span class="msgText">
            <template v-for="(seg, i) in splitMessage(message.text)" :key="i">
              <a v-if="seg.href" :href="seg.href" target="_blank" rel="noopener noreferrer">{{ seg.text }} </a>
              <span v-else>{{ seg.text }}</span>
            </template>
          </span>
        </div>
      </div>

      <div class="input">
        <textarea ref="inputEl" id="chatInput" class="ta" @keydown="onKeydown" />
        <button type="button" class="send" @click="sendMessage">Send</button>
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
.svg :deep(path),
.svg :deep(rect),
.svg :deep(ellipse) {
  stroke: var(--btn-default-fg);
}

/* Legacy Chat modal layout from src/addons/Chat/Chat.tsx */
.contentArea {
  position: absolute;
  right: 15px;
  left: 15px;
  top: 80px;
  bottom: 80px;
  overflow: scroll;
}
.chatEl {
  margin-bottom: 15px;
  width: 100%;
  text-align: left;
}
.userName {
  color: #79809a;
  font-size: 1em;
  line-height: 1.2em;
  padding: 0 0 3px 0;
  font-weight: bolder;
}
.msgText {
  color: #272a35;
  font-size: 1em;
  line-height: 1.2em;
  margin: 0;
  padding: 0;
  white-space: pre-wrap;
}
.input {
  position: absolute;
  bottom: 10px;
  right: 10px;
  left: 10px;
  display: flex;
  border-radius: 4px;
  height: 48px;
  flex-direction: row;
  background: rgba(255, 255, 255, 1);
  border: 1px solid rgba(220, 222, 225, 1);
  justify-content: space-between;
}
.ta {
  display: table-cell;
  vertical-align: middle;
  resize: none;
  margin: 5px;
  flex-grow: 3;
  border: none;
  outline: none;
}
.send {
  border: none;
  background: transparent;
  padding: 0 12px;
  cursor: pointer;
}
</style>
