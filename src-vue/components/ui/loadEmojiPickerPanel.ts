/** Lazy-load emoji picker (defers large emoji-mart data bundle). */
export function loadEmojiPickerPanel() {
  return import('@/components/ui/EmojiPickerPanel.vue');
}
