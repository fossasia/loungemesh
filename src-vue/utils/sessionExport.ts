import type { WhiteboardStroke } from '@/utils/whiteboardSync';
import { renderWhiteboard } from '@/utils/whiteboardCanvas';

export type ExportKind = 'notes' | 'notes-rtf' | 'whiteboard' | 'recording';

/** Derive a clean file extension from a MediaRecorder blob MIME type. */
export function blobMimeToExtension(mimeType: string): string {
  const base = mimeType.split(';')[0].trim().toLowerCase();
  if (base === 'video/mp4') return 'mp4';
  if (base === 'video/webm') return 'webm';
  if (base === 'video/ogg') return 'ogv';
  // Fallback: use whatever comes after the slash
  const slash = base.lastIndexOf('/');
  return slash >= 0 ? base.slice(slash + 1) : 'webm';
}

const EXTENSIONS: Record<ExportKind, string> = {
  notes: 'md',
  'notes-rtf': 'rtf',
  whiteboard: 'png',
  recording: 'mp4',
};

/** Sanitise a session id so it is safe to use inside a file name. */
export function safeSessionSlug(sessionId: string | undefined): string {
  const slug = (sessionId ?? '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'session';
}

/** Build a timestamped export file name, e.g. `loungemesh-standup-20260531-2310.mp4`.
 * Pass `extensionOverride` to use a different extension than the kind default (e.g. derived from blob MIME).
 */
export function exportFileName(
  kind: ExportKind,
  sessionId: string | undefined,
  now: Date = new Date(),
  extensionOverride?: string,
): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}`;
  const ext = extensionOverride ?? EXTENSIONS[kind];
  return `loungemesh-${safeSessionSlug(sessionId)}-${stamp}.${ext}`;
}

/** Render shared notes as a small Markdown document. */
export function notesToMarkdown(notes: string, sessionId: string | undefined, now: Date = new Date()): string {
  const heading = `# LoungeMesh public notes — ${safeSessionSlug(sessionId)}`;
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

/** Convert a Markdown document into valid RTF format to preserve rich text formatting. */
export function markdownToRtf(md: string, title: string): string {
  const body = md
    .replace(/\\/g, '\\\\')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/\*\*\*(.*?)\*\*\*/g, '\\b\\i $1\\i0\\b0')
    .replace(/\*\*(.*?)\*\*/g, '\\b $1\\b0')
    .replace(/\*(.*?)\*/g, '\\i $1\\i0')
    .replace(/__(.*?)__/g, '\\b $1\\b0')
    .replace(/_(.*?)_/g, '\\i $1\\i0')
    .replace(/^# (.*?)$/gm, '\\line\\fs36\\b $1\\b0\\fs24\\line')
    .replace(/^## (.*?)$/gm, '\\line\\fs30\\b $1\\b0\\fs24\\line')
    .replace(/^### (.*?)$/gm, '\\line\\fs26\\b $1\\b0\\fs24\\line')
    .replace(/^- (.*?)$/gm, '\\bullet  $1\\line')
    .replace(/^\* (.*?)$/gm, '\\bullet  $1\\line')
    .replace(/`(.*?)`/g, '{\\f1 $1}')
    .replace(/\[(.*?)\]\((.*?)\)/g, '{\\field{\\*\\fldinst{HYPERLINK "$2"}}{\\fldrslt{\\ul $1}}}')
    .replace(/\n/g, '\\par\n');

  return `{\\rtf1\\ansi\\deff0
{\\fonttbl{\\f0\\fnil\\fcharset0 Helvetica;}{\\f1\\fmodern\\fcharset0 Courier;}}
{\\colortbl ;\\red0\\green0\\blue255;}
\\viewkind4\\uc1
\\f0\\fs24
\\b\\fs40 ${title}\\b0\\par
\\line
${body}
}`;
}
