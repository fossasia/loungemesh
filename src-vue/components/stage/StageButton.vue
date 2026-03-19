<script setup lang="ts">
import { onBeforeUnmount } from 'vue';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import IconButton from '@/components/ui/IconButton.vue';
import StageIcon from '@/components/icons/StageIcon.vue';

const conference = useConferenceStore();
const local = useLocalStore();

function toggle() {
  const next = !local.onStage;
  local.setOnStage(next);
  conference.conferenceObject?.setLocalParticipantProperty?.('onStage', next);
}

onBeforeUnmount(() => {
  local.setOnStage(false);
});
</script>

<template>
  <IconButton label="Stage" :active="local.onStage" @click="toggle">
    <template #icon><StageIcon class="svg" /></template>
  </IconButton>
</template>

<style scoped>
.svg :deep(path),
.svg :deep(rect),
.svg :deep(ellipse) {
  stroke: var(--btn-default-fg);
}
</style>
