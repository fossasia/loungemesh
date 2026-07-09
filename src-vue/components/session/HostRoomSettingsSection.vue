<script setup lang="ts">
import { ref } from 'vue';
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
import { broadcastSharedNotes } from '@/utils/notesSync';

const features = useSessionFeaturesStore();
const { engine } = useMediaEngine();

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
    if (!features.sharedNotes.trim()) {
      features.sharedNotes = text;
      broadcastSharedNotes(engine, text);
    }
  } catch (e) {
    templateError.value =
      e instanceof NotesTemplateError ? e.message : 'Could not read that template.';
  } finally {
    templateBusy.value = false;
  }
}

function clearTemplate() {
  templateError.value = '';
  features.clearNotesTemplate();
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
    <p v-if="features.notesTemplate" class="templateStatus">Template loaded — pre-fills notes when the session starts.</p>
    <p v-if="templateError" class="error">{{ templateError }}</p>
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
</style>
