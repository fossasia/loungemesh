<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { Picker } from 'emoji-mart-vue-fast/src';
import 'emoji-mart-vue-fast/css/emoji-mart.css';
import { getEmojiIndex, nativeFromEmojiMart, type EmojiMartSelection } from '@/utils/emojiMart';
import { perLineForWidth } from '@/utils/emojiPickerLayout';

const props = withDefaults(
  defineProps<{
    emojiSize?: number;
    minPerLine?: number;
    maxPerLine?: number;
    showPreview?: boolean;
    showSkinTones?: boolean;
    /** Popover/dock uses a shorter grid; inline/chat can be taller. */
    layout?: 'inline' | 'popover';
  }>(),
  {
    emojiSize: 24,
    minPerLine: 6,
    maxPerLine: 11,
    showPreview: false,
    showSkinTones: true,
    layout: 'inline',
  },
);

const emit = defineEmits<{
  select: [emoji: string];
}>();

const emojiIndex = getEmojiIndex();
const root = ref<HTMLElement | null>(null);
const perLine = ref(9);

function syncPerLine(width: number) {
  perLine.value = perLineForWidth(width, props.emojiSize, props.minPerLine, props.maxPerLine);
}

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  const el = root.value as HTMLElement;
  syncPerLine(el.clientWidth);
  resizeObserver = new ResizeObserver((entries) => {
    const width = entries[0]?.contentRect.width || el.clientWidth;
    syncPerLine(width);
  });
  resizeObserver.observe(el);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
});

function onSelect(emoji: EmojiMartSelection) {
  emit('select', nativeFromEmojiMart(emoji));
}
</script>

<template>
  <div ref="root" class="loungeEmojiPicker" :class="`layout-${layout}`">
    <Picker
      :data="emojiIndex"
      native
      :per-line="perLine"
      :emoji-size="emojiSize"
      :show-preview="showPreview"
      :show-skin-tones="showSkinTones"
      title="Pick an emoji"
      :picker-styles="{ width: '100%', maxWidth: '100%' }"
      @select="onSelect"
    />
  </div>
</template>

<style scoped>
.loungeEmojiPicker {
  width: 100%;
  min-width: 0;
}
.loungeEmojiPicker :deep(.emoji-mart) {
  border: none;
  border-radius: var(--radius-sm);
  font-family: var(--font-body);
  box-shadow: none;
  width: 100% !important;
  max-width: 100%;
  height: auto;
  max-height: none;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.loungeEmojiPicker.layout-inline :deep(.emoji-mart) {
  max-height: min(380px, 52vh);
}
.loungeEmojiPicker.layout-popover :deep(.emoji-mart) {
  max-height: min(340px, 48vh);
}
.loungeEmojiPicker :deep(.emoji-mart-bar) {
  border-color: var(--line-light);
  flex-shrink: 0;
}
.loungeEmojiPicker :deep(.emoji-mart-bar-anchors) {
  overflow: visible;
}
.loungeEmojiPicker :deep(.emoji-mart-anchors) {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  justify-content: flex-start;
  gap: 2px;
  padding: 0 4px;
  overflow-x: auto;
  overflow-y: visible;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
}
.loungeEmojiPicker :deep(.emoji-mart-anchor) {
  flex: 0 0 32px;
  overflow: visible;
  padding: 8px 0;
}
.loungeEmojiPicker :deep(.emoji-mart-anchors i) {
  width: 22px;
  max-width: 22px;
}
.loungeEmojiPicker :deep(.emoji-mart-anchors svg) {
  max-height: 20px;
  width: 20px;
}
.loungeEmojiPicker :deep(.emoji-mart-search) {
  flex-shrink: 0;
  margin-top: 4px;
}
.loungeEmojiPicker :deep(.emoji-mart-search input) {
  font-family: var(--font-body);
  font-size: var(--fs-small);
}
.loungeEmojiPicker :deep(.emoji-mart-scroll) {
  flex: 1 1 auto;
  min-height: 140px;
  height: auto !important;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
.loungeEmojiPicker.layout-inline :deep(.emoji-mart-scroll) {
  max-height: min(280px, 42vh);
}
.loungeEmojiPicker.layout-popover :deep(.emoji-mart-scroll) {
  max-height: min(240px, 38vh);
}
.loungeEmojiPicker :deep(.emoji-mart-category-label span) {
  font-size: var(--fs-small);
  color: var(--color-mono30);
}
.loungeEmojiPicker :deep(.emoji-mart-emoji) {
  overflow: visible;
}
</style>
