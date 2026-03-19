<script setup lang="ts">
import ReloadIcon from '@/assets/reloadIcon.svg';
import StageIcon from '@/components/icons/StageIcon.vue';

withDefaults(
  defineProps<{
    onStage?: boolean;
  }>(),
  { onStage: false }
);
</script>

<template>
  <div v-if="onStage" class="base onStage">
    <StageIcon class="ic" />
    Presenting
  </div>
  <div v-else class="base reload">
    <img :src="ReloadIcon" alt="" class="icImg" />
    Maybe try a reload?
  </div>
</template>

<style scoped>
/* Legacy `UserBackdrop` from src/components/User/components/Backdrop/UserBackdrop.tsx */
.base {
  position: absolute;
  top: 0;
  z-index: -1;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  /* Production sphere should not “glow blue” around edges. */
  background: var(--color-mono95);
  color: var(--color-mono30);
  font-weight: bold;
}
.ic {
  margin: 5px;
  width: 32px;
  height: 32px;
  stroke: currentColor;
}
.icImg {
  margin: 5px;
  width: 32px;
  height: 32px;
}
.onStage {
  background: var(--color-bg-inset);
  color: white;
}
</style>

