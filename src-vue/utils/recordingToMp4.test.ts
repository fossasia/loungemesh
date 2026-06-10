import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ensureRecordingMp4, isMp4RecordingBlob } from './recordingToMp4';

let mediabunnyValid = true;
let mediabunnyBuffer: Uint8Array | undefined = new Uint8Array([1, 2, 3]);
let ffmpegExitCode = 0;
let ffmpegReadFileResult: any = new Uint8Array([4, 5, 6]);

vi.mock('mediabunny', () => {
  class MockInput {
    constructor(public config: any) {}
  }
  class MockOutput {
    config: any;
    target: { buffer?: Uint8Array };
    constructor(config: any) {
      this.config = config;
      this.target = config.target;
    }
  }
  return {
    Input: MockInput,
    Output: MockOutput,
    ALL_FORMATS: [],
    BlobSource: class {},
    Mp4OutputFormat: class {},
    BufferTarget: class {
      buffer?: Uint8Array;
    },
    Conversion: {
      init: vi.fn().mockImplementation(async (config: any) => {
        return {
          isValid: mediabunnyValid,
          execute: async () => {
            config.output.target.buffer = mediabunnyBuffer;
          },
        };
      }),
    },
  };
});

vi.mock('@ffmpeg/ffmpeg', () => {
  class MockFFmpeg {
    load = vi.fn().mockResolvedValue(undefined);
    writeFile = vi.fn().mockResolvedValue(undefined);
    exec = vi.fn().mockImplementation(async () => ffmpegExitCode);
    readFile = vi.fn().mockImplementation(async () => ffmpegReadFileResult);
  }
  return {
    FFmpeg: MockFFmpeg,
  };
});

vi.mock('@ffmpeg/util', () => {
  return {
    toBlobURL: vi.fn().mockResolvedValue('blob:url'),
    fetchFile: vi.fn().mockResolvedValue(new Uint8Array([7, 8, 9])),
  };
});

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

  it('handles signature with length >= 8 but not ftyp brand', async () => {
    const blob = new Blob(['abcdefgh'], { type: 'video/mp4' });
    await expect(isMp4RecordingBlob(blob)).resolves.toBe(true);
  });
});

describe('ensureRecordingMp4', () => {
  beforeEach(() => {
    mediabunnyValid = true;
    mediabunnyBuffer = new Uint8Array([1, 2, 3]);
    ffmpegExitCode = 0;
    ffmpegReadFileResult = new Uint8Array([4, 5, 6]);
  });

  it('returns mp4 blobs unchanged', async () => {
    const blob = mp4HeaderBlob();
    const result = await ensureRecordingMp4(blob);
    expect(result.type).toBe('video/mp4');
    expect(await result.arrayBuffer()).toEqual(await blob.arrayBuffer());
  });

  it('rejects empty recordings', async () => {
    await expect(ensureRecordingMp4(new Blob())).rejects.toThrow('Recording is empty');
  });

  it('transcodes WebM to MP4 using mediabunny successfully', async () => {
    const blob = webmHeaderBlob();
    const result = await ensureRecordingMp4(blob);
    expect(result.type).toBe('video/mp4');
    const buf = await result.arrayBuffer();
    expect(new Uint8Array(buf)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('falls back to ffmpeg when mediabunny validation fails', async () => {
    mediabunnyValid = false;
    const blob = webmHeaderBlob();
    const result = await ensureRecordingMp4(blob);
    expect(result.type).toBe('video/mp4');
    const buf = await result.arrayBuffer();
    expect(new Uint8Array(buf)).toEqual(new Uint8Array([4, 5, 6]));
  });

  it('falls back to ffmpeg when mediabunny execution returns no data', async () => {
    mediabunnyBuffer = undefined; // empty buffer
    const blob = webmHeaderBlob();
    const result = await ensureRecordingMp4(blob);
    expect(result.type).toBe('video/mp4');
    const buf = await result.arrayBuffer();
    expect(new Uint8Array(buf)).toEqual(new Uint8Array([4, 5, 6]));
  });

  it('handles non-Uint8Array file read in ffmpeg', async () => {
    mediabunnyValid = false;
    ffmpegReadFileResult = 'string-fallback-data';
    const blob = webmHeaderBlob();
    const result = await ensureRecordingMp4(blob);
    expect(result.type).toBe('video/mp4');
    const text = await result.text();
    expect(text).toBe('string-fallback-data');
  });

  it('throws error when both mediabunny and ffmpeg fail', async () => {
    mediabunnyValid = false;
    ffmpegExitCode = 127;
    const blob = webmHeaderBlob();
    await expect(ensureRecordingMp4(blob)).rejects.toThrow(
      'FFmpeg transcode failed with exit code 127',
    );
  });
});
