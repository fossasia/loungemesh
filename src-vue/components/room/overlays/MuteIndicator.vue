<script setup lang="ts">
import MuteCatSmall from '@/assets/muteCatSmall.svg';

withDefaults(
  defineProps<{
    clickable?: boolean;
  }>(),
  { clickable: false }
);

const emit = defineEmits<{ click: [] }>();
</script>

<template>
  <div class="muteContainer" :class="{ clickable }" @click="clickable && emit('click')">
    <img :src="MuteCatSmall" alt="" />
  </div>
</template>

<style scoped>
/* Legacy `MuteContainer` from src/components/User/RemoteUser/MuteIndicator.tsx */
.muteContainer {
  position: absolute;
  top: 10px;
  left: 10px;
  transform: none;
  font-size: 2.5rem;
  cursor: default;
  pointer-events: none;
}
.muteContainer img {
  width: 34px;
  height: 34px;
  display: block;
}
.muteContainer.clickable {
  cursor: pointer;
  pointer-events: auto;
}
</style>

