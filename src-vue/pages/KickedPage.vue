<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const countdown = ref(10);
let timer: number | undefined;

onMounted(() => {
  timer = window.setInterval(() => {
    countdown.value -= 1;
    if (countdown.value <= 0) {
      clearInterval(timer);
      router.push('/');
    }
  }, 1000);
});

/* v8 ignore start */
onUnmounted(() => {
  if (timer) clearInterval(timer);
});
/* v8 ignore stop */

function goHome() {
  router.push('/');
}
</script>

<template>
  <div class="kickedRoot">
    <div class="card">
      <div class="iconCircle">
        <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
          <line x1="12" y1="2" x2="12" y2="12" />
        </svg>
      </div>
      <h1 class="title">Access Revoked</h1>
      <p class="message">You have been disconnected from the meeting room by the host.</p>
      
      <div class="countdownBox">
        <span class="timerNumber">{{ countdown }}</span>
        <span class="timerLabel">Redirecting to home...</span>
      </div>

      <button type="button" class="btnHome" @click="goHome">
        Return Home Immediately
      </button>
    </div>
  </div>
</template>

<style scoped>
.kickedRoot {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 50% 50%, #1e1b4b 0%, #0f0c1b 100%);
  font-family: var(--font-body, system-ui, sans-serif);
  padding: 20px;
  box-sizing: border-box;
}

.card {
  width: 100%;
  max-width: 420px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  padding: 40px 32px;
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
  background: rgba(239, 68, 68, 0.15);
  border: 2px solid rgba(239, 68, 68, 0.4);
  color: #ef4444;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
  animation: pulseIcon 2s infinite;
}

@keyframes pulseIcon {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
  50% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
}

.title {
  margin: 0 0 12px;
  font-size: 1.75rem;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: -0.02em;
}

.message {
  margin: 0 0 32px;
  font-size: 0.95rem;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
}

.countdownBox {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-bottom: 32px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  padding: 16px;
}

.timerNumber {
  font-size: 2.5rem;
  font-weight: 800;
  color: #4f6ef7;
  line-height: 1;
}

.timerLabel {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.5);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.btnHome {
  width: 100%;
  background: #ffffff;
  color: #0f0c1b;
  border: none;
  padding: 14px;
  font-size: 0.95rem;
  font-weight: 700;
  border-radius: 12px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(255, 255, 255, 0.1);
  transition: all 0.2s ease;
}

.btnHome:hover {
  background: #f1f5f9;
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(255, 255, 255, 0.2);
}
</style>
