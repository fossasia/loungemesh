import { describe, expect, it, vi } from 'vitest';
import {
  broadcastSharedNotes,
  buildNotesCommands,
  decodeNotesFromWire,
  encodeNotesForWire,
  NOTES_CHUNK_SIZE,
} from './notesSync';

describe('notesSync', () => {
  it('round-trips markdown with xml-sensitive characters', () => {
    const markdown = '# Title\n\n[link](https://a.com?x=1&y=2)\n\n<code> & more';
    expect(decodeNotesFromWire(encodeNotesForWire(markdown))).toBe(markdown);
  });

  it('keeps URL colons out of chunk wire payloads', () => {
    const commands = buildNotesCommands('# [x](http://example.com/path)');
    const chunk = commands.find((command) => command.action === 'chunk');
    expect(chunk?.data).not.toMatch(/https?:/);
    expect(chunk?.data).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  it('builds chunked commands for large notes', () => {
    const text = 'x'.repeat(NOTES_CHUNK_SIZE + 5);
    const commands = buildNotesCommands(text);
    expect(commands[0]).toEqual({ action: 'begin', total: 2 });
    expect(commands[1]?.action).toBe('chunk');
    expect(buildNotesCommands('')).toEqual([{ action: 'clear' }]);
  });

  it('broadcasts chunked notes commands', () => {
    const engine = { sendCommand: vi.fn() };
    broadcastSharedNotes(engine as never, '# Hello');
    expect(engine.sendCommand).toHaveBeenCalledWith(
      'notes',
      JSON.stringify({ action: 'begin', total: 1 }),
    );
    expect(engine.sendCommand).toHaveBeenCalledWith(
      'notes',
      expect.stringContaining('"action":"chunk"'),
    );
  });
});
