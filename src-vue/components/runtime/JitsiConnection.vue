<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useMediaEngine } from '@/composables/useMediaEngine';
import { useConferenceStore } from '@/stores/conferenceStore';
import { conferenceOptions } from '@/config/jitsiOptions';
import { handleSessionConnectionWatch } from './sessionConnectionWatch';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';

const route = useRoute();
const { engine, connected, connect, joinRoom, leaveRoom, disconnect } = useMediaEngine();
const conferenceStore = useConferenceStore();
const localStore = useLocalStore();

onBeforeUnmount(() => {
  localStore.stopAllLocalMedia();
  leaveRoom();
  conferenceStore.leaveConference();
  disconnect();
});

watch(
  [() => route.params.id, () => connected.value],
  async ([id, isConnected]) => {
    const roomId = String(id ?? '');
    await handleSessionConnectionWatch(roomId, isConnected, {
      connect,
      joinRoom,
      leaveRoom,
      conferenceStore,
      engine,
      conferenceOptions,
      resetSessionForJoin: () => useSessionFeaturesStore().resetHostForJoin(),
    });
  },
  { immediate: true },
);
</script>

<template>
  <span style="display: none" />
</template>
