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
const { exportNotes, exportNotesRtf, exportWhiteboard, exportRecording } = useSessionExport(() => sessionId.value);

const recorder = useSessionRecorder(makeRecorderSources(local, conf));
const recording = useSessionRecording(recorder, exportRecording);
const selectedQuality = ref<'720p' | '480p'>('720p');

const showLeaveDialog = ref(false);
const showLobbyDropdown = ref(false);

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
  <!-- Top-right Lobby Queue Dropdown Menu -->
  <div
    v-if="features.isHost || features.isModerator"
    class="lobbyMenuContainer"
  >
    <button
      type="button"
      class="lobbyMenuBtn"
      :class="{ hasWaiters: features.lobbyWaiting.length > 0 }"
      @click="showLobbyDropdown = !showLobbyDropdown"
      title="Lobby Queue"
    >
      <AppIcon name="user" :size="16" />
      <span class="lobbyBtnLabel">Lobby</span>
      <span v-if="features.lobbyWaiting.length > 0" class="lobbyBadge">
        {{ features.lobbyWaiting.length }}
      </span>
    </button>
    <div v-if="showLobbyDropdown" class="lobbyDropdownCard">
      <div class="lobbyDropdownHeader">
        <h3>Waiting Room</h3>
        <span class="lobbyCount">{{ features.lobbyWaiting.length }} waiting</span>
      </div>
      <div class="lobbyDropdownBody">
        <div v-if="features.lobbyWaiting.length === 0" class="lobbyEmptyState">
          No one is waiting in the lobby.
        </div>
        <div
          v-else
          v-for="w in features.lobbyWaiting"
          :key="w.id"
          class="lobbyDropdownRow"
        >
          <div class="lobbyUserAvatar">
            {{ w.name.slice(0, 2).toUpperCase() }}
          </div>
          <div class="lobbyUserInfo">
            <div class="lobbyUserMain">
              <strong class="lobbyUserName">{{ w.name }}</strong>
              <span v-if="w.email" class="lobbyUserEmail" :title="w.email">{{ w.email }}</span>
            </div>
            <p v-if="w.reason" class="lobbyUserReason">"{{ w.reason }}"</p>
          </div>
          <div class="lobbyDropdownActions">
            <button
              type="button"
              class="btnAdmit"
              title="Admit"
              @click="approve(w.id)"
            >
              Admit
            </button>
            <button
              type="button"
              class="btnDeny"
              title="Deny"
              @click="reject(w.id)"
            >
              Deny
            </button>
          </div>
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
    @export-notes-rtf="exportNotesRtf"
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

.lobbyMenuContainer {
  position: fixed;
  top: 14px;
  right: 18px;
  z-index: 6000;
}

.lobbyMenuBtn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 20px;
  border: 1px solid var(--line-light, #cbd5e1);
  background: var(--btn-default-bg, #ffffff);
  color: var(--color-text-default, #1e293b);
  font-family: var(--font-body);
  font-size: 0.85rem;
  font-weight: var(--fw-medium, 500);
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
  position: relative;
}

.lobbyMenuBtn:hover {
  background: var(--btn-default-bg-hover, #f8fafc);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.lobbyMenuBtn.hasWaiters {
  border-color: rgba(79, 110, 247, 0.3);
  animation: lobbyPulse 2.5s infinite;
}

@keyframes lobbyPulse {
  0%, 100% { box-shadow: 0 2px 8px rgba(79, 110, 247, 0.1); }
  50% { box-shadow: 0 2px 14px rgba(79, 110, 247, 0.25); border-color: rgba(79, 110, 247, 0.5); }
}

.lobbyBadge {
  background: #fa5252;
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 14px;
  text-align: center;
  line-height: 1;
}

.lobbyDropdownCard {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  width: 360px;
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid rgba(79, 110, 247, 0.15);
  border-radius: 16px;
  box-shadow: 0 20px 40px -10px rgba(30, 34, 64, 0.18), 0 5px 15px -3px rgba(30, 34, 64, 0.05);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  padding: 16px;
  box-sizing: border-box;
  animation: dropdownFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes dropdownFadeIn {
  from { opacity: 0; transform: translateY(-8px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.lobbyDropdownHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(79, 110, 247, 0.1);
  padding-bottom: 10px;
  margin-bottom: 12px;
}

.lobbyDropdownHeader h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: #1e2240;
}

.lobbyCount {
  font-size: 11px;
  font-weight: 600;
  color: #6970a0;
  background: #f1f5f9;
  padding: 2px 8px;
  border-radius: 20px;
}

.lobbyDropdownBody {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 280px;
  overflow-y: auto;
  padding-right: 2px;
}

.lobbyEmptyState {
  text-align: center;
  color: #6970a0;
  font-size: 13px;
  padding: 24px 0;
  font-weight: 500;
}

.lobbyDropdownRow {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f1f5f9;
}

.lobbyDropdownRow:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.lobbyUserAvatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #e0e7ff;
  color: #4f6ef7;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.lobbyUserInfo {
  flex: 1;
  min-width: 0;
}

.lobbyUserMain {
  display: flex;
  flex-direction: column;
}

.lobbyUserName {
  font-size: 13px;
  color: #1e2240;
  font-weight: 600;
}

.lobbyUserEmail {
  font-size: 11px;
  color: #6970a0;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}

.lobbyUserReason {
  font-size: 11px;
  color: #6970a0;
  font-style: italic;
  margin: 4px 0 0;
  background: #f8fafc;
  padding: 4px 6px;
  border-radius: 6px;
}

.lobbyDropdownActions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-shrink: 0;
}

.btnAdmit {
  background: #10b981;
  color: #fff;
  border: none;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 6px;
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
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 6px;
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
