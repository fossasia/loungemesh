import type { WhiteboardStroke } from '@/utils/whiteboardSync';
import { renderWhiteboard } from '@/utils/whiteboardCanvas';

export type ExportKind = 'notes' | 'whiteboard' | 'recording';

const EXTENSIONS: Record<ExportKind, string> = {
  notes: 'md',
  whiteboard: 'png',
  recording: 'webm',
};

/** Sanitise a session id so it is safe to use inside a file name. */
export function safeSessionSlug(sessionId: string | undefined): string {
  const slug = (sessionId ?? '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'session';
}

/** Build a timestamped export file name, e.g. `loungemesh-standup-20260531-2310.md`. */
export function exportFileName(
  kind: ExportKind,
  sessionId: string | undefined,
  now: Date = new Date(),
): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `loungemesh-${safeSessionSlug(sessionId)}-${stamp}.${EXTENSIONS[kind]}`;
}

/** Render shared notes as a small Markdown document. */
export function notesToMarkdown(notes: string, sessionId: string | undefined, now: Date = new Date()): string {
  const heading = `# LoungeMesh notes — ${safeSessionSlug(sessionId)}`;
  const when = `_Exported ${now.toISOString()}_`;
  const body = notes.trim().length ? notes.trim() : '_No notes were taken in this session._';
  return `${heading}\n\n${when}\n\n${body}\n`;
}

/** Render the whiteboard strokes onto an offscreen canvas (white background). */
export function renderWhiteboardToCanvas(
  strokes: WhiteboardStroke[],
  width = 1280,
  height = 720,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  renderWhiteboard(canvas, strokes, null, { width, height });
  return canvas;
}

/** Promisified canvas.toBlob. */
export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (typeof canvas.toBlob !== 'function') {
      resolve(null);
      return;
    }
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

/** Trigger a browser download for a blob via a temporary object URL. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke on the next tick so the download has a chance to start first.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
