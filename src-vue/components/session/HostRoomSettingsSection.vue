<script setup lang="ts">
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { useMediaEngine } from '@/composables/useMediaEngine';
import {
  GridBackgroundError,
  gridBackgroundRequirementsHint,
  processGridBackgroundFile,
} from '@/utils/gridBackgroundImage';
import {
  NotesTemplateError,
  notesTemplateRequirementsHint,
  processNotesTemplateFile,
} from '@/utils/notesTemplateFile';
import { broadcastHostRoomSettings } from '@/utils/hostRoomSettings';

const props = withDefaults(
  defineProps<{
    /** Background and notes template only. Room-wide switches stay with the host. */
    appearanceOnly?: boolean;
  }>(),
  { appearanceOnly: false },
);

const features = useSessionFeaturesStore();
const { engine } = useMediaEngine();
const route = useRoute();

const backgroundError = ref('');
const templateError = ref('');
const backgroundBusy = ref(false);
const templateBusy = ref(false);

function syncBackground() {
  broadcastHostRoomSettings(engine, features);
}

async function onBackgroundSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  backgroundError.value = '';
  backgroundBusy.value = true;
  try {
    const dataUrl = await processGridBackgroundFile(file);
    await features.setGridBackgroundUrl(dataUrl);
    syncBackground();
  } catch (e) {
    backgroundError.value =
      e instanceof GridBackgroundError ? e.message : 'Could not use that image.';
  } finally {
    backgroundBusy.value = false;
  }
}

function clearBackground() {
  backgroundError.value = '';
  features.clearGridBackground();
  broadcastHostRoomSettings(engine, features, { announceClear: true });
}

async function onTemplateSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  templateError.value = '';
  templateBusy.value = true;
  try {
    const text = await processNotesTemplateFile(file);
    features.setNotesTemplate(text);
    features.publishNotesTemplate(engine);
  } catch (e) {
    templateError.value =
      e instanceof NotesTemplateError ? e.message : 'Could not read that template.';
  } finally {
    templateBusy.value = false;
  }
}

function onLobbyFormChange(event: Event) {
  const lobbyForm = (event.target as HTMLSelectElement).value === 'details' ? 'details' : 'name';
  features.lobbyForm = lobbyForm;
  features.syncConfig(engine);
  const roomName = String(route.params.id || '');
  if (roomName) void features.updateRoomConfig(roomName, { lobbyForm }, engine);
}

function clearTemplate() {
  templateError.value = '';
  features.clearNotesTemplate();
}

import type { GatedFeatureKey } from '@/utils/featureAccess';
import { computed } from 'vue';

const availableFeatures: Array<{ key: GatedFeatureKey; label: string }> = [
  { key: 'chat', label: 'Public Chat' },
  { key: 'notes', label: 'Shared Notes' },
  { key: 'whiteboard', label: 'Whiteboard' },
  { key: 'poll', label: 'Polls' },
  { key: 'stage', label: 'Stage Spotlight' },
];

const confirmingFeature = ref<GatedFeatureKey | null>(null);
const targetState = ref(false);

const confirmingFeatureLabel = computed(() => {
  /* v8 ignore next */
  return availableFeatures.find((f) => f.key === confirmingFeature.value)?.label || '';
});

function promptToggleFeature(key: GatedFeatureKey) {
  confirmingFeature.value = key;
  targetState.value = features.enabledFeatures[key] === false;
}

function cancelConfirmFeature() {
  confirmingFeature.value = null;
}

function applyConfirmedFeature() {
  /* v8 ignore next */
  if (!confirmingFeature.value) return;
  features.setFeatureEnabled(confirmingFeature.value, targetState.value, engine);
  confirmingFeature.value = null;
}
</script>

