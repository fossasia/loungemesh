<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useMediaEngine } from '@/composables/useMediaEngine';
import { useConnectionStore } from '@/stores/connectionStore';
import { useConferenceStore } from '@/stores/conferenceStore';
import { conferenceOptions } from '@/config/jitsiOptions';
import { handleSessionConnectionWatch } from './sessionConnectionWatch';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { useAuthStore } from '@/stores/authStore';
import { formatSphereName } from '@/utils/formatSphereName';

const route = useRoute();
const { engine, connect, joinRoom, leaveRoom, disconnect } = useMediaEngine();
const connectionStore = useConnectionStore();
const conferenceStore = useConferenceStore();
const localStore = useLocalStore();
const auth = useAuthStore();

// Sync auth display name to conference store displayName reactively
watch(
  () => auth.user,
  (user) => {
    if (user?.displayName) {
      conferenceStore.setDisplayName(formatSphereName(user.displayName));
    } else {
      /* v8 ignore start */
      const savedGuest = localStorage.getItem('loungemesh_guest_name');
      if (savedGuest) {
        conferenceStore.setDisplayName(formatSphereName(savedGuest));
      }
      /* v8 ignore stop */
    }
  },
  { immediate: true },
);

/* v8 ignore start */
// Sync display name changes and avatarUrl changes to Jitsi in real time
watch(
  () => [conferenceStore.displayName, auth.user?.avatarUrl] as const,
  ([name, avatarUrl]) => {
    if (engine.isJoined()) {
      if (name) engine.setDisplayName(name);
      engine.setLocalParticipantProperty('avatarUrl', avatarUrl || '');
    }
  }
);
/* v8 ignore stop */

function syncSession() {
  /* v8 ignore start */
  const roomId = String(route.params.id ?? '');
  return handleSessionConnectionWatch(roomId, connectionStore.connected, {
    connect,
    joinRoom,
    leaveRoom,
    conferenceStore,
    engine,
    conferenceOptions,
    resetSessionForJoin: () => {
      const features = useSessionFeaturesStore();
      features.resetHostForJoin();
      features.loadPersistedHostSettings(roomId);
      void features.fetchRoomConfigAndRole(roomId, engine);
    },
  });
}
/* v8 ignore stop */

watch(() => route.params.id, () => void syncSession(), { immediate: true });

const onConnected = () => void syncSession();
const onDisconnected = () => void syncSession();
engine.on('connected', onConnected);
engine.on('disconnected', onDisconnected);

function cleanupSession() {
  engine.off('connected', onConnected);
  engine.off('disconnected', onDisconnected);
  // stopAllLocalMedia stops the underlying MediaStream tracks synchronously
  // (camera LED turns off immediately) even though removeTrack is async.
  void localStore.stopAllLocalMedia();
  leaveRoom();
  conferenceStore.leaveConference();
  disconnect();
}

// pagehide fires on tab close, refresh, back/forward navigation, and mobile app suspend.
// It is more reliable than beforeunload and works when onBeforeUnmount does not fire.
function onPageHide() {
  void localStore.stopAllLocalMedia();
}

onMounted(() => {
  window.addEventListener('pagehide', onPageHide);
});

onBeforeUnmount(() => {
  window.removeEventListener('pagehide', onPageHide);
  cleanupSession();
});
</script>

<template>
  <span style="display: none" />
</template>
