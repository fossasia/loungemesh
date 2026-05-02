<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useMediaEngine } from '@/composables/useMediaEngine';
import { useConnectionStore } from '@/stores/connectionStore';
import { useConferenceStore } from '@/stores/conferenceStore';
import { conferenceOptions } from '@/config/jitsiOptions';
import { handleSessionConnectionWatch } from './sessionConnectionWatch';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';

const route = useRoute();
const { engine, connect, joinRoom, leaveRoom, disconnect } = useMediaEngine();
const connectionStore = useConnectionStore();
const conferenceStore = useConferenceStore();
const localStore = useLocalStore();

function syncSession() {
  const roomId = String(route.params.id ?? '');
  return handleSessionConnectionWatch(roomId, connectionStore.connected, {
    connect,
    joinRoom,
    leaveRoom,
    conferenceStore,
    engine,
    conferenceOptions,
    resetSessionForJoin: () => useSessionFeaturesStore().resetHostForJoin(),
  });
}

watch(() => route.params.id, () => void syncSession(), { immediate: true });

const onConnected = () => void syncSession();
const onDisconnected = () => void syncSession();
engine.on('connected', onConnected);
engine.on('disconnected', onDisconnected);

onBeforeUnmount(() => {
  engine.off('connected', onConnected);
  engine.off('disconnected', onDisconnected);
  localStore.stopAllLocalMedia();
  leaveRoom();
  conferenceStore.leaveConference();
  disconnect();
});
</script>

<template>
  <span style="display: none" />
</template>
