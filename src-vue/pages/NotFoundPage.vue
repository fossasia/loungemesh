<script setup lang="ts">
import { playUiSound } from '@/utils/uiSounds';

function goHome() {
  playUiSound('tap');
}
</script>

<template>
  <div class="notfound-shell">
    <div class="notfound-card">
      <div class="iconCircle">
        <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h1 class="notfound-title">404 - Space Not Found</h1>
      <p class="notfound-msg">
        The sphere or page you are looking for has drifted out of orbit or doesn't exist.
      </p>
      <router-link :to="{ name: 'home' }" class="notfound-btn" @click="goHome">
        Return to Orbit
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
  background: radial-gradient(circle at 50% 50%, #1e1b4b 0%, #0f0c1b 100%);
  font-family: var(--font-body, system-ui, sans-serif);
  padding: 24px;
  box-sizing: border-box;
}

.notfound-card {
  width: 100%;
  max-width: 440px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  padding: 48px 36px;
  text-align: center;
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.4);
  animation: cardEnter 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-sizing: border-box;
}

@keyframes cardEnter {
  from { transform: scale(0.9) translateY(30px); opacity: 0; }
  to { transform: scale(1) translateY(0); opacity: 1; }
}

.iconCircle {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: rgba(79, 110, 247, 0.15);
  border: 2px solid rgba(79, 110, 247, 0.4);
  color: #4f6ef7;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
  animation: pulseIcon 2s infinite;
}

@keyframes pulseIcon {
  0%, 100% { box-shadow: 0 0 0 0 rgba(79, 110, 247, 0.4); }
  50% { box-shadow: 0 0 0 10px rgba(79, 110, 247, 0); }
}

.notfound-title {
  margin: 0 0 12px;
  font-size: 1.75rem;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: -0.02em;
}

.notfound-msg {
  margin: 0 0 32px;
  font-size: 0.95rem;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
}

.notfound-btn {
  display: inline-block;
  background: #ffffff;
  color: #0f0c1b;
  padding: 14px 28px;
  font-size: 0.95rem;
  font-weight: 700;
  border-radius: 12px;
  text-decoration: none;
  box-shadow: 0 4px 12px rgba(255, 255, 255, 0.1);
  transition: all 0.2s ease;
}

.notfound-btn:hover {
  background: #f1f5f9;
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(255, 255, 255, 0.2);
}

.notfound-btn:active {
  transform: translateY(0);
}
</style>
