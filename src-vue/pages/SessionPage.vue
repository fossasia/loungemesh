<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue';
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
import SharedScreens from '@/components/screenshare/SharedScreens.vue';
import { demoteFromStage, applyStagePromote, broadcastStageLayout } from '@/utils/sessionStage';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';

const ChatPanel = defineAsyncComponent(() => import('@/components/chat/ChatPanel.vue'));
const StagePresentation = defineAsyncComponent(
  () => import('@/components/stage/StagePresentation.vue'),
);
const SessionTools = defineAsyncComponent(() => import('@/components/session/SessionTools.vue'));
const SessionFeaturePanels = defineAsyncComponent(
  () => import('@/components/session/SessionFeaturePanels.vue'),
);
const LobbyOverlay = defineAsyncComponent(() => import('@/components/session/LobbyOverlay.vue'));
const WhiteboardOverlay = defineAsyncComponent(
  () => import('@/components/session/WhiteboardOverlay.vue'),
);
const StagePreviewDialog = defineAsyncComponent(
  () => import('@/components/stage/StagePreviewDialog.vue'),
);
import { useLocalStore } from '@/stores/localStore';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { useMediaEngine } from '@/composables/useMediaEngine';
import AppIcon from '@/components/ui/AppIcon.vue';
import { sessionIdentifier } from '@/utils/sessionIdentifier';
import LeaveDialog from '@/components/session/LeaveDialog.vue';
import SessionRecordButton from '@/components/session/SessionRecordButton.vue';
import { useSessionRecorder } from '@/composables/useSessionRecorder';
import { useSessionRecording } from '@/composables/useSessionRecording';
import { useSessionExport } from '@/composables/useSessionExport';
import { makeRecorderSources } from '@/utils/sessionRecorderSources';
import { playUiSound } from '@/utils/uiSounds';

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

const sessionId = computed(() => String(route.params.id ?? props.id ?? ''));
const { exportNotes, exportWhiteboard, exportRecording } = useSessionExport(() => sessionId.value);

const recorder = useSessionRecorder(makeRecorderSources(local, conf));
const recording = useSessionRecording(recorder, exportRecording);
const selectedQuality = ref<'720p' | '480p'>('720p');

const showLeaveDialog = ref(false);

function requestLeave() {
  playUiSound('tap');
  if (features.isHost) {
    showLeaveDialog.value = true;
    return;
  }
  void doLeave();
}

async function doLeave() {
  showLeaveDialog.value = false;
  await recording.stopIfRecording();
  if (features.stageOccupantId === local.id) {
    demoteFromStage(engine, local.id);
  }
  local.setOnStage(false);
  engine.setLocalParticipantProperty('onStage', false);
  // Await track release so the camera LED turns off before navigating away
  await local.stopAllLocalMedia();
  leaveRoom();
  conf.leaveConference();
  disconnect();
  router.push('/');
}

const showStagePreviewDialog = ref(false);

let stageInviteInterval: ReturnType<typeof setInterval> | undefined;

watch(
  () => [features.stageInvitationPending, features.isLocalStageOccupant] as const,
  ([pending, isOccupant]) => {
    if (pending && !isOccupant) {
      showStagePreviewDialog.value = true;
    } else if (!pending && !isOccupant) {
      showStagePreviewDialog.value = false;
    }
  }
);

