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
import { useReconnectStore } from '@/stores/reconnectStore';
import { applyLobbyPlayback } from '@/utils/lobbyPlayback';
import { formatSphereName } from '@/utils/formatSphereName';

const route = useRoute();
const { engine, connect, joinRoom, leaveRoom, disconnect } = useMediaEngine();
const connectionStore = useConnectionStore();
const conferenceStore = useConferenceStore();
const localStore = useLocalStore();
const auth = useAuthStore();
const reconnectStore = useReconnectStore();

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

/* v8 ignore start */
function syncSession(isReconnect = false) {
  const roomId = String(route.params.id ?? '');
  return handleSessionConnectionWatch(roomId, connectionStore.connected, {
    connect,
    joinRoom,
    leaveRoom,
    conferenceStore,
    engine,
    conferenceOptions,
    isReconnect,
    resetSessionForJoin: (options?: { isReconnect?: boolean }) => {
      const features = useSessionFeaturesStore();
      features.resetHostForJoin(options);
      features.loadPersistedHostSettings(roomId);
      void features.fetchRoomConfigAndRole(roomId, engine);
    },
  });
}
/* v8 ignore stop */

watch(() => route.params.id, () => void syncSession(), { immediate: true });

const features = useSessionFeaturesStore();
watch(
  () => features.isLobbyBlocked,
  (blocked) => {
    applyLobbyPlayback(engine, blocked);
  },
  { immediate: true },
);

const onConnected = () => {
  const isReconnect = reconnectStore.attempt > 0 || reconnectStore.phase === 'attempting' || reconnectStore.phase === 'waiting';
  void syncSession(isReconnect);
};
const onDisconnected = () => void syncSession();
engine.on('connected', onConnected);
engine.on('disconnected', onDisconnected);

function cleanupSession() {
  reconnectStore.setIntentionalLeave(true);
  reconnectStore.setRetryAction(undefined);
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
  reconnectStore.setIntentionalLeave(false);
  reconnectStore.setRetryAction(() => syncSession(true));
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
