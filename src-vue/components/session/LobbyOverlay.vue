<script setup lang="ts">
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { useConferenceStore } from '@/stores/conferenceStore';

const features = useSessionFeaturesStore();
const conference = useConferenceStore();
</script>

<template>
  <div v-if="features.isLobbyBlocked" class="lobby">
    <div class="card">
      <h2 class="title">Waiting for the host</h2>
      <p class="sub">
        Lobby mode is on. {{ conference.displayName }} will admit you into the space shortly.
      </p>
    </div>
  </div>
</template>

<style scoped>
.lobby {
  position: fixed;
  inset: 0;
  z-index: 9000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(228, 234, 255, 0.92);
  pointer-events: auto;
}
.card {
  max-width: 400px;
  padding: 32px;
  text-align: center;
  background: var(--color-bg-card);
  border-radius: var(--radius-sm);
  box-shadow: 0 8px 24px rgba(30, 34, 64, 0.12);
}
.title {
  margin: 0 0 12px;
  font-size: var(--fs-h2);
}
.sub {
  margin: 0;
  color: var(--color-mono30);
}
</style>
