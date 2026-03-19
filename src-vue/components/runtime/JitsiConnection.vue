<script setup lang="ts">
import { onMounted, onBeforeUnmount, watchEffect } from 'vue';
import { useRoute } from 'vue-router';
import { useConnectionStore } from '@/stores/connectionStore';
import { useConferenceStore } from '@/stores/conferenceStore';

const route = useRoute();
const connectionStore = useConnectionStore();
const conferenceStore = useConferenceStore();

onMounted(async () => {
  await connectionStore.initJitsiMeet();
  await connectionStore.connectServer();
});

onBeforeUnmount(() => {
  conferenceStore.leaveConference();
  connectionStore.disconnectServer();
});

watchEffect(async () => {
  const id = String(route.params.id ?? '');
  if (!id) return;
  if (!connectionStore.connected) return;
  if (conferenceStore.isJoining) return;

  if (conferenceStore.isJoined && conferenceStore.conferenceName !== id) {
    conferenceStore.leaveConference();
  }
  if (conferenceStore.isJoined) return;
  if (conferenceStore.conferenceObject) return;

  conferenceStore.error = undefined;
  try {
    await conferenceStore.initConference(id);
  } catch (e: unknown) {
    conferenceStore.error = e instanceof Error ? e.message : String(e);
  }
});
</script>

<template>
  <!-- runtime-only component -->
  <span style="display: none" />
</template>

