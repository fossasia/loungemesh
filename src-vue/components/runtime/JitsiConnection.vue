<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useMediaEngine } from '@/composables/useMediaEngine';
import { useConferenceStore } from '@/stores/conferenceStore';
import { conferenceOptions } from '@/config/jitsiOptions';

const route = useRoute();
const { engine, connected, connect, joinRoom, leaveRoom, disconnect } = useMediaEngine();
const conferenceStore = useConferenceStore();

onBeforeUnmount(() => {
  leaveRoom();
  conferenceStore.leaveConference();
  disconnect();
});

watch(
  [() => route.params.id, connected],
  async ([id, isConnected]) => {
    const roomId = String(id ?? '');
    if (!roomId) return;

    if (!isConnected) {
      conferenceStore.error = undefined;
      try {
        await connect();
      } catch (e: unknown) {
        conferenceStore.error = e instanceof Error ? e.message : String(e);
      }
      return;
    }

    if (conferenceStore.isJoining) return;
    if (conferenceStore.isJoined && conferenceStore.conferenceName !== roomId) {
      leaveRoom();
      conferenceStore.leaveConference();
    }
    if (conferenceStore.isJoined) return;
    if (conferenceStore.conferenceObject) return;

    conferenceStore.error = undefined;
    conferenceStore.setConferenceName(roomId);
    try {
      await joinRoom(roomId, conferenceStore.displayName, conferenceOptions);
      conferenceStore.conferenceObject = engine.getConference();
    } catch (e: unknown) {
      conferenceStore.error = e instanceof Error ? e.message : String(e);
      conferenceStore.isJoining = false;
    }
  },
  { immediate: true },
);
</script>

<template>
  <span style="display: none" />
</template>
