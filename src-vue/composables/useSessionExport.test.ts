import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const { downloadBlob, canvasToPngBlob } = vi.hoisted(() => ({
  downloadBlob: vi.fn(),
  canvasToPngBlob: vi.fn(),
}));

vi.mock('@/utils/sessionExport', () => ({
  notesToMarkdown: vi.fn(() => 'MD'),
  exportFileName: vi.fn(() => 'file.ext'),
  renderWhiteboardToCanvas: vi.fn(() => ({}) as HTMLCanvasElement),
  canvasToPngBlob,
  downloadBlob,
}));

import { useSessionExport } from './useSessionExport';

describe('useSessionExport', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    downloadBlob.mockClear();
    canvasToPngBlob.mockReset();
  });

  it('exports notes as a markdown download', () => {
    useSessionExport(() => 'room').exportNotes();
    expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'file.ext');
  });

  it('exports the whiteboard when a PNG blob is produced', async () => {
    canvasToPngBlob.mockResolvedValue(new Blob(['p']));
    await useSessionExport(() => 'room').exportWhiteboard();
    expect(downloadBlob).toHaveBeenCalled();
  });

  it('skips the whiteboard download when no blob is produced', async () => {
    canvasToPngBlob.mockResolvedValue(null);
    await useSessionExport(() => 'room').exportWhiteboard();
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('exports a recording blob', () => {
    const blob = new Blob(['v']);
    useSessionExport(() => 'room').exportRecording(blob);
    expect(downloadBlob).toHaveBeenCalledWith(blob, 'file.ext');
  });
});
