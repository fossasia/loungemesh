import { describe, expect, it, vi } from 'vitest';
import {
  canvasToPngBlob,
  downloadBlob,
  exportFileName,
  notesToMarkdown,
  renderWhiteboardToCanvas,
  safeSessionSlug,
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
    expect(exportFileName('notes', 'Daily', now)).toBe('flowspace-daily-20260531-2310.md');
    expect(exportFileName('whiteboard', 'Daily', now)).toBe('flowspace-daily-20260531-2310.png');
    expect(exportFileName('recording', 'Daily', now)).toBe('flowspace-daily-20260531-2310.webm');
  });
});

describe('notesToMarkdown', () => {
  const now = new Date('2026-05-31T17:40:00.000Z');
  it('includes a heading, timestamp and the notes body', () => {
    const md = notesToMarkdown('  hello world  ', 'room', now);
    expect(md).toContain('# Flowspace notes — room');
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
