<script setup lang="ts">
import { computed } from 'vue';
import type { JitsiTrackLike } from '@/types/jitsi';
import { useLocalStore } from '@/stores/localStore';
import StageAudioAttach from '@/components/stage/StageAudioAttach.vue';
import StageVideoAttach from '@/components/stage/StageVideoAttach.vue';
import ResizeControl from './ResizeControl.vue';

const props = withDefaults(
  defineProps<{
    id: string;
    video?: JitsiTrackLike;
    audio?: JitsiTrackLike;
    volume: number;
    selected?: boolean;
  }>(),
  { selected: false }
);

const local = useLocalStore();
const isSelected = computed(() => !!props.selected);

function toggleSelect() {
  local.setSelectedUserOnStage(props.id);
}
</script>

<template>
  <Teleport v-if="isSelected" to="body">
    <div class="selectedUserContainer">
      <div class="userContainer">
        <StageAudioAttach :track="audio" :volume="volume" />
        <StageVideoAttach class="stage_video" :track="video" />
        <ResizeControl :onClick="toggleSelect" />
      </div>
    </div>
  </Teleport>

  <div v-else class="userContainer">
    <StageAudioAttach :track="audio" :volume="volume" />
    <StageVideoAttach class="stage_video" :track="video" />
    <ResizeControl :onClick="toggleSelect" />
  </div>
</template>

<style scoped>
/* Legacy StageUser containers from src/addons/Stage/components/StageUser.tsx */
.userContainer {
  width: 100%;
  height: auto;
  background-color: white;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 24px 48px 0 rgba(0, 0, 0, 0.25);
  position: relative;
}

.selectedUserContainer {
  position: absolute;
  width: auto;
  max-width: 90%;
  height: 50%;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10050;
}
.selectedUserContainer > div {
  width: auto;
  height: 100%;
}
</style>

