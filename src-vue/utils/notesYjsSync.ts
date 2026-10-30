import * as Y from 'yjs';

const NOTES_CHUNK_SIZE = 8000;

export function notesDocumentHasContent(ydoc: Y.Doc): boolean {
  return ydoc.getXmlFragment('default').length > 0;
}

/** Replace the shared notes document with plain paragraphs from markdown. */
export function seedNotesDocument(ydoc: Y.Doc, markdown: string): void {
  const fragment = ydoc.getXmlFragment('default');
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const paragraphs = lines.map((line) => {
    const paragraph = new Y.XmlElement('paragraph');
    if (line) {
      const text = new Y.XmlText();
      text.insert(0, line);
      paragraph.insert(0, [text]);
    }
    return paragraph;
  });
  ydoc.transact(() => {
    if (fragment.length) fragment.delete(0, fragment.length);
    fragment.insert(0, paragraphs);
  }, 'remote');
}

export function broadcastYjsState(
  engine: { sendCommand: (name: string, value: string) => void },
  ydoc: Y.Doc,
): void {
  const state = Y.encodeStateAsUpdate(ydoc);
  const base64 = btoa(String.fromCharCode(...state));
  const total = Math.max(1, Math.ceil(base64.length / NOTES_CHUNK_SIZE));
  engine.sendCommand('notes', JSON.stringify({ action: 'yjs_begin', total }));
  for (let index = 0, offset = 0; index < total; index += 1, offset += NOTES_CHUNK_SIZE) {
    engine.sendCommand('notes', JSON.stringify({
      action: 'yjs_chunk',
      index,
      data: base64.slice(offset, offset + NOTES_CHUNK_SIZE),
    }));
  }
}
