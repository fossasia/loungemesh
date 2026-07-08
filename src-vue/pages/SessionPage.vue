<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount, onMounted } from 'vue';
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

function approve(entryId: string) {
  engine.sendCommand('lobby', JSON.stringify({ action: 'approve', id: entryId }));
  features.approveLobby(entryId);
}

function reject(entryId: string) {
  engine.sendCommand('lobby', JSON.stringify({ action: 'reject', id: entryId }));
  features.rejectLobby(entryId);
}

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

let handReminderInterval: any;

onMounted(() => {
  handReminderInterval = setInterval(() => {
    const hasRemoteHand = Object.values(conf.users).some(u => 
      u.properties?.handRaised === true || u.properties?.handRaised === 'true'
    );
    if (hasRemoteHand) {
      playUiSound('handRaise');
    }
  }, 15000);
});

onBeforeUnmount(() => {
  if (stageInviteInterval) {
    clearInterval(stageInviteInterval);
  }
  if (handReminderInterval) {
    clearInterval(handReminderInterval);
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
  <div v-if="(features.isHost || features.isModerator) && features.lobbyWaiting.length > 0" class="lobbyNotificationBanner">
    <div class="bannerHeader">
      <AppIcon name="user" :size="16" />
      <span>{{ features.lobbyWaiting.length === 1 ? '1 person wants to join' : `${features.lobbyWaiting.length} people want to join` }}</span>
    </div>
    <div class="bannerBody">
      <div v-for="w in features.lobbyWaiting" :key="w.id" class="bannerRow">
        <div class="bannerUser">
          <strong class="bannerName">{{ w.name }}</strong>
          <span v-if="w.email" class="bannerEmail" :title="w.email">{{ w.email }}</span>
          <span v-if="w.reason" class="bannerReason">"{{ w.reason }}"</span>
        </div>
        <div class="bannerActions">
          <button type="button" class="btnAdmit" @click="approve(w.id)">Admit</button>
          <button type="button" class="btnDeny" @click="reject(w.id)">Deny</button>
        </div>
      </div>
    </div>
  </div>
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
      :error="local.videoError"
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
      :error="local.audioError"
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
      label="Presenter Settings"
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
      v-if="(features.isHost || features.isModerator || features.allowParticipantRecording) && recorder.isSupported"
      :is-recording="recorder.isRecording.value"
      v-model:quality="selectedQuality"
      @toggle="recording.toggleRecording(selectedQuality)"
    />
    <button type="button" class="btn-leave-call" title="Leave call" @click="requestLeave">Leave Call</button>
    <template #right>
      <IconButton
        v-if="features.isHost || features.isModerator"
        label="Moderator"
        :active="features.panel === 'moderator'"
        sound="panel"
        @click="features.togglePanel('moderator')"
      ><template #icon><AppIcon name="settings" /></template></IconButton>
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

.lobbyNotificationBanner {
  position: fixed;
  top: 76px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10050;
  width: min(400px, calc(100vw - 32px));
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(79, 110, 247, 0.2);
  border-radius: 16px;
  box-shadow: 0 20px 40px -10px rgba(30, 34, 64, 0.25), 0 5px 15px -3px rgba(30, 34, 64, 0.05);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  padding: 14px;
  box-sizing: border-box;
  animation: bannerSlideDown 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes bannerSlideDown {
  from { opacity: 0; transform: translate(-50%, -20px) scale(0.95); }
  to { opacity: 1; transform: translate(-50%, 0) scale(1); }
}

.bannerHeader {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 700;
  color: #4f6ef7;
  margin-bottom: 10px;
  border-bottom: 1px solid rgba(79, 110, 247, 0.1);
  padding-bottom: 8px;
}

.bannerBody {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 200px;
  overflow-y: auto;
}

.bannerRow {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.bannerUser {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.bannerName {
  font-size: 14px;
  color: #1e2240;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}

.bannerEmail {
  font-size: 11px;
  color: #6970a0;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}

.bannerReason {
  font-size: 11px;
  color: #6970a0;
  font-style: italic;
  margin-top: 2px;
}

.bannerActions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.btnAdmit {
  background: #10b981;
  color: #fff;
  border: none;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.btnAdmit:hover {
  background: #059669;
}

.btnDeny {
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  color: #475569;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.btnDeny:hover {
  background: #e2e8f0;
  border-color: #cbd5e1;
  color: #fa5252;
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
