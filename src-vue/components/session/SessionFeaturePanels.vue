<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import * as Y from 'yjs';
import { useRoute } from 'vue-router';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { useMediaEngine } from '@/composables/useMediaEngine';
import MenuCard from '@/components/common/MenuCard.vue';
import NotesEditor from '@/components/session/NotesEditor.vue';
import { notesPanelWidth, sessionPanelLayout } from '@/constants/sessionPanels';
import {
  disableParticipantCamera,
  kickParticipant,
  muteParticipant,
  setParticipantMediaLock,
} from '@/utils/sessionModeration';
import type { FeatureKey } from '@/types/userGrants';
import {
  demoteFromStage,
  promoteToStage,
  stageDisplayName,
  syncStagePromotionEnabled,
} from '@/utils/sessionStage';
import {
  createNotesPushScheduler,
  featureCardStyleForPanel,
  shouldPublishNotesDraft,
} from '@/utils/sessionNotesPanel';
import { broadcastSharedNotes } from '@/utils/notesSync';
import HostRoomSettingsSection from '@/components/session/HostRoomSettingsSection.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import { useLocalStore } from '@/stores/localStore';
import { useAuthStore } from '@/stores/authStore';
import { downloadBlob, markdownToRtf } from '@/utils/sessionExport';
import {
  buildSessionShareUrl,
  canNativeShareLink,
  copyMeetingShareLink,
  inviteAttendeesToSession,
  nativeShareMeetingLink,
  syncEmailInputAriaInvalid,
} from '@/utils/sessionInviteShare';

const panelHeight = sessionPanelLayout.height;
const panelBottom = sessionPanelLayout.bottom;
const panelRight = sessionPanelLayout.right;
const notesWidth = notesPanelWidth;

const featureLabels: Record<FeatureKey, string> = {
  notes: 'Notes',
  whiteboard: 'Board',
  poll: 'Polls',
  moderator: 'Moderator',
  chat: 'Chat',
};

const features = useSessionFeaturesStore();
const conference = useConferenceStore();
const local = useLocalStore();
const auth = useAuthStore();
const { engine } = useMediaEngine();
const route = useRoute();
const roomId = computed(() => String(route.params.id || ''));

const settingsView = computed({
  get: () => features.moderatorTab,
  set: (tab: 'room' | 'people') => {
    features.moderatorTab = tab;
  },
});

const inviteInput = ref('');
const inviteInputEl = ref<HTMLInputElement | null>(null);
const inviteSubmitting = ref(false);
const inviteError = ref('');
const inviteSuccess = ref('');
const shareLinkCopied = ref(false);

const effectiveRoomName = computed(() => roomId.value || features.resolveRoomName());
const shareMeetingUrl = computed(() => buildSessionShareUrl(effectiveRoomName.value));
const inviteActionUrl = computed(
  () => `/api/meetings/state/${encodeURIComponent(effectiveRoomName.value || 'room')}/invite`,
);
const canShareNative = computed(() => canNativeShareLink());

function togglePeoplePane(pane: 'add' | 'share') {
  features.peopleActionPane = features.peopleActionPane === pane ? '' : pane;
  inviteError.value = '';
  inviteSuccess.value = '';
}

function onInviteEmailInput(event: Event) {
  const target = event.target as HTMLInputElement;
  target.setCustomValidity('');
  inviteError.value = '';
  inviteSuccess.value = '';
  syncEmailInputAriaInvalid(target);
}

function onInviteEmailBlur(event: Event) {
  syncEmailInputAriaInvalid(event.target as HTMLInputElement);
}

async function onSubmitInvite() {
  inviteError.value = '';
  inviteSuccess.value = '';
  inviteSubmitting.value = true;
  const result = await inviteAttendeesToSession(effectiveRoomName.value, inviteInput.value, engine);
  inviteSubmitting.value = false;
  if (!result.ok) {
    inviteError.value = result.message;
    inviteInputEl.value?.setCustomValidity(result.message);
    syncEmailInputAriaInvalid(inviteInputEl.value, true);
    inviteInputEl.value?.focus();
    return;
  }
  inviteInput.value = '';
  inviteInputEl.value?.setCustomValidity('');
  syncEmailInputAriaInvalid(inviteInputEl.value, false);
  inviteSuccess.value = result.message;
}

function onShareInputFocus(event: FocusEvent) {
  (event.target as HTMLInputElement).select();
}

async function onCopyShareLink() {
  const ok = await copyMeetingShareLink(shareMeetingUrl.value);
  if (ok) {
    shareLinkCopied.value = true;
    window.setTimeout(() => {
      shareLinkCopied.value = false;
    }, 2000);
  }
}

async function onNativeShareLink() {
  const outcome = await nativeShareMeetingLink(effectiveRoomName.value, shareMeetingUrl.value);
  if (outcome === 'shared') {
    features.setStageMessage('Meeting link shared.');
  }
}

const grantKeys = computed(() => {
  const keys = Object.keys(featureLabels) as FeatureKey[];
  return keys.filter((key) => {
    if (key === 'moderator') return features.isHost;
    return features.enabledFeatures[key] !== false;
  });
});

const activeNotesTab = ref<'shared' | 'private'>('shared');
const notesDraft = ref(features.sharedNotes);

watch(
  () => features.sharedNotes,
  (t) => {
    notesDraft.value = t;
  },
);

watch(
  () => features.panel,
  (panel, prev) => {
    if (panel === 'notes' && prev !== 'notes') {
      notesDraft.value = features.sharedNotes;

      const saved = localStorage.getItem(`loungemesh:private_notes:${roomId.value}`);
      local.privateNotes = saved || '';
    }
  },
);

