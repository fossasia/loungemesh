<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import StatusScreen from '@/components/common/StatusScreen.vue';

const router = useRouter();
const countdown = ref(10);
let timer: number | undefined;

onMounted(() => {
  timer = window.setInterval(() => {
    countdown.value -= 1;
    if (countdown.value <= 0) {
      clearInterval(timer);
      goHome();
    }
  }, 1000);
});

/* v8 ignore start */
onUnmounted(() => {
  if (timer) clearInterval(timer);
});
/* v8 ignore stop */

function goHome() {
  if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
    window.parent.postMessage({ source: 'loungemesh', action: 'leave', event: 'hangup', type: 'hangup' }, '*');
  } else {
    router.push('/');
  }
}
</script>

<template>
  <StatusScreen
    title="Access Revoked"
    message="You have been disconnected from the meeting room by the host."
    icon="log-out"
    tone="warning"
  >
    <div class="countdownBox">
      <span class="timerNumber">{{ countdown }}</span>
      <span class="timerLabel">Redirecting to home...</span>
    </div>
    <button type="button" class="btnHome" @click="goHome">
      Return Home Immediately
    </button>
  </StatusScreen>
</template>

<style scoped>
.countdownBox {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-bottom: 24px;
  background: var(--color-mono100);
  border: 1px solid var(--line-light);
  border-radius: var(--radius-round);
  padding: 16px;
}

.timerNumber {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--color-blue100);
  line-height: 1;
}

.timerLabel {
  font-size: var(--fs-small);
  color: var(--color-mono40);
  font-weight: 600;
}

.btnHome {
  width: 100%;
  background: var(--btn-primary-bg);
  color: var(--btn-primary-fg);
  border: none;
  padding: 14px;
  font-size: var(--fs-body);
  font-weight: var(--fw-bold);
  border-radius: var(--radius-round);
  cursor: pointer;
}
</style>
