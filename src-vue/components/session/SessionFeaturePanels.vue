<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { useMediaEngine } from '@/composables/useMediaEngine';
import MenuCard from '@/components/common/MenuCard.vue';
import NotesEditor from '@/components/session/NotesEditor.vue';
import { notesPanelWidth, sessionPanelLayout } from '@/constants/sessionPanels';
import { kickParticipant, muteParticipant } from '@/utils/sessionModeration';
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
  nextNotesDraft,
  shouldPublishNotesDraft,
} from '@/utils/sessionNotesPanel';
import { broadcastSharedNotes } from '@/utils/notesSync';
import HostRoomSettingsSection from '@/components/session/HostRoomSettingsSection.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const panelHeight = sessionPanelLayout.height;
const panelBottom = sessionPanelLayout.bottom;
const panelRight = sessionPanelLayout.right;
const notesWidth = notesPanelWidth;

const featureLabels: Record<FeatureKey, string> = {
  notes: 'Notes',
  whiteboard: 'Board',
  poll: 'Polls',
};

const features = useSessionFeaturesStore();
const conference = useConferenceStore();
const { engine } = useMediaEngine();

const notesDraft = ref(features.sharedNotes);
const notesDirty = ref(false);
/** Shared notes snapshot when the user started their current edit session. */
const notesEditBase = ref(features.sharedNotes);

watch(
  () => features.sharedNotes,
  (t) => {
    notesDraft.value = nextNotesDraft(notesDirty.value, t, notesDraft.value);
    if (!notesDirty.value) {
      notesEditBase.value = t;
    }
  },
);

watch(
  () => features.panel,
  (panel, prev) => {
    if (panel === 'notes' && prev !== 'notes') {
      notesDraft.value = features.sharedNotes;
      notesDirty.value = false;
      notesEditBase.value = features.sharedNotes;
    }
  },
);

function onNotesInput() {
  if (!notesDirty.value) {
    notesEditBase.value = features.sharedNotes;
  }
  notesDirty.value = true;
  pushNotes();
}

function onNotesBlur() {
  const remoteChangedDuringEdit =
    notesDirty.value && features.sharedNotes !== notesEditBase.value;
  if (
    notesDirty.value &&
    !remoteChangedDuringEdit &&
    shouldPublishNotesDraft(notesDraft.value, features.sharedNotes)
  ) {
    flushNotes();
  } else {
    cancelNotes();
  }
  notesDirty.value = false;
  notesEditBase.value = features.sharedNotes;
  notesDraft.value = features.sharedNotes;
}

const { push: pushNotes, flush: flushNotes, cancel: cancelNotes, dispose: disposeNotesPush } =
  createNotesPushScheduler(
  () => features.canUseNotes,
  () => notesDraft.value,
  (text) => {
    if (!shouldPublishNotesDraft(text, features.sharedNotes)) return;
    if (features.sharedNotes !== notesEditBase.value) return;
    features.sharedNotes = text;
    broadcastSharedNotes(engine, text);
    notesDirty.value = false;
    notesEditBase.value = text;
  },
);

const canResetNotesToTemplate = computed(
  () => features.isHost && !!features.notesTemplate.trim(),
);

function resetNotesToTemplate() {
  cancelNotes();
  features.resetSharedNotesToTemplate();
  notesDraft.value = features.sharedNotes;
  notesEditBase.value = features.sharedNotes;
  notesDirty.value = false;
  broadcastSharedNotes(engine, features.sharedNotes);
}

function syncLobby() {
  engine.sendCommand('lobby', JSON.stringify({ enabled: features.lobbyEnabled }));
}

function syncRoomDefaults() {
  engine.sendCommand('access', JSON.stringify({ defaults: features.roomDefaults }));
}

function syncUserGrants(userId: string) {
  engine.sendCommand(
    'access',
    JSON.stringify({
      userId,
      grants: features.grantsForUser(userId),
    }),
  );
}

function onRoomDefaultChange(key: FeatureKey, event: Event) {
  const checked = (event.target as HTMLInputElement).checked;
  features.setRoomDefault(key, checked);
  syncRoomDefaults();
}

function onUserGrantChange(userId: string, key: FeatureKey, event: Event) {
  const checked = (event.target as HTMLInputElement).checked;
  features.setUserGrant(userId, key, checked);
  syncUserGrants(userId);
}

function approve(entryId: string) {
  engine.sendCommand('lobby', JSON.stringify({ action: 'approve', id: entryId }));
  features.approveLobby(entryId);
}

function kickUser(id: string) {
  kickParticipant(conference, engine, id);
}

function muteUser(id: string) {
  muteParticipant(conference, engine, id);
}

function onStagePromotionToggle(event: Event) {
  const enabled = (event.target as HTMLInputElement).checked;
  syncStagePromotionEnabled(engine, enabled);
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
  conference.usersEpoch;
  return (
    (conference.users[uid]?.user as { _displayName?: string } | undefined)?._displayName ?? uid
  );
}

const participantIds = computed(() => {
  conference.usersEpoch;
  return Object.keys(conference.users);
});

