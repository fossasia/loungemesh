<script setup lang="ts">
import { playUiSound } from '@/utils/uiSounds';

function goHome() {
  playUiSound('tap');
}
</script>

<template>
  <div class="notfound-shell">
    <div class="notfound-card">
      <div class="notfound-icon" aria-hidden="true">🌌</div>
      <h1 class="notfound-title">404 - Space Not Found</h1>
      <p class="notfound-msg">
        The sphere or page you are looking for has drifted out of orbit or doesn't exist.
      </p>
      <router-link :to="{ name: 'home' }" class="notfound-btn" @click="goHome">
        Return Orbit
      </router-link>
    </div>
  </div>
</template>

<style scoped>
.notfound-shell {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-page, #eef1ff);
  padding: 24px;
}
.notfound-card {
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 4px 32px rgba(79, 110, 247, 0.12);
  padding: 52px 44px;
  max-width: 440px;
  width: 100%;
  text-align: center;
}
.notfound-icon {
  font-size: 3.5rem;
  margin-bottom: 20px;
}
.notfound-title {
  font-size: 1.6rem;
  font-weight: 600;
  color: #1a1c2e;
  margin: 0 0 14px;
}
.notfound-msg {
  font-size: 0.975rem;
  color: #4b5563;
  line-height: 1.6;
  margin: 0 0 28px;
}
.notfound-btn {
  display: inline-block;
  background: #4f6ef7;
  color: #fff;
  font-size: 0.95rem;
  font-weight: 500;
  padding: 12px 28px;
  border-radius: 30px;
  text-decoration: none;
  transition: background 0.15s ease, transform 0.1s active;
  box-shadow: 0 4px 16px rgba(79, 110, 247, 0.25);
}
.notfound-btn:hover {
  background: #3b5bdb;
}
.notfound-btn:active {
  transform: scale(0.97);
}
</style>
