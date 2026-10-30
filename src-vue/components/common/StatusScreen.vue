<script setup lang="ts">
import AppIcon, { type IconName } from '@/components/ui/AppIcon.vue';

withDefaults(
  defineProps<{
    title: string;
    message?: string;
    icon: IconName;
    tone?: 'info' | 'warning';
  }>(),
  { message: '', tone: 'info' },
);
</script>

<template>
  <div class="shell">
    <div class="card">
      <div class="iconCircle" :class="tone">
        <AppIcon :name="icon" :size="32" />
      </div>
      <h1 class="title">{{ title }}</h1>
      <p v-if="message" class="message">{{ message }}</p>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-page);
  font-family: var(--font-body);
  padding: 24px;
  box-sizing: border-box;
}

.card {
  width: 100%;
  max-width: 440px;
  background: var(--color-bg-card);
  border: 1px solid var(--line-light);
  border-radius: var(--radius-round);
  padding: 40px 32px;
  text-align: center;
  box-sizing: border-box;
  color: var(--color-mono10);
}

.iconCircle {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
  border: 2px solid var(--color-blue100);
  color: var(--color-blue100);
  background: var(--color-mono100);
}

.iconCircle.warning {
  border-color: var(--color-red100);
  color: var(--color-red100);
}

.title {
  margin: 0 0 12px;
  font-family: var(--font-display);
  font-size: var(--fs-h1);
  font-weight: var(--fw-bold);
  color: var(--color-mono10);
}

.message {
  margin: 0 0 24px;
  font-size: var(--fs-body);
  line-height: 1.6;
  color: var(--color-mono30);
}
</style>
