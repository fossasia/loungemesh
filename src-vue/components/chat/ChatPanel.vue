<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import IconButton from '@/components/ui/IconButton.vue';
import ChatIcon from '@/components/icons/ChatIcon.vue';
import MenuCard from '@/components/common/MenuCard.vue';

const conference = useConferenceStore();
const local = useLocalStore();
const open = ref(false);
const chatRoot = ref<HTMLElement | null>(null);
const inputEl = ref<HTMLTextAreaElement | null>(null);

function splitMessage(txt: string): Array<{ text: string; href?: string }> {
  const re = /(https?:\/\/[^\s]+)/g;
  const segments: Array<{ text: string; href?: string }> = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(txt)) !== null) {
    if (m.index > last) segments.push({ text: txt.slice(last, m.index) });
    segments.push({ text: m[0], href: m[0] });
    last = m.index + m[0].length;
  }
  if (last < txt.length) segments.push({ text: txt.slice(last) });
  return segments.length ? segments : [{ text: txt }];
}

function displayNameForMessage(id: string) {
  if (id && local.id && id === local.id) return 'You';
  const u = conference.users[id] as { user?: { _displayName?: string } } | undefined;
  return u?.user?._displayName ?? 'You';
}

function sendMessage() {
  const raw = inputEl.value?.value?.trim() ?? '';
  if (!raw || !conference.conferenceObject) return;
  conference.sendTextMessage(raw);
  if (inputEl.value) inputEl.value.value = '';
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && e.altKey) {
    e.preventDefault();
    const el = inputEl.value;
    if (el) el.value += '\n';
  } else if (e.key === 'Enter') {
    e.preventDefault();
    sendMessage();
  }
}

watch(
  () => conference.messages.length,
  async () => {
    await nextTick();
    const el = chatRoot.value;
    if (el) el.scrollTop = el.scrollHeight;
  }
);
</script>

<template>
  <div class="wrap">
    <MenuCard v-if="open" title="Chat" :onClose="() => (open = false)">
      <div ref="chatRoot" class="contentArea">
        <div v-for="(message, key) in conference.messages" :key="key" class="chatEl">
          <div class="userName">{{ displayNameForMessage(message.id) }}</div>
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
