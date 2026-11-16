import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { broadcastYjsState, notesDocumentHasContent, seedNotesDocument } from './notesYjsSync';

describe('notesYjsSync', () => {
  it('seeds paragraphs and reports whether the document has content', () => {
    const ydoc = new Y.Doc();
    expect(notesDocumentHasContent(ydoc)).toBe(false);
    seedNotesDocument(ydoc, 'Hello\r\n\nWorld');
    expect(notesDocumentHasContent(ydoc)).toBe(true);
    const fragment = ydoc.getXmlFragment('default');
    expect(fragment.length).toBe(3);
    expect(fragment.get(0).toString()).toContain('Hello');
  });

  it('broadcasts the document as chunked yjs commands', () => {
    const ydoc = new Y.Doc();
    seedNotesDocument(ydoc, 'Agenda');
    const sendCommand = vi.fn();
    broadcastYjsState({ sendCommand }, ydoc);
    expect(sendCommand).toHaveBeenCalledWith('notes', expect.stringContaining('"action":"yjs_begin"'));
    expect(sendCommand).toHaveBeenCalledWith('notes', expect.stringContaining('"action":"yjs_chunk"'));
  });
});