function onPrivateNotesInput(text: string) {
  local.privateNotes = text;
  localStorage.setItem(`loungemesh:private_notes:${roomId.value}`, text);
}

const privateNotesFormat = ref<'md' | 'rtf'>('md');

function downloadPrivateNotes() {
  if (privateNotesFormat.value === 'md') {
    const blob = new Blob([local.privateNotes], { type: 'text/markdown' });
    downloadBlob(blob, `private-notes-${roomId.value}.md`);
  } else {
    const titleText = `Private Notes - ${roomId.value}`;
    const rtfContent = markdownToRtf(local.privateNotes, titleText);
    const blob = new Blob([rtfContent], { type: 'application/rtf' });
    downloadBlob(blob, `private-notes-${roomId.value}.rtf`);
  }
}

function onNotesInput() {
  pushNotes();
}

function onNotesBlur() {
  if (shouldPublishNotesDraft(notesDraft.value, features.sharedNotes)) {
    flushNotes();
  } else {
    cancelNotes();
  }
}

const { push: pushNotes, flush: flushNotes, cancel: cancelNotes, dispose: disposeNotesPush } =
  createNotesPushScheduler(
    () => features.canUseNotes,
    () => notesDraft.value,
    (text) => {
      if (!shouldPublishNotesDraft(text, features.sharedNotes)) return;
      features.updateSharedNotes(text, true);
      broadcastSharedNotes(engine, text);
    },
  );

const pendingNotesChanges = computed(() =>
  features.pendingModerationChanges.filter((c) => c.type === 'notes'),
);

const canResetNotesToTemplate = computed(
  () => (features.isHost || features.isModerator) && !!features.notesTemplate.trim(),
);

function resetNotesToTemplate() {
  cancelNotes();
  features.resetSharedNotesToTemplate();
  notesDraft.value = features.sharedNotes;

  const state = Y.encodeStateAsUpdate(features.ydoc);
  const base64 = btoa(String.fromCharCode(...state));
  const NOTES_CHUNK_SIZE = 8000;
  const total = Math.ceil(base64.length / NOTES_CHUNK_SIZE);
  engine.sendCommand('notes', JSON.stringify({ action: 'yjs_begin', total }));
  for (let i = 0, offset = 0; offset < base64.length; i += 1, offset += NOTES_CHUNK_SIZE) {
    engine.sendCommand(
      'notes',
      JSON.stringify({
        action: 'yjs_chunk',
        index: i,
        data: base64.slice(offset, offset + NOTES_CHUNK_SIZE),
      }),
    );
  }
}

function controlEmail(): string {
  return (auth.user?.email || features.hostEmail || '').trim();
}

function syncLobby() {
  const email = controlEmail();
  engine.sendCommand(
    'lobby',
    JSON.stringify({ enabled: features.lobbyEnabled, ...(email ? { email } : {}) }),
  );
  void features.updateRoomConfig(roomId.value, { lobbyEnabled: features.lobbyEnabled }, engine);
}

function syncRoomDefaults() {
  engine.sendCommand(
    'access',
    JSON.stringify({
      defaults: features.roomDefaults,
      email: controlEmail(),
    }),
  );
}

function syncUserGrants(userId: string) {
  engine.sendCommand(
    'access',
    JSON.stringify({
      userId,
      grants: features.userGrants[userId] ?? {},
      email: controlEmail(),
    }),
  );
}

function onRoomDefaultChange(key: FeatureKey, event: Event) {
  const checked = (event.target as HTMLInputElement).checked;
  features.setRoomDefault(key, checked);
  for (const uid of participantIds.value) {
    if (isHostUser(uid)) continue;
    features.setUserGrant(uid, key, checked);
    syncUserGrants(uid);
  }
  syncRoomDefaults();
}

function onUserGrantChange(userId: string, key: FeatureKey, event: Event) {
  const checked = (event.target as HTMLInputElement).checked;
  features.setUserGrant(userId, key, checked);
  syncUserGrants(userId);
}

function approve(entryId: string) {
  const email = controlEmail();
  engine.sendCommand(
    'lobby',
    JSON.stringify({ action: 'approve', id: entryId, ...(email ? { email } : {}) }),
  );
  features.approveLobby(entryId);
}

function reject(entryId: string) {
  const email = controlEmail();
  engine.sendCommand(
    'lobby',
    JSON.stringify({ action: 'reject', id: entryId, ...(email ? { email } : {}) }),
  );
  features.rejectLobby(entryId);
}

function kickUser(id: string) {
  kickParticipant(conference, engine, id);
}

function muteUser(id: string) {
  muteParticipant(conference, engine, id);
}

function disableCameraUser(id: string) {
  disableParticipantCamera(conference, engine, id);
}

function isMicLocked(id: string): boolean {
  return !!features.mediaLocks[id]?.mic;
}

function isCameraLocked(id: string): boolean {
  return !!features.mediaLocks[id]?.camera;
}

function toggleMicLock(id: string) {
  setParticipantMediaLock(conference, engine, id, { mic: !isMicLocked(id) });
}

function toggleCameraLock(id: string) {
  setParticipantMediaLock(conference, engine, id, { camera: !isCameraLocked(id) });
}

function onStagePromotionToggle(event: Event) {
  const enabled = (event.target as HTMLInputElement).checked;
  syncStagePromotionEnabled(engine, enabled);
  void features.updateRoomConfig(roomId.value, { stagePromotionEnabled: enabled }, engine);
}

function onRecordingToggle() {
  void features.updateRoomConfig(
    roomId.value,
    { allowParticipantRecording: features.allowParticipantRecording },
    engine,
  );
}

