type RecordingContainer = 'mp4' | 'webm' | 'unknown';

async function sniffContainer(blob: Blob): Promise<RecordingContainer> {
  const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  if (head.length >= 4 && head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) {
    return 'webm';
  }
  if (head.length >= 8) {
    const brand = String.fromCharCode(head[4], head[5], head[6], head[7]);
    if (brand === 'ftyp') return 'mp4';
  }
  return 'unknown';
}

/** True when the blob bytes are already an MP4 container (not just the MIME label). */
export async function isMp4RecordingBlob(blob: Blob): Promise<boolean> {
  const container = await sniffContainer(blob);
  if (container === 'mp4') return true;
  if (container === 'webm') return false;
  const base = blob.type.split(';')[0].trim().toLowerCase();
  return base === 'video/mp4';
}

async function transcodeWithMediabunny(blob: Blob): Promise<Blob> {
  const {
    Input,
    Output,
    Conversion,
    ALL_FORMATS,
    BlobSource,
    Mp4OutputFormat,
    BufferTarget,
  } = await import('mediabunny');

  const input = new Input({
    source: new BlobSource(blob),
    formats: ALL_FORMATS,
  });

  const output = new Output({
    format: new Mp4OutputFormat(),
    target: new BufferTarget(),
  });

  const conversion = await Conversion.init({
    input,
    output,
    video: { codec: 'avc' },
    audio: { codec: 'aac' },
  });

  if (!conversion.isValid) {
    throw new Error('Recording cannot be converted to MP4');
  }

  await conversion.execute();

  const buffer = output.target.buffer;
  if (!buffer) {
    throw new Error('MP4 conversion produced no data');
  }

  return new Blob([buffer], { type: 'video/mp4' });
}

const FFMPEG_CORE_VERSION = '0.12.10';

let ffmpegLoader: Promise<import('@ffmpeg/ffmpeg').FFmpeg> | undefined;

async function getFfmpeg(): Promise<import('@ffmpeg/ffmpeg').FFmpeg> {
  if (!ffmpegLoader) {
    ffmpegLoader = (async () => {
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const { toBlobURL } = await import('@ffmpeg/util');
      const ffmpeg = new FFmpeg();
      const base = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/esm`;
      await ffmpeg.load({
        coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      return ffmpeg;
    })();
  }
  return ffmpegLoader;
}

async function transcodeWithFfmpeg(blob: Blob): Promise<Blob> {
  const { fetchFile } = await import('@ffmpeg/util');
  const ffmpeg = await getFfmpeg();
  const inputName = 'input.webm';
  const outputName = 'output.mp4';

  await ffmpeg.writeFile(inputName, await fetchFile(blob));
  const exitCode = await ffmpeg.exec([
    '-i',
    inputName,
    '-c:v',
    'libx264',
    '-profile:v',
    'baseline',
    '-level',
    '3.0',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-movflags',
    '+faststart',
    outputName,
  ]);
  if (exitCode !== 0) {
    throw new Error(`FFmpeg transcode failed with exit code ${exitCode}`);
  }

  const data = await ffmpeg.readFile(outputName);
  const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
  return new Blob([new Uint8Array(bytes)], { type: 'video/mp4' });
}

/**
 * Ensure a session recording is MP4 with H.264 video and AAC-LC audio.
 * Returns the input unchanged when already MP4; otherwise transcodes in-browser.
 */
export async function ensureRecordingMp4(blob: Blob): Promise<Blob> {
  if (!blob.size) {
    throw new Error('Recording is empty');
  }
  if (await isMp4RecordingBlob(blob)) {
    return new Blob([await blob.arrayBuffer()], { type: 'video/mp4' });
  }

  try {
    return await transcodeWithMediabunny(blob);
  } catch (mediabunnyError) {
    console.warn('Mediabunny MP4 conversion failed, falling back to FFmpeg', mediabunnyError);
    return transcodeWithFfmpeg(blob);
  }
}
