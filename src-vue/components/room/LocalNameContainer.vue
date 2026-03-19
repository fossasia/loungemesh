<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { useConferenceStore } from '@/stores/conferenceStore';
import NameTag from './overlays/NameTag.vue';

const conference = useConferenceStore();
const active = ref(false);
const draft = ref(conference.displayName);

watch(
  () => conference.displayName,
  (v) => {
    if (!active.value) draft.value = v;
  }
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
  conference.setDisplayName(n.length ? n : conference.displayName);
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' || e.key === 'Enter') {
    e.preventDefault();
    commit();
  }
}
</script>

<template>
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
  <NameTag
    v-else
    class="nameTagClick"
    role="button"
    tabindex="0"
    @click="openEdit"
    @keydown.enter.prevent="openEdit"
    @keydown.space.prevent="openEdit"
  >
    {{ conference.displayName }}
  </NameTag>
</template>

<style scoped>
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
.nameTagClick {
  cursor: pointer;
}
</style>
