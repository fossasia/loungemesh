<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ reason?: string }>();

const message = computed(() => {
  switch (props.reason) {
    case 'no_token':
      return 'You need a valid Eventyay ticket to access this lounge. Please join through your event page.';
    case 'token_expired':
      return 'Your access link has expired. Please return to the event page and re-open the lounge.';
    case 'token_already_used':
      return 'This access link has already been used. Each link is single-use — please re-open the lounge from your event page.';
    case 'event_not_found':
      return 'The event could not be found.';
    case 'network_error':
      return 'Could not reach the Eventyay server. Please check your connection and try again.';
    default:
      return 'Access to this lounge is restricted to ticket holders. If you have a ticket, please open the lounge from your Eventyay event page.';
  }
});
</script>

<template>
  <div class="denied-shell">
    <div class="denied-card">
      <div class="iconCircle">
        <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="2.5">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <h1 class="denied-title">Lounge Not Available</h1>
      <p class="denied-msg">{{ message }}</p>
      <p class="denied-hint">
        This LoungeMesh lounge is integrated with
        <a href="https://eventyay.com" target="_blank" rel="noopener noreferrer">Eventyay</a>.
        Sessions and access are configured per-event by the organizer.
      </p>
    </div>
  </div>
</template>

<style scoped>
.denied-shell {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 50% 50%, #1e1b4b 0%, #0f0c1b 100%);
  font-family: var(--font-body, system-ui, sans-serif);
  padding: 24px;
  box-sizing: border-box;
}

.denied-card {
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

.denied-title {
  margin: 0 0 12px;
  font-size: 1.75rem;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: -0.02em;
}

.denied-msg {
  margin: 0 0 24px;
  font-size: 0.95rem;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
}

.denied-hint {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.4);
  line-height: 1.5;
  margin: 0;
  font-weight: 500;
}

.denied-hint a {
  color: #4f6ef7;
  text-decoration: none;
  font-weight: 600;
}

.denied-hint a:hover {
  text-decoration: underline;
}
</style>
