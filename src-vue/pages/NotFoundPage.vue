<script setup lang="ts">
import { playUiSound } from '@/utils/uiSounds';
import StatusScreen from '@/components/common/StatusScreen.vue';

function goHome() {
  playUiSound('tap');
}
</script>

<template>
  <StatusScreen
    title="404 - Space Not Found"
    message="The sphere or page you are looking for has drifted out of orbit or doesn't exist."
    icon="info"
  >
    <router-link :to="{ name: 'home' }" class="notfound-btn" @click="goHome">
      Return to Orbit
    </router-link>
  </StatusScreen>
</template>

<style scoped>
.notfound-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 46px;
  padding: 12px 20px;
  border-radius: var(--radius-round);
  background: var(--btn-primary-bg);
  color: var(--btn-primary-fg);
  text-decoration: none;
  font-weight: var(--fw-bold);
}
</style>
