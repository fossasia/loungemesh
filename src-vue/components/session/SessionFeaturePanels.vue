<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { useMediaEngine } from '@/composables/useMediaEngine';
import MenuCard from '@/components/common/MenuCard.vue';
import { notesPanelWidth, sessionPanelLayout } from '@/constants/sessionPanels';
import { kickParticipant, muteParticipant } from '@/utils/sessionModeration';
import type { FeatureKey } from '@/types/userGrants';
import {
  createNotesPushScheduler,
  featureCardStyleForPanel,
  nextNotesDraft,
  shouldPublishNotesDraft,
} from '@/utils/sessionNotesPanel';

const panelHeight = sessionPanelLayout.height;
const panelBottom = sessionPanelLayout.bottom;
const panelRight = sessionPanelLayout.right;
const notesWidth = notesPanelWidth;

const featureLabels: Record<FeatureKey, string> = {
  notes: 'Notes',
  whiteboard: 'Board',
  poll: 'Polls',
  stage: 'Stage',
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
    engine.sendCommand('notes', JSON.stringify({ text }));
    notesDirty.value = false;
    notesEditBase.value = text;
  },
);

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
    features.panel !== 'poll',
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
      maxHeight: panelHeight,
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
    <div v-if="features.panel === 'moderator'" class="body modBody">
      <section class="section">
        <h3 class="sectionTitle">Room defaults</h3>
        <p class="sectionHint">New participants start with these permissions unless overridden below.</p>
        <div class="grantGrid grantGridHead">
          <span />
          <span v-for="key in (Object.keys(featureLabels) as FeatureKey[])" :key="key">{{
            featureLabels[key]
          }}</span>
        </div>
        <div class="grantGrid">
          <span class="grantLabel">Everyone</span>
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
        <label class="lobbyToggle">
          <input v-model="features.lobbyEnabled" type="checkbox" @change="syncLobby" />
          <span>Lobby / waiting room</span>
        </label>
        <div v-if="features.lobbyWaiting.length" class="lobbyBlock">
          <p class="sectionHint">Waiting to join</p>
          <div v-for="w in features.lobbyWaiting" :key="w.id" class="lobbyRow">
            <span class="name">{{ w.name }}</span>
            <button type="button" class="pill" @click="approve(w.id)">Admit</button>
          </div>
        </div>
      </section>

      <section class="section">
        <h3 class="sectionTitle">Per participant</h3>
        <p class="sectionHint">Override access for individuals. Host always has full access.</p>
        <div
          v-for="uid in participantIds"
          :key="uid"
          class="participantCard"
          :class="{ isHost: uid === features.hostId }"
        >
          <div class="participantHead">
            <span class="name">{{ displayName(uid) }}</span>
            <span v-if="uid === features.hostId" class="badge">Host</span>
            <div v-else class="modActions">
              <button type="button" class="pill subtle" @click="muteUser(uid)">Mute</button>
              <button type="button" class="pill warn" @click="kickUser(uid)">Remove</button>
            </div>
          </div>
          <div v-if="uid !== features.hostId" class="grantGrid grantGridCompact">
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
              <span class="grantMini">{{ featureLabels[key] }}</span>
            </label>
          </div>
        </div>
      </section>
    </div>

    <div v-else-if="features.panel === 'notes'" class="body notesBody">
      <textarea
        v-model="notesDraft"
        class="notesTa"
        placeholder="Collaborative notes — visible to everyone in the call"
        :readonly="!features.canUseNotes"
        @input="onNotesInput"
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
.featureCard.modCard,
.featureCard.notesCard {
  max-height: min(720px, calc(100vh - 100px));
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
.grantGrid {
  display: grid;
  grid-template-columns: 1fr repeat(4, 36px);
  gap: 6px 8px;
  align-items: center;
}
.grantGridHead {
  font-size: var(--fs-small);
  font-weight: var(--fw-medium);
  color: var(--color-mono30);
  text-align: center;
}
.grantGridHead span:first-child {
  text-align: left;
}
.grantLabel {
  font-size: var(--fs-small);
  font-weight: var(--fw-medium);
}
.grantCheck {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  cursor: pointer;
}
.grantMini {
  font-size: 0.7rem;
  color: var(--color-mono30);
}
.grantGridCompact {
  grid-template-columns: repeat(4, 1fr);
  margin-top: 8px;
}
.lobbyToggle {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: var(--fs-body);
  cursor: pointer;
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
.notesBody {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.notesTa {
  flex: 1;
  min-height: 0;
  resize: none;
  width: 100%;
  box-sizing: border-box;
  font-family: var(--font-body);
  border: 1px solid var(--line-dark);
  border-radius: var(--radius-sm);
  padding: 8px;
}
.hint {
  font-size: var(--fs-small);
  color: var(--color-mono30);
  margin: 8px 0 0;
}
</style>
