<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import JitsiConnection from '@/components/runtime/JitsiConnection.vue';
import LocalStoreLogic from '@/components/runtime/LocalStoreLogic.vue';
import PanWrapper from '@/components/layout/PanWrapper.vue';
import Room from '@/components/room/Room.vue';
import FooterBar from '@/components/layout/FooterBar.vue';
import IconButton from '@/components/ui/IconButton.vue';
import RemoteUsers from '@/components/room/RemoteUsers.vue';
import LocalUser from '@/components/room/LocalUser.vue';
import AppHeader from '@/components/layout/AppHeader.vue';
import ErrorHandler from '@/components/common/ErrorHandler.vue';
import { defineAsyncComponent } from 'vue';
import ScreenshareButton from '@/components/footer/ScreenshareButton.vue';
import StageButton from '@/components/stage/StageButton.vue';

const ChatPanel = defineAsyncComponent(() => import('@/components/chat/ChatPanel.vue'));
const StagePanel = defineAsyncComponent(() => import('@/components/stage/StagePanel.vue'));
const SessionTools = defineAsyncComponent(() => import('@/components/session/SessionTools.vue'));
const SessionFeaturePanels = defineAsyncComponent(
  () => import('@/components/session/SessionFeaturePanels.vue'),
);
const LobbyOverlay = defineAsyncComponent(() => import('@/components/session/LobbyOverlay.vue'));
const WhiteboardOverlay = defineAsyncComponent(
  () => import('@/components/session/WhiteboardOverlay.vue'),
);
import { useLocalStore } from '@/stores/localStore';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { useMediaEngine } from '@/composables/useMediaEngine';
import AppIcon from '@/components/ui/AppIcon.vue';
import { sessionIdentifier } from '@/utils/sessionIdentifier';

/** Absorbs `props: true` route param so it is not forwarded as a stray DOM attribute (multi-root page). */
/* v8 ignore next */
const props = defineProps<{ id: string }>();

const route = useRoute();
const identifier = computed(() =>
  sessionIdentifier(route.params.id ?? props.id),
);

const local = useLocalStore();
const conf = useConferenceStore();
const features = useSessionFeaturesStore();
const { disconnect, leaveRoom, engine } = useMediaEngine();
const router = useRouter();

// Pinia can preserve pan/zoom across navigations; force a deterministic recenter per session.
watch(
  () => identifier.value,
  () => local.resetViewportForRoom(),
  { immediate: true },
);

watch(
  () => props.id,
  (id) => {
    if (id) conf.setConferenceName(id);
  },
  { immediate: true },
);

async function leave() {
  local.setOnStage(false);
  engine.setLocalParticipantProperty('onStage', false);
  // Await track release so the camera LED turns off before navigating away
  await local.stopAllLocalMedia();
  leaveRoom();
  conf.leaveConference();
  disconnect();
  router.push('/');
}
</script>

<template>
  <div class="sessionRoot" :data-session-id="props.id">
  <ErrorHandler />
  <AppHeader />
  <JitsiConnection />
  <LocalStoreLogic />
  <LobbyOverlay />
  <PanWrapper>
    <Room :identifier="identifier">
      <RemoteUsers />
      <LocalUser />
    </Room>
  </PanWrapper>
  <SessionFeaturePanels />
  <WhiteboardOverlay
    v-if="features.panel === 'whiteboard'"
    :on-close="() => (features.panel = '')"
  />
  <StagePanel />
  <FooterBar>
    <SessionTools />
    <StageButton />
    <IconButton
      :label="local.cameraOff ? 'Turn on camera' : 'Turn off camera'"
      :warning="local.cameraOff"
      @click="local.toggleCamera()"
    >
      <template #icon>
        <AppIcon :name="local.cameraOff ? 'video-off' : 'video'" />
      </template>
    </IconButton>
    <IconButton :label="local.mute ? 'Unmute' : 'Mute'" :warning="local.mute" @click="local.toggleMute()">
      <template #icon>
        <AppIcon :name="local.mute ? 'mic-off' : 'mic'" />
      </template>
    </IconButton>
    <ScreenshareButton />
    <button type="button" class="btn-leave-call" title="Leave call" @click="leave">Leave Call</button>
    <template #right>
      <IconButton
        v-if="features.isHost"
        label="Moderator"
        :active="features.panel === 'moderator'"
        @click="features.togglePanel('moderator')"
      >
        <template #icon><AppIcon name="more-vertical" /></template>
      </IconButton>
      <ChatPanel />
    </template>
  </FooterBar>
  </div>
</template>

<style scoped>
</style>
