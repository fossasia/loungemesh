<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import AppIcon from '@/components/ui/AppIcon.vue';

const route = useRoute();
const eventSlug = String(route.params.event || '');
const roomId = String(route.params.room || '');

const loading = ref(true);
const error = ref<string | null>(null);
const meet = ref<{
  title: string;
  is_full: boolean;
  capacity: number;
  guest_link_enabled: boolean;
} | null>(null);

onMounted(async () => {
  try {
    const res = await fetch(`/api/public/meets/${encodeURIComponent(eventSlug)}/${encodeURIComponent(roomId)}`);
    if (res.ok) {
      meet.value = await res.json();
    } else if (res.status === 404) {
      error.value = 'Lounge session not found or not currently active.';
    } else {
      error.value = 'Could not load session information.';
    }
  } catch (err) {
    error.value = 'Network error while checking session status.';
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="public-shell">
    <div class="public-card">
      <div v-if="loading" class="spinner-wrap">
        <div class="spinner" />
        <p>Loading session information…</p>
      </div>

      <div v-else-if="error" class="error-view">
        <div class="icon-circle error">
          <AppIcon name="alert-triangle" :size="32" />
        </div>
        <h2>Session Unavailable</h2>
        <p class="desc">{{ error }}</p>
      </div>

      <div v-else-if="meet" class="meet-info">
        <div class="icon-circle live">
          <AppIcon name="video" :size="32" />
        </div>
        <span class="badge" :class="{ full: meet.is_full }">
          {{ meet.is_full ? 'At Capacity' : 'Live Lounge' }}
        </span>
        <h1 class="meet-title">{{ meet.title }}</h1>
        <p class="capacity-note">
          Max capacity: <strong>{{ meet.capacity }} participants</strong>
        </p>

        <div class="actions">
          <a
            class="join-btn"
            :href="`https://eventyay.com/e/${encodeURIComponent(eventSlug)}`"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open on Eventyay to Join
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.public-shell {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-page);
  font-family: var(--font-body, system-ui, sans-serif);
  padding: 24px;
  box-sizing: border-box;
}

.public-card {
  width: 100%;
  max-width: 480px;
  background: var(--color-bg-card);
  border: 1px solid var(--line-light);
  border-radius: var(--radius-round);
  padding: 44px 36px;
  text-align: center;
  color: var(--color-mono10);
}

.icon-circle {
  width: 68px;
  height: 68px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
}

.icon-circle.live {
  background: var(--color-mono100);
  border: 2px solid var(--color-blue100);
  color: var(--color-blue100);
}

.icon-circle.error {
  background: var(--color-mono100);
  border: 2px solid var(--color-red100);
  color: var(--color-red100);
}

.badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: var(--color-mono95);
  color: var(--color-blue100);
  margin-bottom: 12px;
}

.badge.full {
  background: var(--color-bg-card);
  color: var(--color-red100);
}

.meet-title {
  margin: 0 0 12px;
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.capacity-note {
  font-size: 0.9rem;
  color: var(--color-mono30);
  margin-bottom: 28px;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.join-btn {
  display: inline-block;
  padding: 14px 24px;
  border-radius: var(--radius-round);
  background: var(--btn-primary-bg);
  color: var(--btn-primary-fg);
  font-weight: 600;
  text-decoration: none;
  transition: background 0.2s;
}

.join-btn:hover {
  background: var(--color-blue100);
}

.spinner-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: var(--color-mono30);
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--color-mono95);
  border-top-color: var(--color-blue100);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
