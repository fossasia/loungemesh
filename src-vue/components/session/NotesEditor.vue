<script setup lang="ts">
import { EditorContent } from '@tiptap/vue-3';
import { toRef } from 'vue';
import { useNotesEditor } from '@/composables/useNotesEditor';

const model = defineModel<string>({ default: '' });

const props = withDefaults(
  defineProps<{
    readonly?: boolean;
    placeholder?: string;
  }>(),
  {
    readonly: false,
    placeholder: 'Collaborative notes — visible to everyone in the call',
  },
);

const emit = defineEmits<{
  blur: [];
}>();

const { editor, toolbarGroups } = useNotesEditor({
  model,
  readonly: toRef(props, 'readonly'),
  placeholder: props.placeholder,
  onBlur: () => emit('blur'),
});
</script>

<template>
  <div class="notesEditor" :class="{ readonly }">
    <div v-if="!readonly" class="notesToolbar" role="toolbar" aria-label="Notes formatting">
      <div v-for="(group, groupIndex) in toolbarGroups" :key="groupIndex" class="notesToolGroup">
        <button
          v-for="action in group"
          :key="action.title"
          type="button"
          class="notesToolBtn"
          :class="{ active: action.active?.() }"
          :title="action.title"
          :aria-label="action.title"
          :disabled="action.disabled?.()"
          @mousedown.prevent
          @click="action.run()"
        >
          <component :is="action.icon" class="notesToolIcon" aria-hidden="true" />
        </button>
      </div>
    </div>
    <EditorContent :editor="editor" class="notesEditorSurface" />
  </div>
</template>

<style scoped>
.notesEditor {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
  border: 1px solid var(--line-dark);
  border-radius: var(--radius-sm);
  background: #fff;
  overflow: hidden;
  direction: ltr;
  text-align: left;
}

.notesEditor.readonly {
  background: var(--color-bg-card);
}

.notesToolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--line-light);
  background: var(--color-bg-card);
}

.notesToolGroup {
  display: flex;
  gap: 2px;
  padding-right: 6px;
  margin-right: 6px;
  border-right: 1px solid var(--line-light);
}

.notesToolGroup:last-child {
  border-right: none;
  margin-right: 0;
  padding-right: 0;
}

.notesToolBtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-default);
  cursor: pointer;
}

.notesToolIcon {
  width: 17px;
  height: 17px;
}

.notesToolBtn:hover:not(:disabled) {
  background: var(--color-mono95);
  border-color: var(--line-light);
}

.notesToolBtn.active {
  background: var(--color-mono95);
  border-color: var(--color-blue100);
  color: var(--color-blue100);
}

.notesToolBtn:disabled {
  opacity: 0.4;
  cursor: default;
}

.notesEditorSurface {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  overflow-wrap: anywhere;
}

.notesEditorSurface :deep(.tiptap) {
  min-height: 100%;
  padding: 10px;
  outline: none;
  font-family: var(--font-body);
  font-size: var(--fs-body);
  line-height: 1.5;
  color: var(--color-text-default);
  direction: ltr;
  text-align: left;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.notesEditorSurface :deep(.tiptap p) {
  margin: 0 0 0.6em;
}

.notesEditorSurface :deep(.tiptap p:last-child) {
  margin-bottom: 0;
}

.notesEditorSurface :deep(.tiptap h2),
.notesEditorSurface :deep(.tiptap h3) {
  margin: 0.8em 0 0.4em;
  line-height: 1.25;
  font-weight: var(--fw-medium);
}

.notesEditorSurface :deep(.tiptap h2) {
  font-size: 1.15rem;
}

.notesEditorSurface :deep(.tiptap h3) {
  font-size: 1rem;
}

.notesEditorSurface :deep(.tiptap ul),
.notesEditorSurface :deep(.tiptap ol) {
  margin: 0 0 0.6em;
  padding-left: 1.4em;
}

.notesEditorSurface :deep(.tiptap blockquote) {
  margin: 0 0 0.6em;
  padding-left: 0.8em;
  border-left: 3px solid var(--line-dark);
  color: var(--color-mono30);
}

.notesEditorSurface :deep(.tiptap code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.9em;
  background: var(--color-mono95);
  padding: 0.1em 0.25em;
  border-radius: 3px;
}

.notesEditorSurface :deep(.tiptap p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  color: var(--color-mono40);
  pointer-events: none;
  height: 0;
}
</style>
