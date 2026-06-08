import { describe, expect, it } from 'vitest';
import { ensureRecordingMp4, isMp4RecordingBlob } from './recordingToMp4';

function mp4HeaderBlob(): Blob {
  const bytes = new Uint8Array([
    0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
  ]);
  return new Blob([bytes], { type: 'video/mp4' });
}

function webmHeaderBlob(): Blob {
  const bytes = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00]);
  return new Blob([bytes], { type: 'video/webm' });
}

describe('isMp4RecordingBlob', () => {
  it('detects mp4 from file signature even when MIME is wrong', async () => {
    const blob = mp4HeaderBlob();
    await expect(isMp4RecordingBlob(blob)).resolves.toBe(true);
  });

  it('detects webm from file signature even when MIME says mp4', async () => {
    const blob = new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x01])], { type: 'video/mp4' });
    await expect(isMp4RecordingBlob(blob)).resolves.toBe(false);
  });

  it('falls back to MIME when signature is unknown', async () => {
    await expect(isMp4RecordingBlob(new Blob(['x'], { type: 'video/mp4' }))).resolves.toBe(true);
    await expect(isMp4RecordingBlob(new Blob(['x'], { type: 'video/webm' }))).resolves.toBe(false);
  });
});

describe('ensureRecordingMp4', () => {
  it('returns mp4 blobs unchanged', async () => {
    const blob = mp4HeaderBlob();
    const result = await ensureRecordingMp4(blob);
    expect(result.type).toBe('video/mp4');
    expect(await result.arrayBuffer()).toEqual(await blob.arrayBuffer());
  });

  it('rejects empty recordings', async () => {
    await expect(ensureRecordingMp4(new Blob())).rejects.toThrow('Recording is empty');
  });
});