function promoteUser(id: string) {
  const result = promoteToStage(engine, id);
  if (!result.ok) features.setStageMessage(result.message);
}

function demoteUser(id: string) {
  demoteFromStage(engine, id);
}

const stageStatusLabel = computed(() => {
  const id = features.stageOccupantId;
  return id ? stageDisplayName(id) : 'Vacant';
});

function displayName(uid: string): string {
  if (uid === local.id) {
    return conference.displayName || 'You';
  }
  conference.usersEpoch;
  return (
    (conference.users[uid]?.user as { _displayName?: string } | undefined)?._displayName ?? uid
  );
}

function isHostUser(uid: string): boolean {
  if (uid === local.id && features.isHost) return true;
  conference.usersEpoch;
  return features.isParticipantHost(uid);
}

function isModeratorUser(uid: string): boolean {
  if (isHostUser(uid)) return false;
  if (uid === local.id && features.isModerator) return true;
  conference.usersEpoch;
  return features.isParticipantModerator(uid);
}

const participantIds = computed(() => {
  conference.usersEpoch;
  const ids = new Set<string>(Object.keys(conference.users));
  if (local.id) ids.add(local.id);

  return Array.from(ids).sort((a, b) => {
    const roleWeight = (uid: string) => {
      if (isHostUser(uid)) return 0;
      if (isModeratorUser(uid)) return 1;
      if (uid === features.stageOccupantId) return 2;
      return 3;
    };
    const wa = roleWeight(a);
    const wb = roleWeight(b);
    if (wa !== wb) return wa - wb;
    return displayName(a).localeCompare(displayName(b));
  });
});

onBeforeUnmount(disposeNotesPush);

watch(
  () => [features.panel, features.canUseNotes, features.isHost, features.isModerator] as const,
  ([panel, canUseNotes, isHost, isModerator]) => {
    if (panel === 'notes' && !canUseNotes && !isHost && !isModerator) {
      features.panel = '';
    }
  },
);

watch(
  () => [features.panel, features.canUseWhiteboard, features.isHost, features.isModerator] as const,
  ([panel, canUseWhiteboard, isHost, isModerator]) => {
    if (panel === 'whiteboard' && !canUseWhiteboard && !isHost && !isModerator) {
      features.panel = '';
    }
  },
);

const panelOpen = computed(
  () =>
    !!features.panel &&
    features.panel !== 'whiteboard' &&
    features.panel !== 'reactions' &&
    features.panel !== 'poll' &&
    features.panel !== 'chat',
);

const title = computed(() => {
  switch (features.panel) {
    case 'moderator':
      return features.isHost ? 'Host Controls & Settings' : 'Moderator Controls';
    case 'participants':
      return 'Participants';
    case 'notes':
      return 'Shared notes';
    default:
      return '';
  }
});

function canModerateUser(uid: string): boolean {
  if (uid === local.id || isHostUser(uid)) return false;
  if (features.isHost) return true;
  return features.isModerator && !isModeratorUser(uid);
}

const featureCardStyle = computed(() => {
  const style = featureCardStyleForPanel(features.panel, {
    right: panelRight,
    bottom: panelBottom,
    height: panelHeight,
    notesWidth,
  });
  if (features.panel === 'moderator' || features.panel === 'participants') {
    return {
      ...style,
      width: 'min(520px, calc(100vw - 32px))',
      maxHeight: 'min(860px, calc(100vh - 110px))',
    };
  }
  return style;
});
</script>