watch(
  () => [features.stageInvitationPending, features.isLocalStageOccupant, showStagePreviewDialog.value] as const,
  ([pending, isOccupant, dialogOpen]) => {
    if (stageInviteInterval) {
      clearInterval(stageInviteInterval);
      stageInviteInterval = undefined;
    }
    if (pending && !isOccupant && dialogOpen) {
      playUiSound('stageInvite');
      stageInviteInterval = setInterval(() => {
        playUiSound('stageInvite');
      }, 4000);
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  if (stageInviteInterval) {
    clearInterval(stageInviteInterval);
  }
});
</script>

<template>
  <div class="sessionRoot" :data-session-id="props.id">
  <ErrorHandler />
  <AppHeader />
  <JitsiConnection />
  <LocalStoreLogic />
  <LobbyOverlay />
  <PanWrapper :event-identifier="identifier">
    <Room :identifier="identifier">
      <RemoteUsers />
      <LocalUser />
    </Room>
  </PanWrapper>
  <SharedScreens v-if="!features.isStageModeActive" />
  <SessionFeaturePanels />
  <WhiteboardOverlay
    v-if="features.panel === 'whiteboard'"
    :on-close="() => (features.panel = '')"
  />
  <StagePreviewDialog
    v-if="showStagePreviewDialog"
    @close="showStagePreviewDialog = false"
  />
  <StagePresentation
    v-if="features.isStageModeActive"
    mode="audience"
  />
  <p v-if="features.stageMessage" class="stageToast" role="status">{{ features.stageMessage }}</p>
  <Transition name="fade">
    <div
      v-if="features.panel && features.panel !== 'whiteboard' && features.panel !== 'notes' && features.panel !== 'chat'"
      class="panelBackdrop"
      @click="features.panel = ''"
    />
  </Transition>
  <FooterBar>
    <SessionTools />
    <IconButton
      :label="local.cameraOff ? 'Turn on camera' : 'Turn off camera'"
      :warning="local.cameraOff"
      :sound="local.cameraOff ? 'toggleOn' : 'toggleOff'"
      @click="local.toggleCamera()"
    >
      <template #icon>
        <AppIcon :name="local.cameraOff ? 'video-off' : 'video'" />
      </template>
    </IconButton>
    <IconButton
      :label="local.mute ? 'Unmute' : 'Mute'"
      :warning="local.mute"
      :sound="local.mute ? 'toggleOn' : 'toggleOff'"
      @click="local.toggleMute()"
    >
      <template #icon>
        <AppIcon :name="local.mute ? 'mic-off' : 'mic'" />
      </template>
    </IconButton>
    <ScreenshareButton />
    <IconButton
      v-if="features.stageInvitationPending || features.isLocalStageOccupant"
      label="Stage Settings"
      :active="showStagePreviewDialog"
      :warning="features.stageInvitationPending"
      class="stageBtn"
      :class="{ animatePulse: features.stageInvitationPending }"
      @click="showStagePreviewDialog = !showStagePreviewDialog"
    >
      <template #icon>
        <AppIcon name="stage" />
      </template>
    </IconButton>
    <SessionRecordButton
      v-if="features.isHost && recorder.isSupported"
      :is-recording="recorder.isRecording.value"
      v-model:quality="selectedQuality"
      @toggle="recording.toggleRecording(selectedQuality)"
    />
    <button type="button" class="btn-leave-call" title="Leave call" @click="requestLeave">Leave Call</button>
    <template #right>
      <IconButton
        v-if="features.isHost"
        label="Moderator"
        :active="features.panel === 'moderator'"
        sound="panel"
        @click="features.togglePanel('moderator')"
      ><template #icon><AppIcon name="more-vertical" /></template></IconButton>
      <ChatPanel />
    </template>
  </FooterBar>
  <LeaveDialog
    v-if="showLeaveDialog"
    :is-host="features.isHost"
    :is-recording="recorder.isRecording.value"
    :recording-supported="recorder.isSupported"
    :has-recording="recording.hasRecording.value"
    v-model:quality="selectedQuality"
    @cancel="showLeaveDialog = false"
    @leave="doLeave"
    @export-notes="exportNotes"
    @export-whiteboard="exportWhiteboard"
    @export-recording="recording.downloadRecording"
    @toggle-recording="recording.toggleRecording(selectedQuality)"
  />
  </div>
</template>

<style scoped>
.stageToast {
  position: fixed;
  top: 64px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10060;
  margin: 0;
  padding: 10px 16px;
  border-radius: var(--radius-sm);
  background: rgba(15, 23, 42, 0.92);
  color: #fff;
  font-size: var(--fs-small);
  font-weight: var(--fw-medium);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  pointer-events: none;
}

@media (max-width: 768px) {
  .stageToast {
    top: 56px;
  }
}

.panelBackdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.25);
  z-index: 4400;
  pointer-events: auto;
  backdrop-filter: blur(2px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes pulseBtn {
  0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
  70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
  100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
}

.animatePulse {
  animation: pulseBtn 2s infinite;
  background: var(--btn-primary-bg) !important;
  color: var(--btn-primary-fg) !important;
}
</style>
