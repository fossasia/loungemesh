import { describe, expect, it, vi } from 'vitest';
import { loadEmojiPickerPanel } from './loadEmojiPickerPanel';

vi.mock('emoji-mart-vue-fast/src', () => ({
  Picker: { name: 'Picker', template: '<div />' },
  EmojiIndex: class MockEmojiIndex {},
}));

vi.mock('emoji-mart-vue-fast/css/emoji-mart.css', () => ({}));

describe('loadEmojiPickerPanel', () => {
  it('resolves the emoji picker module', async () => {
    const mod = await loadEmojiPickerPanel();
    expect(mod.default).toBeTruthy();
  });
});