<template>
  <MenuCard
    v-if="panelOpen"
    :title="title"
    :class="[
      'featureCard',
      features.panel === 'notes' ? 'notesCard' : '',
      features.panel === 'moderator' ? 'modCard' : '',
    ]"
    :style="featureCardStyle"
    :onClose="() => (features.panel = '')"
  >
    <template v-if="features.panel === 'notes' && canResetNotesToTemplate" #afterTitle>
      <button type="button" class="notesResetBtn" @click="resetNotesToTemplate">
        Reset to template
      </button>
    </template>

    <div v-if="features.panel === 'moderator'" class="body modBody">
      <div class="settingsTabs" role="tablist">
        <button
          type="button"
          role="tab"
          :aria-selected="settingsView === 'room'"
          class="settingsTab"
          :class="{ active: settingsView === 'room' }"
          @click="settingsView = 'room'"
        >
          Room
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="settingsView === 'people'"
          class="settingsTab"
          :class="{ active: settingsView === 'people' }"
          @click="settingsView = 'people'"
        >
          People
          <span class="tabCount">{{ participantIds.length }}</span>
        </button>
      </div>

      <div v-show="settingsView === 'room'" class="tabPane">
        <p v-if="features.stageMessage" class="stageMessage" role="status">
          {{ features.stageMessage }}
        </p>

        <section class="section">
          <div v-if="features.isHost" class="roomControls">
            <label class="roomToggle">
              <span class="toggleText">Lobby</span>
              <input
                v-model="features.lobbyEnabled"
                type="checkbox"
                class="switchInput"
                @change="syncLobby"
              />
            </label>
            <label class="roomToggle">
              <span class="toggleText">Allow presenter promotion</span>
              <input
                :checked="features.stagePromotionEnabled"
                type="checkbox"
                class="switchInput"
                @change="onStagePromotionToggle"
              />
            </label>
            <label class="roomToggle">
              <span class="toggleText">Allow participant recording</span>
              <input
                v-model="features.allowParticipantRecording"
                type="checkbox"
                class="switchInput"
                @change="onRecordingToggle"
              />
            </label>
          </div>
          <div class="stageStatusRow" :class="{ withBorder: features.isHost }">
            <span class="stageStatus">
              Presenter: <strong>{{ stageStatusLabel }}</strong>
            </span>
          </div>
          <div v-if="features.lobbyWaiting.length" class="lobbyBlock">
            <p class="sectionHint">Waiting to join ({{ features.lobbyWaiting.length }})</p>
            <div v-for="w in features.lobbyWaiting" :key="w.id" class="lobbyRow">
              <span class="name" :title="w.email">{{ w.name }}</span>
              <span v-if="w.reason" class="reason" :title="w.reason">"{{ w.reason }}"</span>
              <div class="lobbyRowBtns">
                <button type="button" class="pill" @click="approve(w.id)">Admit</button>
                <button type="button" class="pill warn" @click="reject(w.id)">Deny</button>
              </div>
            </div>
          </div>
        </section>

        <section v-if="features.isHost" class="section">
          <div class="sectionHead">
            <h3 class="sectionTitle">Feature access</h3>
            <p class="sectionHint">Default permissions for new participants.</p>
          </div>
          <div class="grantTable" role="group" aria-label="Default permissions">
            <label
              v-for="key in grantKeys"
              :key="`room-${key}`"
              class="grantCheck"
              :class="{ checked: features.roomDefaults[key] }"
            >
              <input
                type="checkbox"
                :checked="features.roomDefaults[key]"
                @change="onRoomDefaultChange(key, $event)"
              />
              <span class="chipCheckIcon" aria-hidden="true">
                {{ features.roomDefaults[key] ? '✓' : '' }}
              </span>
              <span class="chipLabel">{{ featureLabels[key] }}</span>
            </label>
          </div>
        </section>

        <section
          v-if="features.canModerate && features.pendingModerationChanges.length"
          class="section"
        >
          <h3 class="sectionTitle">Whiteboard &amp; Notes Review</h3>
          <div class="modQueueList" data-testid="mod-queue-list">
            <div
              v-for="item in features.pendingModerationChanges"
              :key="item.id"
              class="modQueueRow"
            >
              <div class="modQueueInfo">
                <strong>{{ item.type === 'whiteboard' ? 'Whiteboard' : 'Notes' }}</strong>
                <span class="modQueueAuthor">from {{ item.authorName }} (15s auto-approve)</span>
              </div>
              <div class="modQueueActions">
                <button
                  type="button"
                  class="btnAccept"
                  @click="features.approveModerationChange(item.id, engine)"
                >
                  Accept
                </button>
                <button
                  type="button"
                  class="btnReject"
                  @click="features.rejectModerationChange(item.id, engine)"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        </section>

        <HostRoomSettingsSection v-if="features.isHost" />
        <HostRoomSettingsSection v-else-if="features.isModerator" appearance-only />
      </div>

      <section v-show="settingsView === 'people'" class="section">
        <div class="peopleHeader">
          <div class="peopleHeaderTitleGroup">
            <h3 class="sectionTitle">Participants</h3>
            <span class="peopleCountBadge">{{ participantIds.length }}</span>
          </div>
          <div class="peopleHeaderActions">
            <button
              type="button"
              class="peopleActionBtn"
              :class="{ active: features.peopleActionPane === 'add' }"
              :aria-expanded="features.peopleActionPane === 'add'"
              aria-controls="people-invite-pane"
              data-testid="people-add-btn"
              @click="togglePeoplePane('add')"
            >
              <AppIcon name="user-plus" :size="14" />
              <span>Add</span>
            </button>
            <button
              type="button"
              class="peopleActionBtn"
              :class="{ active: features.peopleActionPane === 'share' }"
              :aria-expanded="features.peopleActionPane === 'share'"
              aria-controls="people-share-pane"
              data-testid="people-share-btn"
              @click="togglePeoplePane('share')"
            >
              <AppIcon name="share" :size="14" />
              <span>Share</span>
            </button>
          </div>
        </div>

        <form
          v-if="features.peopleActionPane === 'add'"
          id="people-invite-pane"
          method="post"
          :action="inviteActionUrl"
          class="peopleActionCard"
          data-testid="people-invite-form"
          @submit.prevent="onSubmitInvite"
        >
          <label for="session-invite-emails" class="inviteLabel">Invite attendee by email</label>
          <span id="session-invite-hint" class="inviteFieldHint">
            Format: name@example.com (separate multiple emails with commas)
          </span>
          <div class="inviteInputRow">
            <input
              id="session-invite-emails"
              ref="inviteInputEl"
              v-model="inviteInput"
              type="email"
              name="inviteEmails"
              multiple
              required
              autocomplete="email"
              autocorrect="off"
              autocapitalize="off"
              spellcheck="false"
              placeholder="attendee@example.com"
              aria-describedby="session-invite-hint"
              aria-errormessage="session-invite-error"
              class="inviteEmailInput"
              @input="onInviteEmailInput"
              @blur="onInviteEmailBlur"
            />
            <button
              type="submit"
              class="pill inviteSubmitBtn"
              :disabled="inviteSubmitting"
            >
              {{ inviteSubmitting ? 'Sending…' : 'Send invite' }}
            </button>
          </div>
          <p
            id="session-invite-error"
            class="inviteErrorMsg"
            :class="{ visible: !!inviteError }"
            role="status"
            aria-live="polite"
          >
            {{ inviteError || 'Please enter a valid email address.' }}
          </p>
          <p v-if="inviteSuccess" class="inviteSuccessMsg" role="status" aria-live="polite">
            {{ inviteSuccess }}
          </p>
          <div v-if="features.guestEmails.length" class="invitedListBlock">
            <span class="invitedListLabel">Invited ({{ features.guestEmails.length }})</span>
            <div class="invitedChips">
              <span v-for="guest in features.guestEmails" :key="guest" class="invitedChip">
                {{ guest }}
              </span>
            </div>
          </div>
        </form>

        <div
          v-if="features.peopleActionPane === 'share'"
          id="people-share-pane"
          class="peopleActionCard"
          data-testid="people-share-card"
        >
          <label for="session-share-link" class="inviteLabel">Meeting link</label>
          <span class="inviteFieldHint">
            Share this link with attendees so they can join the meeting.
          </span>
          <div class="shareLinkRow">
            <input
              id="session-share-link"
              type="url"
              name="shareUrl"
              readonly
              :value="shareMeetingUrl"
              class="inviteEmailInput shareUrlInput"
              @focus="onShareInputFocus"
            />
            <button
              type="button"
              class="pill shareCopyBtn"
              data-testid="people-copy-link-btn"
              @click="onCopyShareLink"
            >
              <AppIcon :name="shareLinkCopied ? 'check' : 'copy'" :size="14" />
              <span>{{ shareLinkCopied ? 'Copied!' : 'Copy link' }}</span>
            </button>
            <button
              v-if="canShareNative"
              type="button"
              class="pill subtle shareNativeBtn"
              data-testid="people-native-share-btn"
              @click="onNativeShareLink"
            >
              <AppIcon name="share" :size="14" />
              <span>Share…</span>
            </button>
          </div>
        </div>
        <div
          v-for="uid in participantIds"
          :key="uid"
          class="participantCard"
          :class="{ isHost: isHostUser(uid), onStage: uid === features.stageOccupantId }"
        >
          <div class="participantHead">
            <div class="participantMeta">
              <div class="avatarCircle">{{ displayName(uid).slice(0, 1).toUpperCase() }}</div>
              <div class="nameAndRole">
                <div class="nameRow">
                  <span class="name">{{ displayName(uid) }}</span>
                  <span v-if="uid === local.id" class="youTag">(You)</span>
                </div>
                <div class="roleRow">
                  <span v-if="isHostUser(uid)" class="badge hostBadge">👑 Host</span>
                  <span v-else-if="isModeratorUser(uid)" class="badge modBadge">🛡️ Moderator</span>
                  <span v-else class="badge attendeeBadge">👤 Attendee</span>
                  <span
                    v-if="uid === features.stageOccupantId"
                    class="badge stageBadge"
                  >🎤 Presenter</span>
                  <span
                    v-else-if="uid === features.invitedStageUserId"
                    class="badge stageInvitedBadge"
                  >Invited</span>
                  <span v-if="isMicLocked(uid)" class="badge lockBadge">🔒 Mic</span>
                  <span v-if="isCameraLocked(uid)" class="badge lockBadge">🔒 Cam</span>
                </div>
              </div>
            </div>
            <div class="modActions">
              <button
                v-if="
                  features.canPromoteToStage &&
                  uid !== features.stageOccupantId &&
                  uid !== features.invitedStageUserId
                "
                type="button"
                class="pill"
                @click="promoteUser(uid)"
              >
                Make Presenter
              </button>
              <button
                v-if="
                  (features.isHost || features.isModerator) &&
                  (uid === features.stageOccupantId || uid === features.invitedStageUserId)
                "
                type="button"
                class="pill subtle"
                @click="demoteUser(uid)"
              >
                {{ uid === features.stageOccupantId ? 'Remove presenter' : 'Cancel invite' }}
              </button>
              <button
                v-if="canModerateUser(uid)"
                type="button"
                class="pill subtle iconBtnOnly"
                title="Mute"
                @click="muteUser(uid)"
              >
                <AppIcon name="mic-off" :size="15" />
              </button>
              <button
                v-if="canModerateUser(uid)"
                type="button"
                class="pill subtle iconBtnOnly"
                title="Disable camera"
                @click="disableCameraUser(uid)"
              >
                <AppIcon name="video-off" :size="15" />
              </button>
              <button
                v-if="canModerateUser(uid)"
                type="button"
                class="pill warn iconBtnOnly"
                title="Remove"
                @click="kickUser(uid)"
              >
                <AppIcon name="user-minus" :size="15" />
              </button>
            </div>
          </div>

          <div
            v-if="(features.isHost || features.isModerator) && !isHostUser(uid)"
            class="participantControlsBar"
          >
            <div class="grantTable" role="group" :aria-label="`Permissions for ${displayName(uid)}`">
              <label
                v-for="key in grantKeys"
                :key="`${uid}-${key}`"
                class="grantCheck"
                :class="{ checked: features.grantsForUser(uid)[key] }"
              >
                <input
                  type="checkbox"
                  :checked="features.grantsForUser(uid)[key]"
                  @change="onUserGrantChange(uid, key, $event)"
                />
                <span class="chipCheckIcon" aria-hidden="true">
                  {{ features.grantsForUser(uid)[key] ? '✓' : '' }}
                </span>
                <span class="chipLabel">{{ featureLabels[key] }}</span>
              </label>
            </div>

            <div v-if="canModerateUser(uid)" class="lockChipsGroup">
              <button
                type="button"
                class="lockChip"
                :class="{ active: isMicLocked(uid) }"
                :data-testid="`lock-mic-${uid}`"
                :title="isMicLocked(uid) ? 'Unlock microphone' : 'Force-lock microphone off'"
                @click="toggleMicLock(uid)"
              >
                <AppIcon :name="isMicLocked(uid) ? 'lock' : 'unlock'" :size="12" />
                <span>{{ isMicLocked(uid) ? 'Mic locked' : 'Lock mic' }}</span>
              </button>
              <button
                type="button"
                class="lockChip"
                :class="{ active: isCameraLocked(uid) }"
                :data-testid="`lock-camera-${uid}`"
                :title="isCameraLocked(uid) ? 'Unlock camera' : 'Force-lock camera off'"
                @click="toggleCameraLock(uid)"
              >
                <AppIcon :name="isCameraLocked(uid) ? 'lock' : 'unlock'" :size="12" />
                <span>{{ isCameraLocked(uid) ? 'Cam locked' : 'Lock cam' }}</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>

    <div v-else-if="features.panel === 'participants'" class="body modBody">
      <section class="section">
        <div class="peopleHeader">
          <h3 class="sectionTitle">Participants ({{ participantIds.length }})</h3>
        </div>
        <p class="sectionHint">People currently in this meeting.</p>
        <div
          v-for="uid in participantIds"
          :key="uid"
          class="participantCard"
          :class="{ isHost: isHostUser(uid), onStage: uid === features.stageOccupantId }"
        >
          <div class="participantHead">
            <div class="participantMeta">
              <div class="avatarCircle">{{ displayName(uid).slice(0, 1).toUpperCase() }}</div>
              <div class="nameAndRole">
                <div class="nameRow">
                  <span class="name">{{ displayName(uid) }}</span>
                  <span v-if="uid === local.id" class="youTag">(You)</span>
                </div>
                <div class="roleRow">
                  <span v-if="isHostUser(uid)" class="badge hostBadge">👑 Host</span>
                  <span v-else-if="isModeratorUser(uid)" class="badge modBadge">🛡️ Moderator</span>
                  <span v-else class="badge attendeeBadge">👤 Attendee</span>
                  <span
                    v-if="uid === features.stageOccupantId"
                    class="badge stageBadge"
                  >🎤 Presenter</span>
                  <span
                    v-else-if="uid === features.invitedStageUserId"
                    class="badge stageInvitedBadge"
                  >Invited</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <div v-else-if="features.panel === 'notes'" class="body notesBody">
      <div class="notesTabs">
        <button
          type="button"
          class="notesTabButton"
          :class="{ active: activeNotesTab === 'shared' }"
          @click="activeNotesTab = 'shared'"
        >
          Shared
        </button>
        <button
          type="button"
          class="notesTabButton"
          :class="{ active: activeNotesTab === 'private' }"
          @click="activeNotesTab = 'private'"
        >
          Private
        </button>
      </div>

      <template v-if="activeNotesTab === 'shared'">
        <div
          v-if="features.canModerate && pendingNotesChanges.length > 0"
          class="notesModQueue"
          data-testid="notes-mod-queue"
        >
          <div v-for="item in pendingNotesChanges" :key="item.id" class="notesModRow">
            <span class="notesModText"
              >Notes edit from {{ item.authorName }} (15s auto-approve)</span
            >
            <div class="notesModActions">
              <button
                type="button"
                class="btnAccept"
                @click="features.approveModerationChange(item.id, engine)"
              >
                Accept
              </button>
              <button
                type="button"
                class="btnReject"
                @click="features.rejectModerationChange(item.id, engine)"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
        <NotesEditor
          v-model="notesDraft"
          class="notesEditorWrap"
          :readonly="!features.canUseNotes"
          :ydoc="features.ydoc"
          @update:model-value="onNotesInput"
          @blur="onNotesBlur"
        />
        <p class="hint">Edits sync in real time for everyone in the call.</p>
      </template>
      <template v-else>
        <NotesEditor
          v-model="local.privateNotes"
          class="notesEditorWrap"
          @update:model-value="onPrivateNotesInput"
        />
        <div class="privateActions">
          <div class="notesDownloadGroup">
            <select v-model="privateNotesFormat" class="formatSelect" aria-label="Notes format">
              <option value="md">Markdown (.md)</option>
              <option value="rtf">Rich Text (.rtf)</option>
            </select>
            <button type="button" class="notesDownloadBtn" @click="downloadPrivateNotes">
              <AppIcon name="download" :size="14" /> Download
            </button>
          </div>
        </div>
      </template>
    </div>
  </MenuCard>
