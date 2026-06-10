import data from 'emoji-mart-vue-fast/data/all.json';
import { EmojiIndex } from 'emoji-mart-vue-fast/src';

let emojiIndex: EmojiIndex | null = null;

/** Shared emoji index (emoji-mart data); created on first use. */
export function getEmojiIndex(): EmojiIndex {
  if (!emojiIndex) emojiIndex = new EmojiIndex(data);
  return emojiIndex;
}

export type EmojiMartSelection = { native: string };

export function nativeFromEmojiMart(emoji: EmojiMartSelection): string {
  return emoji.native;
}
