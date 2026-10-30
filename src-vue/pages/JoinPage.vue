<script setup lang="ts">
/**
 * Eventyay entry point: /join/:id?token=...&event=...&room=...
 * Exchanges opaque token for Jitsi JWT, then redirects to /session/:id.
 */
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAccessGuard } from '@/composables/useAccessGuard';
import { useConferenceStore } from '@/stores/conferenceStore';
import { formatSphereName } from '@/utils/formatSphereName';
import AccessDeniedPage from '@/pages/AccessDeniedPage.vue';
import StatusScreen from '@/components/common/StatusScreen.vue';

const props = defineProps<{ id: string }>();
const router = useRouter();
const { state, check } = useAccessGuard();
const deniedReason = ref<string | undefined>(undefined);
const pinInput = ref('');
const pinError = ref('');
const isSubmittingPin = ref(false);

async function attemptJoin(pin?: string) {
  isSubmittingPin.value = true;
  pinError.value = '';
  const result = pin !== undefined ? await check(props.id, pin) : await check(props.id);
  isSubmittingPin.value = false;
  if (result.status === 'granted') {
    if (result.displayName?.trim()) {
      useConferenceStore().setDisplayName(formatSphereName(result.displayName));
    }
    await router.replace({ name: 'session', params: { id: props.id } });
  } else if (result.status === 'denied') {
    deniedReason.value = result.reason;
    if (result.reason === 'invalid_pin') {
      pinError.value = 'Incorrect meeting PIN. Please check and try again.';
    }
  }
}

onMounted(() => {
  attemptJoin();
});
</script>

<template>
  <template v-if="state.status === 'loading' || state.status === 'idle'">
    <div class="join-loading">
      <div class="join-spinner" aria-label="Verifying access…" />
      <p>Verifying access…</p>
    </div>
  </template>
  <template v-else-if="deniedReason === 'pin_required' || deniedReason === 'invalid_pin'">
    <StatusScreen
      title="Meeting PIN Required"
      message="This meeting requires a security PIN to join. Enter the PIN provided by the organizer."
      icon="shield"
    >
        <form @submit.prevent="attemptJoin(pinInput)" class="pin-form">
          <input
            v-model="pinInput"
            type="password"
            maxlength="32"
            placeholder="Enter Meeting PIN"
            class="pin-input"
            autofocus
            :disabled="isSubmittingPin"
          />
          <p v-if="pinError" class="pin-error">{{ pinError }}</p>
          <button type="submit" class="btn-join-meeting" :disabled="!pinInput.trim() || isSubmittingPin">
            {{ isSubmittingPin ? 'Verifying PIN…' : 'Enter Meeting' }}
          </button>
        </form>
    </StatusScreen>
  </template>
  <template v-else-if="state.status === 'denied'">
    <AccessDeniedPage :reason="deniedReason" />
  </template>
</template>

<style scoped>
.join-loading {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  background: var(--color-bg-page, #eef1ff);
  color: #4b5563;
  font-size: 0.95rem;
}
.join-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #d1d5fa;
  border-top-color: #4f6ef7;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

.pin-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.pin-input {
  width: 100%;
  box-sizing: border-box;
  padding: 12px 16px;
  font-size: 1.1rem;
  letter-spacing: 2px;
  text-align: center;
  border-radius: 12px;
  border: 1px solid var(--line-light);
  background: var(--color-mono100);
  color: var(--color-mono10);
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.pin-input:focus {
  border-color: var(--color-blue100);
  box-shadow: 0 0 0 3px var(--color-mono95);
}

.pin-error {
  color: var(--color-red100);
  font-size: 0.85rem;
  margin: 0;
}

.btn-join-meeting {
  padding: 12px 20px;
  font-size: 1rem;
  font-weight: 600;
  border-radius: var(--radius-round);
  border: none;
  background: var(--btn-primary-bg);
  color: var(--btn-primary-fg);
  cursor: pointer;
  transition: opacity 0.2s, transform 0.1s;
}

.btn-join-meeting:hover:not(:disabled) {
  opacity: 0.92;
  transform: translateY(-1px);
}

.btn-join-meeting:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