<template>
  <section class="section">
    <h3 class="sectionTitle">Room appearance</h3>
    <p class="sectionHint">{{ gridBackgroundRequirementsHint() }}</p>
    <div class="uploadRow">
      <label class="pill uploadLabel">
        <input
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp,.jpg,.jpeg"
          class="fileInput"
          :disabled="backgroundBusy"
          @change="onBackgroundSelected"
        />
        {{ backgroundBusy ? 'Processing…' : features.gridBackgroundUrl ? 'Replace image' : 'Upload image' }}
      </label>
      <button
        v-if="features.gridBackgroundUrl"
        type="button"
        class="pill subtle"
        :disabled="backgroundBusy"
        @click="clearBackground"
      >
        Remove
      </button>
    </div>
    <div v-if="features.gridBackgroundUrl" class="previewWrap">
      <img :src="features.gridBackgroundUrl" alt="" class="preview" />
    </div>
    <p v-if="backgroundError" class="error">{{ backgroundError }}</p>

    <h3 v-if="!props.appearanceOnly" class="sectionTitle sectionTitleSpaced">Lobby</h3>
    <label v-if="!props.appearanceOnly" class="uploadRow" for="lobbyFormSelect">
      <span>What people in the lobby enter</span>
      <select id="lobbyFormSelect" class="pill" :value="features.lobbyForm" @change="onLobbyFormChange">
        <option value="name">Name only</option>
        <option value="details">Name and email</option>
      </select>
    </label>

    <h3 class="sectionTitle sectionTitleSpaced">Notes template</h3>
    <p class="sectionHint">{{ notesTemplateRequirementsHint() }}</p>
    <div class="uploadRow">
      <label class="pill uploadLabel">
        <input
          type="file"
          accept=".md,.markdown,.txt,text/plain,text/markdown"
          class="fileInput"
          :disabled="templateBusy"
          @change="onTemplateSelected"
        />
        {{ templateBusy ? 'Reading…' : features.notesTemplate ? 'Replace template' : 'Upload template' }}
      </label>
      <button
        v-if="features.notesTemplate"
        type="button"
        class="pill subtle"
        :disabled="templateBusy"
        @click="clearTemplate"
      >
        Remove
      </button>
    </div>
    <p v-if="features.notesTemplate" class="templateStatus">Template active</p>
    <p v-if="templateError" class="error">{{ templateError }}</p>

    <h3 v-if="!props.appearanceOnly" class="sectionTitle sectionTitleSpaced">Room features</h3>
    <p v-if="!props.appearanceOnly" class="sectionHint">Control which features are enabled room-wide. Disabled features are hidden from participants and cannot be used or moderated.</p>
    <div v-if="!props.appearanceOnly" class="featuresList">
      <div v-for="feat in availableFeatures" :key="feat.key" class="featureRow">
        <div class="featureInfo">
          <span class="featureName">{{ feat.label }}</span>
          <span
            class="featureBadge"
            :class="features.enabledFeatures[feat.key] !== false ? 'enabledBadge' : 'disabledBadge'"
          >
            {{ features.enabledFeatures[feat.key] !== false ? 'Enabled' : 'Disabled' }}
          </span>
        </div>
        <button
          type="button"
          class="pill featureToggleBtn"
          :class="features.enabledFeatures[feat.key] !== false ? 'warn' : 'primary'"
          @click="promptToggleFeature(feat.key)"
        >
          {{ features.enabledFeatures[feat.key] !== false ? 'Disable' : 'Enable' }}
        </button>
      </div>
    </div>

    <div v-if="confirmingFeature" class="confirmModalOverlay" role="dialog" aria-modal="true">
      <div class="confirmModalCard">
        <h4 class="confirmModalTitle">Confirm Feature Change</h4>
        <p class="confirmModalText">
          Are you sure you want to {{ targetState ? 'enable' : 'disable' }} <strong>{{ confirmingFeatureLabel }}</strong> for all participants?
        </p>
        <div class="confirmModalActions">
          <button type="button" class="pill cancelConfirmBtn" @click="cancelConfirmFeature">Cancel</button>
          <button type="button" class="pill warn applyConfirmBtn" @click="applyConfirmedFeature">Confirm</button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.sectionTitleSpaced {
  margin-top: 16px;
}
.uploadRow {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.uploadLabel {
  position: relative;
  overflow: hidden;
  cursor: pointer;
}
.fileInput {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
.previewWrap {
  margin-top: 10px;
  border: 1px solid var(--line-light);
  border-radius: var(--radius-sm);
  overflow: hidden;
  max-width: 200px;
  background: var(--color-mono95);
}
.preview {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 1;
  object-fit: contain;
}
.templateStatus {
  margin: 8px 0 0;
  font-size: var(--fs-small);
  color: var(--color-mono30);
}
.error {
  margin: 8px 0 0;
  font-size: var(--fs-small);
  color: var(--btn-warning-bg);
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
.featuresList {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}
.featureRow {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  background: var(--color-mono95);
  border-radius: var(--radius-sm);
  border: 1px solid var(--line-light);
}
.featureInfo {
  display: flex;
  align-items: center;
  gap: 8px;
}
.featureName {
  font-size: var(--fs-small);
  font-weight: var(--fw-medium);
  color: var(--color-text-default);
}
.featureBadge {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: var(--radius-round);
  font-weight: var(--fw-medium);
}
.enabledBadge {
  background: rgba(34, 197, 94, 0.15);
  color: #16a34a;
}
.disabledBadge {
  background: rgba(239, 68, 68, 0.15);
  color: #dc2626;
}
.featureToggleBtn {
  font-size: var(--fs-small);
  padding: 3px 10px;
}
.featureToggleBtn.primary {
  background: var(--btn-primary-bg);
  color: var(--btn-primary-fg);
}
.featureToggleBtn.warn {
  background: var(--btn-warning-bg);
  color: var(--btn-warning-fg);
}
.confirmModalOverlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10050;
}
.confirmModalCard {
  background: var(--color-bg-card);
  padding: 20px;
  border-radius: var(--radius-md);
  border: 1px solid var(--line-light);
  max-width: 380px;
  width: 90%;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}
.confirmModalTitle {
  margin: 0 0 8px;
  font-size: var(--fs-body);
  font-weight: var(--fw-bold);
  color: var(--color-text-default);
}
.confirmModalText {
  margin: 0 0 16px;
  font-size: var(--fs-small);
  color: var(--color-text-default);
}
.confirmModalActions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.cancelConfirmBtn {
  background: var(--btn-default-bg);
  color: var(--color-text-default);
  border: 1px solid var(--line-light);
}
</style>
