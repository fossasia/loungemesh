<script setup lang="ts">
/**
 * Eventyay entry point: /join/:id?token=...&event=...&room=...
 * Exchanges opaque token for Jitsi JWT, then redirects to /session/:id.
 */
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAccessGuard } from '@/composables/useAccessGuard';
import AccessDeniedPage from '@/pages/AccessDeniedPage.vue';

const props = defineProps<{ id: string }>();
const router = useRouter();
const { state, check } = useAccessGuard();
const deniedReason = ref<string | undefined>(undefined);

onMounted(async () => {
  const result = await check(props.id);
  if (result.status === 'granted') {
    await router.replace({ name: 'session', params: { id: props.id } });
  } else if (result.status === 'denied') {
    deniedReason.value = result.reason;
  }
});
</script>

<template>
  <template v-if="state.status === 'loading' || state.status === 'idle'">
    <div class="join-loading">
      <div class="join-spinner" aria-label="Verifying access…" />
      <p>Verifying access…</p>
    </div>
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
</style>
