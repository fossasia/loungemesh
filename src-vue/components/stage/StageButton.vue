<script setup lang="ts">
import { onBeforeUnmount } from 'vue';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import IconButton from '@/components/ui/IconButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const conference = useConferenceStore();
const local = useLocalStore();
const features = useSessionFeaturesStore();

function toggle() {
  if (!features.canUseStage && !local.onStage) return;
  const next = !local.onStage;
  local.setOnStage(next);
  conference.conferenceObject?.setLocalParticipantProperty?.('onStage', next);
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
