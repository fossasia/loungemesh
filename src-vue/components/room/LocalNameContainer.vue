<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';

defineProps<{
  handUp?: boolean;
}>();
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { useMediaEngine } from '@/composables/useMediaEngine';
import AppIcon from '@/components/ui/AppIcon.vue';
import NameTag from './overlays/NameTag.vue';

const conference = useConferenceStore();
const local = useLocalStore();
const { engine } = useMediaEngine();
const active = ref(false);
const draft = ref(conference.displayName);

watch(
  () => conference.displayName,
  (v) => {
    if (!active.value) draft.value = v;
  },
);

const inputRef = ref<HTMLInputElement | null>(null);

function openEdit() {
  active.value = true;
  draft.value = conference.displayName || 'Enter Your Name';
  nextTick(() => inputRef.value?.focus());
}

function commit() {
  active.value = false;
  const n = draft.value.trim();
  const name = n.length ? n : conference.displayName;
  conference.setDisplayName(name);
  engine.setDisplayName(name);
  const id = local.id;
  if (id) {
    conference.updateUserDisplayName(id, name);
    if (conference.isJoined) {
      engine.sendCommand('name', JSON.stringify({ id, name }));
    }
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault();
    commit();
    return;
  }
  if (e.key === 'Enter' || e.key === 'NumpadEnter') {
    e.preventDefault();
    commit();
  }
}
</script>

<template>
  <div class="nameEditRoot" @pointerdown.stop @pointermove.stop @click.stop>
  <input
    v-if="active"
    ref="inputRef"
    v-model="draft"
    class="nameInput"
    type="text"
    :placeholder="conference.displayName"
    @blur="commit"
    @keydown="onKeydown"
  />
  <NameTag v-else class="nameRow">
    <span class="nameText">{{ conference.displayName }}</span>
    <button
      type="button"
      class="editBtn"
      aria-label="Edit sphere name"
      @click.stop="openEdit"
    >
      <AppIcon name="pencil" :size="14" :stroke-width="2" />
    </button>
  </NameTag>
  </div>
</template>

<style scoped>
.nameEditRoot {
  width: 100%;
  max-width: 200px;
}
.nameInput {
  margin-top: 5px;
  box-sizing: border-box;
  width: 100%;
  max-width: 200px;
  min-width: 120px;
  padding: 8px 5px;
  border: 1px solid var(--line-dark);
  border-radius: var(--radius-sm);
  text-align: center;
  font-weight: 400;
  font-size: var(--fs-body);
  font-family: var(--font-body);
  color: var(--color-text-default);
  background: var(--input-bg);
}
.nameInput:focus {
  outline: none;
  border: 1px solid var(--color-blue100);
}
.nameRow {
  gap: 4px;
}
.nameText {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.editBtn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin: -4px 0;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-mono0);
  background: transparent;
  cursor: pointer;
}
.editBtn:hover {
  background: rgba(255, 255, 255, 0.12);
}
.editBtn:focus-visible {
  outline: 2px solid var(--color-blue100);
  outline-offset: 1px;
}
</style>
