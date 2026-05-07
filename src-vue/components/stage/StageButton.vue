<script setup lang="ts">
import { onBeforeUnmount } from 'vue';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { useMediaEngine } from '@/composables/useMediaEngine';
import IconButton from '@/components/ui/IconButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const local = useLocalStore();
const features = useSessionFeaturesStore();
const { engine } = useMediaEngine();

function toggle() {
  if (!features.canUseStage && !local.onStage) return;
  const next = !local.onStage;
  local.setOnStage(next);
  engine.setLocalParticipantProperty('onStage', next);
}

onBeforeUnmount(() => {
  local.setOnStage(false);
});
</script>

<template>
  <IconButton
    label="Stage"
    :active="local.onStage"
    :title="features.canUseStage ? 'Stage' : 'Stage — ask host for access'"
    @click="toggle"
  >
    <template #icon><AppIcon name="stage" /></template>
  </IconButton>
</template>