onBeforeUnmount(disposeNotesPush);

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
      return 'Moderator';
    case 'notes':
      return 'Shared notes';
    default:
      return '';
  }
});

const featureCardStyle = computed(() => {
  const style = featureCardStyleForPanel(features.panel, {
    right: panelRight,
    bottom: panelBottom,
    height: panelHeight,
    notesWidth,
  });
  if (features.panel === 'moderator') {
    return {
      ...style,
      width: 'min(520px, calc(100vw - 32px))',
      maxHeight: 'min(960px, calc(100vh - 120px))',
    };
  }
  return style;
});
</script>

<template>
  <MenuCard
    v-if="panelOpen"
    :title="title"
    :class="['featureCard', features.panel === 'notes' ? 'notesCard' : '', features.panel === 'moderator' ? 'modCard' : '']"
    :style="featureCardStyle"
    :onClose="() => (features.panel = '')"
  >
    <template v-if="features.panel === 'notes' && canResetNotesToTemplate" #afterTitle>
      <button type="button" class="notesResetBtn" @click="resetNotesToTemplate">
        Reset to template
      </button>
    </template>
    <div v-if="features.panel === 'moderator'" class="body modBody">
      <HostRoomSettingsSection v-if="features.isHost" />

      <p v-if="features.stageMessage" class="stageMessage" role="status">{{ features.stageMessage }}</p>

      <section class="section">
        <div class="roomControls">
          <label class="roomToggle">
            <input v-model="features.lobbyEnabled" type="checkbox" @change="syncLobby" />
            <span>Lobby</span>
          </label>
          <label class="roomToggle">
            <input
              :checked="features.stagePromotionEnabled"
              type="checkbox"
              @change="onStagePromotionToggle"
            />
            <span>Allow stage promotion</span>
          </label>
        </div>
        <p class="stageStatus">Stage: <strong>{{ stageStatusLabel }}</strong></p>
        <div v-if="features.lobbyWaiting.length" class="lobbyBlock">
          <p class="sectionHint">Waiting to join</p>
          <div v-for="w in features.lobbyWaiting" :key="w.id" class="lobbyRow">
            <span class="name">{{ w.name }}</span>
            <button type="button" class="pill" @click="approve(w.id)">Admit</button>
          </div>
        </div>
      </section>

      <section class="section">
        <h3 class="sectionTitle">Feature access</h3>
        <p class="sectionHint">Default permissions for new participants.</p>
        <div class="grantTable" role="presentation">
          <span class="grantCorner" aria-hidden="true" />
          <span
            v-for="key in (Object.keys(featureLabels) as FeatureKey[])"
            :key="`head-${key}`"
            class="grantColHead"
          >
            {{ featureLabels[key] }}
          </span>
          <span class="grantRowLabel">Everyone</span>
          <label
            v-for="key in (Object.keys(featureLabels) as FeatureKey[])"
            :key="`room-${key}`"
            class="grantCheck"
          >
            <input
              type="checkbox"
              :checked="features.roomDefaults[key]"
              @change="onRoomDefaultChange(key, $event)"
            />
          </label>
        </div>
      </section>

      <section class="section">
        <h3 class="sectionTitle">Participants</h3>
        <div
          v-for="uid in participantIds"
          :key="uid"
          class="participantCard"
          :class="{ isHost: uid === features.hostId, onStage: uid === features.stageOccupantId }"
        >
          <div class="participantHead">
            <div class="participantMeta">
              <span class="name">{{ displayName(uid) }}</span>
              <span v-if="uid === features.hostId" class="badge">Host</span>
              <span v-else-if="uid === features.stageOccupantId" class="badge stageBadge">On stage</span>
              <span v-else-if="uid === features.invitedStageUserId" class="badge stageInvitedBadge">Invited</span>
            </div>
            <div class="modActions">
              <button
                v-if="features.canPromoteToStage && uid !== features.stageOccupantId && uid !== features.invitedStageUserId"
                type="button"
                class="pill"
                @click="promoteUser(uid)"
              >
                Promote
              </button>
              <button
                v-if="features.isHost && (uid === features.stageOccupantId || uid === features.invitedStageUserId)"
                type="button"
                class="pill subtle"
                @click="demoteUser(uid)"
              >
                {{ uid === features.stageOccupantId ? 'Remove from stage' : 'Cancel invite' }}
              </button>
              <button
                v-if="uid !== features.hostId"
                type="button"
                class="pill subtle iconBtnOnly"
                title="Mute"
                @click="muteUser(uid)"
              >
                <AppIcon name="mic-off" :size="16" />
              </button>
              <button
                v-if="uid !== features.hostId"
                type="button"
                class="pill warn iconBtnOnly"
                title="Remove"
                @click="kickUser(uid)"
              >
                <AppIcon name="user-minus" :size="16" />
              </button>
            </div>
          </div>
          <div v-if="uid !== features.hostId" class="grantTable" role="presentation">
            <span class="grantCorner" aria-hidden="true" />
            <span
              v-for="key in (Object.keys(featureLabels) as FeatureKey[])"
              :key="`head-${uid}-${key}`"
              class="grantColHead"
            >
              {{ featureLabels[key] }}
            </span>
            <span class="grantRowLabel">Permissions</span>
            <label
              v-for="key in (Object.keys(featureLabels) as FeatureKey[])"
              :key="`${uid}-${key}`"
              class="grantCheck"
            >
              <input
                type="checkbox"
                :checked="features.grantsForUser(uid)[key]"
                @change="onUserGrantChange(uid, key, $event)"
              />
            </label>
          </div>
        </div>
      </section>
    </div>

    <div v-else-if="features.panel === 'notes'" class="body notesBody">
      <NotesEditor
        v-model="notesDraft"
        class="notesEditorWrap"
        :readonly="!features.canUseNotes"
        @update:model-value="onNotesInput"
        @blur="onNotesBlur"
      />
      <p class="hint">Edits sync in real time for everyone in the call.</p>
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
}
.featureCard.modCard {
  height: auto;
  min-height: min(768px, calc((100vh - 120px) * 0.8));
  max-height: min(960px, calc(100vh - 120px));
}
.featureCard.notesCard {
  max-height: min(720px, calc(100vh - 100px));
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
.notesCard :deep(.close) {
  transform: none;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--line-light);
  border-radius: var(--radius-round);
  background: var(--btn-default-bg);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.notesCard :deep(.close:hover) {
  background: var(--btn-default-bg-hover);
  border-color: var(--line-default);
}
.notesCard :deep(.x) {
  font-size: 18px;
  line-height: 1;
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
  padding: 4px 0 8px;
}
.modBody {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.section {
  border: 1px solid var(--line-light);
  border-radius: var(--radius-sm);
  padding: 12px;
  background: var(--color-bg-card);
}
.sectionTitle {
  margin: 0 0 4px;
  font-size: var(--fs-body);
  font-weight: var(--fw-medium);
  color: var(--color-text-default);
}
.sectionHint {
  margin: 0 0 10px;
  font-size: var(--fs-small);
  color: var(--color-mono30);
}
.roomControls {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
  margin-bottom: 8px;
}
.roomToggle {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: var(--fs-body);
  cursor: pointer;
}
.stageStatus {
  margin: 0;
  font-size: var(--fs-small);
  color: var(--color-mono30);
}
.stageMessage {
  margin: 0;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  background: var(--btn-warning-bg);
  color: var(--btn-warning-fg);
  font-size: var(--fs-small);
}
.grantTable {
  display: grid;
  grid-template-columns: minmax(72px, auto) repeat(3, minmax(52px, 1fr));
  gap: 8px 10px;
  align-items: center;
}
.grantCorner {
  justify-self: start;
}
.grantColHead {
  font-size: var(--fs-small);
  font-weight: var(--fw-medium);
  color: var(--color-mono30);
  text-align: center;
}
.grantRowLabel {
  justify-self: start;
  font-size: var(--fs-small);
  font-weight: var(--fw-medium);
}
.grantCheck {
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
}
.grantTableHead {
  margin-bottom: 8px;
}
.participantCard .grantTable {
  margin-top: 8px;
}
.participantMeta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.participantCard.onStage {
  border-color: var(--color-blue100);
}
.stageBadge {
  background: var(--btn-highlight-bg);
  color: var(--btn-highlight-fg);
}
.lobbyBlock {
  margin-top: 10px;
}
.lobbyRow,
.participantHead {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.lobbyRow {
  margin-top: 6px;
}
.participantCard {
  margin-top: 10px;
  padding: 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--line-light);
  background: #fff;
}
.participantCard.isHost {
  border-color: var(--color-blue100);
  background: var(--color-mono95);
}
.participantHead {
  justify-content: space-between;
}
.name {
  font-weight: var(--fw-medium);
  font-size: var(--fs-small);
  color: var(--color-text-default);
}
.badge {
  font-size: var(--fs-small);
  padding: 2px 8px;
  border-radius: var(--radius-round);
  background: var(--btn-primary-bg);
  color: var(--btn-primary-fg);
}
.modActions {
  display: flex;
  gap: 6px;
}
.pill {
  border: none;
  border-radius: var(--radius-round);
  padding: 4px 10px;
  font-size: var(--fs-small);
  font-family: var(--font-body);
  cursor: pointer;
  background: var(--btn-primary-bg);
  color: var(--btn-primary-fg);
}
.pill.subtle {
  background: var(--btn-default-bg);
  color: var(--color-text-default);
  border: 1px solid var(--line-light);
}
.pill.warn {
  background: var(--btn-warning-bg);
  color: var(--btn-warning-fg);
}
.iconBtnOnly {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
}
.stageInvitedBadge {
  background: var(--color-blue95);
  color: var(--color-blue100);
  border: 1px solid var(--color-blue100);
  animation: pulseInvited 2s infinite;
}
@keyframes pulseInvited {
  0% { opacity: 0.8; }
  50% { opacity: 1; }
  100% { opacity: 0.8; }
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
</style>
