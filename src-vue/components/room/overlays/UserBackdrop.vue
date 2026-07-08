<script setup lang="ts">
import AppIcon from '@/components/ui/AppIcon.vue';
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    onStage?: boolean;
    displayName?: string;
  }>(),
  { onStage: false, displayName: '' },
);

const avatarUrl = computed(() => {
  const seed = props.displayName ? props.displayName.replace(/'s Sphere|' Sphere/i, '').trim() : 'Guest';
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}`;
});
</script>

<template>
  <div v-if="onStage" class="base onStage">
    <AppIcon name="stage" class="ic" :size="32" />
    Presenting
  </div>
  <div v-else class="base avatar">
    <img :src="avatarUrl" alt="" class="avatarImg" />
  </div>
</template>

<style scoped>
.base {
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: var(--color-mono95);
  color: var(--color-mono30);
  font-weight: bold;
}
.ic {
  color: var(--color-mono40);
}
.onStage {
  background: var(--color-bg-inset);
  color: white;
}
.onStage .ic {
  margin-bottom: 4px;
  color: var(--color-blue100);
}
.avatarImg {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  display: block;
}
</style>
