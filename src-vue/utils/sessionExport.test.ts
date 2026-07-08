import { describe, expect, it, vi } from 'vitest';
import {
  blobMimeToExtension,
  canvasToPngBlob,
  downloadBlob,
  exportFileName,
  notesToMarkdown,
  renderWhiteboardToCanvas,
  safeSessionSlug,
  markdownToRtf,
} from './sessionExport';

describe('safeSessionSlug', () => {
  it('lowercases and strips unsafe characters', () => {
    expect(safeSessionSlug('Team Stand-up!')).toBe('team-stand-up');
  });
  it('falls back to "session" when empty', () => {
    expect(safeSessionSlug('')).toBe('session');
    expect(safeSessionSlug(undefined)).toBe('session');
  });
});

describe('exportFileName', () => {
  const now = new Date(2026, 4, 31, 23, 10);
  it('builds a timestamped name per kind', () => {
    expect(exportFileName('notes', 'Daily', now)).toBe('loungemesh-daily-20260531-2310.md');
    expect(exportFileName('whiteboard', 'Daily', now)).toBe('loungemesh-daily-20260531-2310.png');
    expect(exportFileName('recording', 'Daily', now)).toBe('loungemesh-daily-20260531-2310.mp4');
  });
  it('uses extensionOverride when provided', () => {
    expect(exportFileName('recording', 'Daily', now, 'mp4')).toBe('loungemesh-daily-20260531-2310.mp4');
    expect(exportFileName('recording', 'Daily', now, 'webm')).toBe('loungemesh-daily-20260531-2310.webm');
  });
});

describe('blobMimeToExtension', () => {
  it('maps video/mp4 to mp4', () => {
    expect(blobMimeToExtension('video/mp4')).toBe('mp4');
    expect(blobMimeToExtension('video/mp4;codecs=h264,aac')).toBe('mp4');
  });
  it('maps video/webm to webm', () => {
    expect(blobMimeToExtension('video/webm')).toBe('webm');
    expect(blobMimeToExtension('video/webm;codecs=vp9,opus')).toBe('webm');
  });
  it('maps video/ogg to ogv', () => {
    expect(blobMimeToExtension('video/ogg')).toBe('ogv');
  });
  it('falls back to extracting the subtype for unknown types', () => {
    expect(blobMimeToExtension('video/x-matroska')).toBe('x-matroska');
  });
  it('falls back to webm for a type with no slash', () => {
    expect(blobMimeToExtension('unknown')).toBe('webm');
  });
});

describe('notesToMarkdown', () => {
  const now = new Date('2026-05-31T17:40:00.000Z');
  it('includes a heading, timestamp and the notes body', () => {
    const md = notesToMarkdown('  hello world  ', 'room', now);
    expect(md).toContain('# LoungeMesh public notes — room');
    expect(md).toContain('2026-05-31T17:40:00.000Z');
    expect(md).toContain('hello world');
  });
  it('uses a placeholder when notes are empty', () => {
    expect(notesToMarkdown('   ', 'room', now)).toContain('No notes were taken');
  });
});

describe('renderWhiteboardToCanvas', () => {
  it('produces a canvas of the requested size', () => {
    const canvas = renderWhiteboardToCanvas(
      [{ id: 'a', color: '#000', width: 2, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }],
      100,
      80,
    );
    expect(canvas.width).toBe(100);
    expect(canvas.height).toBe(80);
  });
});

describe('canvasToPngBlob', () => {
  it('resolves null when toBlob is unavailable', async () => {
    const canvas = { } as HTMLCanvasElement;
    await expect(canvasToPngBlob(canvas)).resolves.toBeNull();
  });
  it('resolves the produced blob', async () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    const canvas = { toBlob: (cb: (b: Blob | null) => void) => cb(blob) } as unknown as HTMLCanvasElement;
    await expect(canvasToPngBlob(canvas)).resolves.toBe(blob);
  });
});

describe('downloadBlob', () => {
  it('creates an object URL and clicks a download anchor', () => {
    vi.useFakeTimers();
    const createURL = vi.fn(() => 'blob:fake');
    const revokeURL = vi.fn();
    (globalThis.URL as unknown as { createObjectURL: unknown }).createObjectURL = createURL;
    (globalThis.URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = revokeURL;
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadBlob(new Blob(['data']), 'file.md');

    expect(createURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeURL).toHaveBeenCalledWith('blob:fake');
    click.mockRestore();
    vi.useRealTimers();
  });
});

describe('markdownToRtf', () => {
  it('converts markdown formatting to RTF syntax successfully', () => {
    const md = `# Heading 1
## Heading 2
### Heading 3
***bold italic***
**bold**
*italic*
- item

regular text after empty line
* item2
\`code\`
[Google](https://google.com)
> quote
> quote line 2
normal text after quote
---
\`\`\`
js code
\`\`\`
> quote at end`;
    const rtf = markdownToRtf(md, 'Title');
    expect(rtf).toContain('\\rtf1');
    expect(rtf).toContain('Title');
    expect(rtf).toContain('\\fs36\\b Heading 1');
    expect(rtf).toContain('\\fs30\\b Heading 2');
    expect(rtf).toContain('\\fs26\\b Heading 3');
    expect(rtf).toContain('\\b\\i bold italic');
    expect(rtf).toContain('\\b bold');
    expect(rtf).toContain('\\i italic');
    expect(rtf).toContain('\\bullet  item');
    expect(rtf).toContain('regular text after empty line');
    expect(rtf).toContain('\\bullet  item2');
    expect(rtf).toContain('{\\f1 code}');
    expect(rtf).toContain('HYPERLINK "https://google.com"');
    expect(rtf).toContain('Google');
    expect(rtf).toContain('{\\i quote');
    expect(rtf).toContain('quote line 2');
    expect(rtf).toContain('normal text after quote');
    expect(rtf).toContain('--------------------------------------------------');
    expect(rtf).toContain('{\\f1 js code}');
    expect(rtf).toContain('quote at end');
  });

  it('handles indented nested list levels in RTF correctly', () => {
    const md = `- item\n  - nested item`;
    const rtf = markdownToRtf(md, 'Title');
    expect(rtf).toContain('\\bullet  item');
    expect(rtf).toContain('\\tab \\bullet  nested item');
  });
});
