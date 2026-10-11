<script setup lang="ts">
import { useConferenceStore } from '@/stores/conferenceStore';

const conference = useConferenceStore();
</script>

<template>
  <div
    v-if="conference.connectionInterrupted && conference.isJoined"
    class="reconnectingBanner"
    role="status"
    aria-live="polite"
  >
    <span class="spinner" aria-hidden="true" />
    <span class="label">Reconnecting&hellip;</span>
  </div>
</template>

<style scoped>
.reconnectingBanner {
  position: fixed;
  top: max(12px, env(safe-area-inset-top));
  left: 50%;
  transform: translateX(-50%);
  z-index: 99999;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 18px;
  min-height: 44px;
  border-radius: 999px;
  background: rgba(20, 20, 20, 0.92);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);
  pointer-events: none;
}

.spinner {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  animation: reconnectSpin 0.8s linear infinite;
}

@keyframes reconnectSpin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation-duration: 2.4s;
  }
}

@media (max-width: 768px) {
  .reconnectingBanner {
    left: 12px;
    right: 12px;
    transform: none;
    justify-content: center;
    font-size: 16px;
  }
}
</style>
