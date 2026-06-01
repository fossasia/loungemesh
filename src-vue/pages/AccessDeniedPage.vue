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
      <div class="denied-icon" aria-hidden="true">🔒</div>
      <h1 class="denied-title">Lounge not available</h1>
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
  background: var(--color-bg-page, #eef1ff);
  padding: 24px;
}
.denied-card {
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 4px 32px rgba(79, 110, 247, 0.12);
  padding: 52px 44px;
  max-width: 440px;
  width: 100%;
  text-align: center;
}
.denied-icon {
  font-size: 3.5rem;
  margin-bottom: 20px;
}
.denied-title {
  font-size: 1.6rem;
  font-weight: 600;
  color: #1a1c2e;
  margin: 0 0 14px;
}
.denied-msg {
  font-size: 0.975rem;
  color: #4b5563;
  line-height: 1.6;
  margin: 0 0 20px;
}
.denied-hint {
  font-size: 0.85rem;
  color: #9ca3af;
  line-height: 1.5;
  margin: 0;
}
.denied-hint a {
  color: #4f6ef7;
  text-decoration: none;
}
.denied-hint a:hover {
  text-decoration: underline;
}
</style>
