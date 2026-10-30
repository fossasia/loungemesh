<script setup lang="ts">
import { computed } from 'vue';
import StatusScreen from '@/components/common/StatusScreen.vue';

const props = defineProps<{ reason?: string }>();

const message = computed(() => {
  switch (props.reason) {
    case 'room_full':
      return 'This lounge has reached its maximum participant capacity. Please try again later.';
    case 'not_allowed':
      return 'You do not have permission to join this session. If you believe this is an error, please check your Eventyay registration.';
    case 'grant_expired':
    case 'token_expired':
      return 'Your access link has expired. Please return to your Eventyay event page and re-open the lounge.';
    case 'single_user_replayed':
    case 'token_already_claimed':
      return 'This unique attendee link has already been used by another participant. Attendee links only allow one user.';
    case 'invalid_pin':
      return 'The PIN you entered was incorrect. Please try again with the correct meeting PIN.';
    case 'grant_replayed':
    case 'token_already_used':
      return 'This access link has already been used. Please re-open the lounge from your Eventyay event page.';
    case 'meet_not_found':
    case 'event_not_found':
      return 'The requested lounge session could not be found.';
    case 'no_token':
      return 'You need a valid Eventyay ticket or pass to access this lounge. Please join through your event page.';
    case 'network_error':
      return 'Could not reach the server. Please check your connection and try again.';
    default:
      return 'Access to this lounge is restricted. Please open the lounge from your Eventyay event page.';
  }
});
</script>

<template>
  <StatusScreen title="Lounge Not Available" :message="message" icon="shield" tone="warning">
    <p class="denied-hint">
      This LoungeMesh lounge is integrated with
      <a href="https://eventyay.com" target="_blank" rel="noopener noreferrer">Eventyay</a>.
      Sessions and access are configured per-event by the organizer.
    </p>
  </StatusScreen>
</template>

<style scoped>
.denied-hint {
  font-size: var(--fs-small);
  color: var(--color-mono40);
  line-height: 1.5;
  margin: 0;
}

.denied-hint a {
  color: var(--color-blue100);
  text-decoration: none;
  font-weight: 600;
}
</style>
