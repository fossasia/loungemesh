import type { MediaService } from '@/services/MediaService';

/** Safe XMPP payload size — markdown notes must be split to avoid XML parse errors. */
export const NOTES_CHUNK_SIZE = 2400;

export type NotesCommand =
  | { action: 'clear' }
  | { action: 'begin'; total: number }
  | { action: 'chunk'; index: number; data: string };

/** Base64 UTF-8 keeps markdown symbols out of raw XMPP payloads. */
export function encodeNotesForWire(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export function decodeNotesFromWire(encoded: string): string {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function buildNotesCommands(text: string): NotesCommand[] {
  if (!text) return [{ action: 'clear' }];
  const encoded = encodeNotesForWire(text);
  const total = Math.ceil(encoded.length / NOTES_CHUNK_SIZE);
  const commands: NotesCommand[] = [{ action: 'begin', total }];
  for (
    let index = 0, offset = 0;
    offset < encoded.length;
    index += 1, offset += NOTES_CHUNK_SIZE
  ) {
    commands.push({
      action: 'chunk',
      index,
      data: encoded.slice(offset, offset + NOTES_CHUNK_SIZE),
    });
  }
  return commands;
}

export function broadcastSharedNotes(engine: MediaService, text: string): void {
  for (const command of buildNotesCommands(text)) {
    engine.sendCommand('notes', JSON.stringify(command));
  }
}