</template>

<style scoped>
.featureCard {
  position: fixed;
  width: min(340px, calc(100vw - 32px));
  max-height: min(480px, 55vh);
  display: flex;
  flex-direction: column;
  text-align: left;
}
.featureCard.modCard {
  height: auto;
  max-height: min(860px, calc(100vh - 110px));
}
.featureCard.notesCard {
  max-height: min(720px, calc(100vh - 100px));
}
@media (max-width: 768px) {
  .featureCard,
  .featureCard.modCard,
  .featureCard.notesCard {
    left: 8px !important;
    right: 8px !important;
    width: auto !important;
    bottom: 112px !important;
    height: auto !important;
    min-height: 0 !important;
    max-height: calc(100dvh - 140px) !important;
  }
}
.notesCard :deep(.header) {
  align-items: center;
  gap: 6px;
}
.notesCard :deep(.titleRow) {
  flex: 1;
  gap: 8px;
  min-width: 0;
}
.notesResetBtn {
  margin-left: auto;
  flex-shrink: 0;
  border: 1px solid var(--line-light);
  border-radius: var(--radius-round);
  padding: 4px 10px;
  min-height: 28px;
  box-sizing: border-box;
  font-size: var(--fs-small);
  font-family: var(--font-body);
  background: var(--btn-default-bg);
  color: var(--color-text-default);
  cursor: pointer;
  white-space: nowrap;
}
.notesResetBtn:hover {
  background: var(--btn-default-bg-hover);
  border-color: var(--line-default);
}
.body {
  flex: 1;
  overflow: auto;
  padding: 2px 0 4px;
}
.modBody {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.tabPane {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.settingsTabs {
  display: flex;
  gap: 4px;
  padding: 3px;
  background: #f1f5f9;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
}
.settingsTab {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: none;
  background: transparent;
  color: #475569;
  border-radius: 7px;
  padding: 7px 12px;
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font-body);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
}
.settingsTab.active {
  background: #fff;
  color: var(--color-blue100, #2563eb);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
}
.tabCount {
  font-size: 11px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 9999px;
  background: rgba(59, 130, 246, 0.12);
  color: var(--color-blue100, #2563eb);
}
.section {
  border: 1px solid var(--line-light, #e2e8f0);
  border-radius: 10px;
  padding: 12px 14px;
  background: var(--color-bg-card, #fff);
}
.sectionHead {
  margin-bottom: 8px;
}
.sectionTitle {
  margin: 0;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--color-text-default, #0f172a);
}
.sectionHint {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--color-mono40, #64748b);
}
.peopleHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}
.peopleHeaderTitleGroup {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}
.peopleHeaderActions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.peopleActionBtn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 9999px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  color: #334155;
  font-size: 12px;
  font-weight: 600;
  font-family: var(--font-body);
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}
.peopleActionBtn:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
}
.peopleActionBtn.active {
  background: rgba(59, 130, 246, 0.12);
  border-color: rgba(59, 130, 246, 0.5);
  color: #1d4ed8;
}
.peopleActionCard {
  margin: 8px 0 10px;
  padding: 10px 12px;
  border-radius: 9px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.inviteLabel {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--color-text-default, #0f172a);
}
.inviteFieldHint {
  display: block;
  font-size: 11.5px;
  color: var(--color-mono40, #64748b);
  line-height: 1.35;
}
.inviteInputRow,
.shareLinkRow {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.inviteEmailInput {
  flex: 1 1 200px;
  min-width: 0;
  padding: 7px 10px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #fff;
  color: var(--color-text-default, #0f172a);
  font-size: 13px;
  font-family: var(--font-body);
  box-sizing: border-box;
}
.inviteEmailInput:focus-visible {
  outline: 2px solid rgba(59, 130, 246, 0.45);
  outline-offset: 1px;
}
.inviteEmailInput:user-invalid,
.inviteEmailInput.user-invalid-fallback {
  border-color: #dc2626;
  background-color: #fef2f2;
}
.inviteEmailInput:user-valid {
  border-color: #16a34a;
}
.shareUrlInput {
  color: #334155;
  background: #fff;
}
.inviteSubmitBtn,
.shareCopyBtn,
.shareNativeBtn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 32px;
  white-space: nowrap;
}
.inviteSubmitBtn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
.inviteErrorMsg {
  display: none;
  margin: 0;
  font-size: 11.5px;
  font-weight: 500;
  color: #dc2626;
}
.inviteErrorMsg.visible,
.peopleActionCard:has(.inviteEmailInput:user-invalid) .inviteErrorMsg {
  display: block;
}
.inviteSuccessMsg {
  margin: 0;
  font-size: 11.5px;
  font-weight: 500;
  color: #15803d;
}
.invitedListBlock {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 2px;
  padding-top: 6px;
  border-top: 1px solid #e2e8f0;
}
.invitedListLabel {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
}
.invitedChips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.invitedChip {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 9999px;
  background: #eef2ff;
  color: #3730a3;
  border: 1px solid #c7d2fe;
}
.peopleCountBadge {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 9999px;
  background: #f1f5f9;
  color: #475569;
}
.roomControls {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.roomToggle {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-default, #0f172a);
  cursor: pointer;
  padding: 2px 0;
}
.toggleText {
  min-width: 0;
}
.switchInput {
  appearance: none;
  -webkit-appearance: none;
  width: 36px;
  height: 20px;
  border-radius: 9999px;
  background: #cbd5e1;
  position: relative;
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color 0.18s ease;
  margin: 0;
}
.switchInput::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  transition: transform 0.18s ease;
}
.switchInput:checked {
  background: var(--color-blue100, #3b82f6);
}
.switchInput:checked::after {
  transform: translateX(16px);
}
.switchInput:focus-visible {
  outline: 2px solid rgba(59, 130, 246, 0.4);
  outline-offset: 2px;
}
.stageStatusRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.stageStatusRow.withBorder {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--line-light, #eef2f6);
}
.stageStatus {
  margin: 0;
  font-size: 12.5px;
  color: var(--color-mono40, #64748b);
}
.stageStatus strong {
  color: var(--color-text-default, #0f172a);
}
.stageMessage {
  margin: 0;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.35);
  color: #b45309;
  font-size: 12.5px;
  font-weight: 500;
}
.grantTable {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.grantCheck {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 9999px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  color: #475569;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}
.grantCheck:hover {
  border-color: #94a3b8;
  background: #f1f5f9;
}
.grantCheck.checked {
  background: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.45);
  color: #1d4ed8;
}
.grantCheck input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
  pointer-events: none;
}
.chipCheckIcon {
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
}
.chipLabel {
  line-height: 1.1;
}
.participantCard {
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--line-light, #e2e8f0);
  background: #fff;
}
.participantCard.isHost {
  border-color: rgba(59, 130, 246, 0.4);
  background: #f8fafc;
}
.participantCard.onStage {
  border-color: rgba(16, 185, 129, 0.5);
}
.participantHead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.participantMeta {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}
.avatarCircle {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--color-blue10, #e0e7ff);
  color: var(--color-blue100, #3730a3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 13px;
  flex-shrink: 0;
}
.nameAndRole {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.nameRow {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.youTag {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-mono40, #64748b);
  flex-shrink: 0;
}
.roleRow {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}
.participantControlsBar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #f1f5f9;
}
.lockChipsGroup {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
}
.lockChip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 9999px;
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #475569;
  font-size: 11.5px;
  font-weight: 500;
  font-family: var(--font-body);
  cursor: pointer;
  transition: all 0.15s ease;
}
.lockChip:hover {
  border-color: #94a3b8;
  background: #f8fafc;
}
.lockChip.active {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.45);
  color: #b91c1c;
}
.lobbyBlock {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--line-light, #eef2f6);
}
.lobbyRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 6px;
}
.lobbyRowBtns {
  display: flex;
  gap: 6px;
}
.reason {
  font-size: 12px;
  color: #64748b;
  font-style: italic;
}
.name {
  font-weight: 600;
  font-size: 13px;
  color: var(--color-text-default, #0f172a);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.badge {
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 9999px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.badge.hostBadge {
  background: rgba(245, 158, 11, 0.15);
  color: #b45309;
  border: 1px solid rgba(245, 158, 11, 0.35);
}
.badge.modBadge {
  background: rgba(59, 130, 246, 0.14);
  color: #1d4ed8;
  border: 1px solid rgba(59, 130, 246, 0.35);
}
.badge.stageBadge {
  background: rgba(16, 185, 129, 0.14);
  color: #047857;
  border: 1px solid rgba(16, 185, 129, 0.35);
}
.badge.attendeeBadge {
  background: #f1f5f9;
  color: #64748b;
  border: 1px solid #e2e8f0;
}
.badge.lockBadge {
  background: rgba(239, 68, 68, 0.1);
  color: #b91c1c;
  border: 1px solid rgba(239, 68, 68, 0.3);
}
.modActions {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
}
.pill {
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 500;
  font-family: var(--font-body);
  cursor: pointer;
  background: var(--btn-primary-bg, #3b82f6);
  color: var(--btn-primary-fg, #fff);
  transition: filter 0.15s ease, background-color 0.15s ease;
}
.pill:hover {
  filter: brightness(0.96);
}
.pill.subtle {
  background: #f8fafc;
  color: var(--color-text-default, #334155);
  border-color: var(--line-light, #cbd5e1);
}
.pill.subtle:hover {
  background: #f1f5f9;
}
.pill.warn {
  background: rgba(239, 68, 68, 0.12);
  color: #b91c1c;
  border-color: rgba(239, 68, 68, 0.3);
}
.pill.warn:hover {
  background: #ef4444;
  color: #fff;
}
.iconBtnOnly {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border-radius: 8px;
}
.stageInvitedBadge {
  background: var(--color-blue95);
  color: var(--color-blue100);
  border: 1px solid var(--color-blue100);
  animation: pulseInvited 2s infinite;
}
@keyframes pulseInvited {
  0% {
    opacity: 0.8;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.8;
  }
}
.notesBody {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.notesEditorWrap {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
}
.hint {
  font-size: var(--fs-small);
  color: var(--color-mono30);
  margin: 8px 0 0;
}
.notesTabs {
  display: flex;
  background: var(--color-bg-inset, rgba(0, 0, 0, 0.05));
  padding: 3px;
  border-radius: var(--radius-sm, 6px);
  margin-bottom: 12px;
}
.notesTabButton {
  flex: 1;
  border: none;
  background: transparent;
  padding: 6px 12px;
  border-radius: 4px;
  font-family: var(--font-body);
  font-size: 0.825rem;
  font-weight: 500;
  color: var(--color-mono30, #64748b);
  cursor: pointer;
  transition: all 0.15s ease;
}
.notesTabButton.active {
  background: var(--input-bg, #fff);
  color: var(--color-text-default, #0f172a);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}
.privateActions {
  display: flex;
  margin-top: 10px;
  justify-content: flex-end;
}
.notesDownloadBtn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--btn-primary-bg, #4f6ef7);
  color: var(--btn-primary-fg, #fff);
  border: none;
  padding: 8px 14px;
  border-radius: var(--radius-sm, 6px);
  font-family: var(--font-body);
  font-size: 0.825rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}
.notesDownloadBtn:hover {
  opacity: 0.9;
}
.notesDownloadGroup {
  display: flex;
  align-items: center;
  gap: 8px;
}
.formatSelect {
  padding: 6px 10px;
  border: 1px solid var(--line-light, #cbd5e1);
  border-radius: var(--radius-sm, 6px);
  background: var(--color-bg-card, #ffffff);
  font-family: var(--font-body);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text-default, #1e293b);
  cursor: pointer;
}
.notesModQueue {
  margin-bottom: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.notesModRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background: var(--color-bg-inset, rgba(0, 0, 0, 0.04));
  border: 1px solid var(--line-light);
  border-radius: var(--radius-sm);
  padding: 6px 10px;
}
.notesModText {
  font-size: var(--fs-small, 12px);
  font-weight: 500;
}
.notesModActions,
.modQueueActions {
  display: flex;
  gap: 6px;
}
.modQueueList {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}
.modQueueRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  background: var(--color-bg-inset, rgba(0, 0, 0, 0.04));
  border: 1px solid var(--line-light);
  border-radius: var(--radius-sm);
}
.modQueueInfo {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;
}
.modQueueAuthor {
  font-size: 11px;
  color: var(--color-mono30);
}
.btnAccept {
  background: #10b981;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
.btnAccept:hover {
  background: #059669;
}
.btnReject {
  background: #ef4444;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
.btnReject:hover {
  background: #dc2626;
}
</style>
