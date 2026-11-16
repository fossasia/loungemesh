<script setup lang="ts">
import { computed } from 'vue';
import { useReconnectStore } from '@/stores/reconnectStore';
import AppIcon from '@/components/ui/AppIcon.vue';

const reconnect = useReconnectStore();

const isVisible = computed(() => reconnect.phase !== 'online');

function handleReload() {
  window.location.reload();
}
</script>

<template>
  <Transition name="banner-slide">
    <div
      v-if="isVisible"
      class="reconnectBanner"
      :class="`phase-${reconnect.phase}`"
      role="status"
      aria-live="polite"
      data-testid="connection-banner"
    >
      <div class="bannerContent">
        <!-- Waiting State -->
        <template v-if="reconnect.phase === 'waiting'">
          <div class="bannerIndicator pulseAmber" aria-hidden="true" />
          <span class="bannerText">
            Disconnected – reconnecting in
            <strong>{{ reconnect.secondsLeft }}s</strong>
            <span class="attemptCount">(attempt {{ reconnect.attempt }} of 5)</span>
          </span>
          <button
            type="button"
            class="bannerBtn"
            data-testid="btn-retry-now"
            @click="reconnect.retryNow()"
          >
            Retry now
          </button>
        </template>

        <!-- Attempting State -->
        <template v-else-if="reconnect.phase === 'attempting'">
          <div class="bannerSpinner" aria-hidden="true" />
          <span class="bannerText">
            Reconnecting to room...
            <span class="attemptCount">
              (attempt {{ reconnect.attempt }} of 5)
            </span>
          </span>
        </template>

        <!-- Exhausted State -->
        <template v-else-if="reconnect.phase === 'exhausted'">
          <div class="bannerIndicator solidRed" aria-hidden="true" />
          <span class="bannerText">
            Connection lost. Please reload the page to rejoin.
          </span>
          <button
            type="button"
            class="bannerBtn warnBtn"
            data-testid="btn-reload"
            @click="handleReload"
          >
            Reload
          </button>
        </template>

        <!-- Recovered State -->
        <template v-else-if="reconnect.phase === 'recovered'">
          <AppIcon name="check" :size="16" class="iconRecovered" aria-hidden="true" />
          <span class="bannerText textRecovered">
            Reconnected to meeting
          </span>
        </template>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.reconnectBanner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
  transition: background-color 0.3s ease, border-color 0.3s ease;
  backdrop-filter: blur(8px);
}

.phase-waiting {
  background: rgba(245, 158, 11, 0.95);
  color: #1c1917;
  border-bottom: 1px solid rgba(217, 119, 6, 0.5);
}

.phase-attempting {
  background: rgba(59, 130, 246, 0.95);
  color: #ffffff;
  border-bottom: 1px solid rgba(29, 78, 216, 0.5);
}

.phase-exhausted {
  background: rgba(239, 68, 68, 0.95);
  color: #ffffff;
  border-bottom: 1px solid rgba(185, 28, 28, 0.5);
}

.phase-recovered {
  background: rgba(16, 185, 129, 0.95);
  color: #ffffff;
  border-bottom: 1px solid rgba(5, 150, 105, 0.5);
}

.bannerContent {
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 900px;
  flex-wrap: wrap;
  justify-content: center;
}

.bannerText {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.attemptCount {
  font-size: 11px;
  opacity: 0.85;
}

.bannerIndicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.pulseAmber {
  background: #78350f;
  animation: pulseDot 1.4s infinite ease-in-out;
}

.solidRed {
  background: #ffffff;
}

@keyframes pulseDot {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.4;
    transform: scale(0.8);
  }
}

.bannerSpinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.iconRecovered {
  color: #ffffff;
}

.bannerBtn {
  border: none;
  background: #ffffff;
  color: #1c1917;
  font-weight: 600;
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 9999px;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.bannerBtn:hover {
  opacity: 0.92;
  transform: translateY(-1px);
}

.bannerBtn:active {
  transform: translateY(0);
}

.bannerBtn.warnBtn {
  background: #ffffff;
  color: #b91c1c;
}

.banner-slide-enter-active,
.banner-slide-leave-active {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;
}

.banner-slide-enter-from,
.banner-slide-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
