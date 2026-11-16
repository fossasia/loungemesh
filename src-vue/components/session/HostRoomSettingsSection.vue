<script setup lang="ts">
import { computed, ref } from 'vue';
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
import type { GatedFeatureKey } from '@/utils/featureAccess';

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
  <div class="hostSettingsStack">
    <section class="section">
      <div class="mediaRow">
        <div class="mediaCopy">
          <h3 class="sectionTitle">Room appearance</h3>
          <p class="sectionHint" :title="gridBackgroundRequirementsHint()">
            PNG, JPEG, or WebP (max 2 MB) · Fixed full-screen wallpaper synced to everyone.
          </p>
        </div>
        <div class="uploadRow">
          <label class="pill uploadLabel">
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,.jpg,.jpeg"
              class="fileInput"
              :disabled="backgroundBusy"
              @change="onBackgroundSelected"
            />
            {{ backgroundBusy ? 'Processing…' : features.gridBackgroundUrl ? 'Replace' : 'Upload image' }}
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
      </div>
      <div v-if="features.gridBackgroundUrl" class="previewWrap">
        <img :src="features.gridBackgroundUrl" alt="Room background preview" class="preview" />
      </div>
      <p v-if="backgroundError" class="error">{{ backgroundError }}</p>

      <div class="rowDivider" />

      <div class="mediaRow">
        <div class="mediaCopy">
          <div class="titleWithTag">
            <h3 class="sectionTitle">Notes template</h3>
            <span v-if="features.notesTemplate" class="templateStatus">Active</span>
          </div>
          <p class="sectionHint" :title="notesTemplateRequirementsHint()">
            Markdown or plain text (.md, .txt) · Replaces shared notes for the room.
          </p>
        </div>
        <div class="uploadRow">
          <label class="pill uploadLabel">
            <input
              type="file"
              accept=".md,.markdown,.txt,text/plain,text/markdown"
              class="fileInput"
              :disabled="templateBusy"
              @change="onTemplateSelected"
            />
            {{ templateBusy ? 'Reading…' : features.notesTemplate ? 'Replace' : 'Upload template' }}
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
      </div>
      <p v-if="templateError" class="error">{{ templateError }}</p>

      <template v-if="!props.appearanceOnly">
        <div class="rowDivider" />
        <label class="fieldRow" for="lobbyFormSelect">
          <div class="mediaCopy">
            <span class="fieldLabel">What people in the lobby enter</span>
            <span class="sectionHint">Shown to guests waiting for admission.</span>
          </div>
          <select
            id="lobbyFormSelect"
            class="selectInput"
            :value="features.lobbyForm"
            @change="onLobbyFormChange"
          >
            <option value="name">Name only</option>
            <option value="details">Name and email</option>
          </select>
        </label>
      </template>
    </section>

    <section v-if="!props.appearanceOnly" class="section">
      <div class="sectionHead">
        <h3 class="sectionTitle">Room features</h3>
        <p class="sectionHint">
          Disable features room-wide to hide them from participants.
        </p>
      </div>
      <div class="featuresList">
        <div v-for="feat in availableFeatures" :key="feat.key" class="featureRow">
          <div class="featureInfo">
            <span
              class="statusDot"
              :class="features.enabledFeatures[feat.key] !== false ? 'isOn' : 'isOff'"
              aria-hidden="true"
            />
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
            :class="features.enabledFeatures[feat.key] !== false ? 'warnOutline' : 'primary'"
            @click="promptToggleFeature(feat.key)"
          >
            {{ features.enabledFeatures[feat.key] !== false ? 'Disable' : 'Enable' }}
          </button>
        </div>
      </div>
    </section>

    <div v-if="confirmingFeature" class="confirmModalOverlay" role="dialog" aria-modal="true">
      <div class="confirmModalCard">
        <h4 class="confirmModalTitle">Confirm Feature Change</h4>
        <p class="confirmModalText">
          Are you sure you want to {{ targetState ? 'enable' : 'disable' }}
          <strong>{{ confirmingFeatureLabel }}</strong> for all participants?
        </p>
        <div class="confirmModalActions">
          <button type="button" class="pill cancelConfirmBtn" @click="cancelConfirmFeature">
            Cancel
          </button>
          <button type="button" class="pill warn applyConfirmBtn" @click="applyConfirmedFeature">
            Confirm
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hostSettingsStack {
  display: flex;
  flex-direction: column;
  gap: 12px;
  text-align: left;
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
.mediaRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.mediaCopy {
  flex: 1 1 200px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.titleWithTag {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sectionTitle {
  margin: 0;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--color-text-default, #0f172a);
}
.sectionHint {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--color-mono40, #64748b);
}
.rowDivider {
  height: 1px;
  background: var(--line-light, #eef2f6);
  margin: 10px 0;
}
.uploadRow {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  flex-shrink: 0;
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
  margin-top: 8px;
  border: 1px solid var(--line-light, #e2e8f0);
  border-radius: 8px;
  overflow: hidden;
  max-width: 148px;
  max-height: 84px;
  background: #f8fafc;
}
.preview {
  display: block;
  width: 100%;
  height: 84px;
  object-fit: cover;
}
.templateStatus {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 9999px;
  background: rgba(22, 163, 74, 0.12);
  color: #15803d;
}
.fieldRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
}
.fieldLabel {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-default, #0f172a);
}
.selectInput {
  border: 1px solid var(--line-light, #cbd5e1);
  border-radius: 8px;
  padding: 5px 10px;
  font-size: 12.5px;
  font-family: var(--font-body);
  font-weight: 500;
  color: var(--color-text-default, #0f172a);
  background: #f8fafc;
  cursor: pointer;
  flex-shrink: 0;
}
.selectInput:focus {
  outline: 2px solid rgba(59, 130, 246, 0.35);
  border-color: var(--color-blue100, #3b82f6);
}
.error {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--btn-warning-bg, #dc2626);
}
.pill {
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 5px 11px;
  font-size: 12.5px;
  font-weight: 500;
  font-family: var(--font-body);
  cursor: pointer;
  background: var(--btn-primary-bg, #3b82f6);
  color: var(--btn-primary-fg, #fff);
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  white-space: nowrap;
}
.pill:hover:not(:disabled) {
  filter: brightness(0.96);
}
.pill.subtle {
  background: #f8fafc;
  color: var(--color-text-default, #334155);
  border-color: var(--line-light, #cbd5e1);
}
.pill.subtle:hover:not(:disabled) {
  background: #f1f5f9;
}
.pill.warn {
  background: var(--btn-warning-bg, #ef4444);
  color: var(--btn-warning-fg, #fff);
}
.featuresList {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.featureRow {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid var(--line-light, #e2e8f0);
}
.featureInfo {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.statusDot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.statusDot.isOn {
  background: #16a34a;
}
.statusDot.isOff {
  background: #94a3b8;
}
.featureName {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-default, #0f172a);
}
.featureBadge {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 9999px;
  font-weight: 500;
}
.enabledBadge {
  background: rgba(22, 163, 74, 0.12);
  color: #15803d;
}
.disabledBadge {
  background: rgba(100, 116, 139, 0.14);
  color: #475569;
}
.featureToggleBtn {
  padding: 4px 10px;
  font-size: 12px;
}
.featureToggleBtn.primary {
  background: var(--btn-primary-bg, #3b82f6);
  color: var(--btn-primary-fg, #fff);
}
.featureToggleBtn.warnOutline {
  background: #fff;
  color: #b91c1c;
  border-color: rgba(239, 68, 68, 0.35);
}
.featureToggleBtn.warnOutline:hover {
  background: rgba(239, 68, 68, 0.08);
  border-color: rgba(239, 68, 68, 0.6);
}
.confirmModalOverlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10050;
}
.confirmModalCard {
  background: var(--color-bg-card, #fff);
  padding: 18px 20px;
  border-radius: 12px;
  border: 1px solid var(--line-light, #e2e8f0);
  max-width: 360px;
  width: 90%;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.2);
  text-align: left;
}
.confirmModalTitle {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-default, #0f172a);
}
.confirmModalText {
  margin: 0 0 16px;
  font-size: 13px;
  line-height: 1.45;
  color: var(--color-mono30, #475569);
}
.confirmModalActions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.cancelConfirmBtn {
  background: #f8fafc;
  color: var(--color-text-default, #334155);
  border: 1px solid var(--line-light, #cbd5e1);
}
</style>
