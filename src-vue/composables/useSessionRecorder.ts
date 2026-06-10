import { ref, type Ref } from 'vue';

type MediaRecorderCtor = typeof MediaRecorder;

function getMediaRecorder(): MediaRecorderCtor | undefined {
  return (globalThis as { MediaRecorder?: MediaRecorderCtor }).MediaRecorder;
}

const MP4_RECORDER_TYPES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2', // H.264 Baseline + AAC-LC
  'video/mp4;codecs=avc1.640028,mp4a.40.2', // H.264 High + AAC-LC
  'video/mp4',
] as const;

const WEBM_RECORDER_TYPES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
] as const;

/** Safari records MP4 only; other browsers prefer WebM (more reliable for canvas capture). */
export function isSafariBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /safari/i.test(ua) && !/chrome|chromium|android|crios|fxios/i.test(ua);
}

export function recorderMimeCandidates(): string[] {
  return isSafariBrowser()
    ? [...MP4_RECORDER_TYPES]
    : [...WEBM_RECORDER_TYPES, ...MP4_RECORDER_TYPES];
}

/** Pick the first supported recording mime type, or undefined if none. */
export function pickRecorderMimeType(candidates?: string[]): string | undefined {
  const list = candidates ?? recorderMimeCandidates();
  const Recorder = getMediaRecorder();
  if (!Recorder?.isTypeSupported) return undefined;
  return list.find((type) => Recorder.isTypeSupported(type));
}

/** True when the browser can record canvas + audio to a Blob. */
export function isRecordingSupported(): boolean {
  return (
    !!getMediaRecorder() &&
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function'
  );
}

export type SessionRecorderSources = {
  getVideoSources: () => RecordingVideoSource[];
  /** Raw audio MediaStreamTracks (local mic + remote participants) to mix. */
  getAudioTracks: () => MediaStreamTrack[];
};

export type RecordingVideoSource = {
  element: HTMLVideoElement;
  participantId: string;
  displayName: string;
};

export type SessionRecorder = {
  isSupported: boolean;
  isRecording: Ref<boolean>;
  start: (quality?: '720p' | '480p') => boolean;
  stop: () => Promise<Blob | null>;
};

const FRAME_RATE = 24;
const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;

/**
 * Client-side session recorder: composites the on-screen video tiles onto a
 * canvas and mixes every audio track through Web Audio, then records both with
 * MediaRecorder. This needs no server component (Jibri); the host downloads the
 * resulting .mp4 locally. Returns a no-op recorder when unsupported.
 */
export function useSessionRecorder(sources: SessionRecorderSources): SessionRecorder {
  const isRecording = ref(false);
  const supported = isRecordingSupported();

  let recorder: MediaRecorder | undefined;
  let recordedMimeType: string | undefined;
  let chunks: Blob[] = [];
  let rafId: number | undefined;
  let audioContext: AudioContext | undefined;
  let audioDestination: MediaStreamAudioDestinationNode | undefined;
  const audioSources = new Map<MediaStreamTrack, MediaStreamAudioSourceNode>();
  let canvas: HTMLCanvasElement | undefined;

  function drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function drawVideoTile(
    ctx: CanvasRenderingContext2D,
    source: RecordingVideoSource,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    const labelHeight = 44;
    const videoHeight = Math.max(1, height - labelHeight);

    ctx.save();
    drawRoundedRect(ctx, x, y, width, height, 22);
    ctx.clip();
    ctx.fillStyle = '#111827';
    ctx.fillRect(x, y, width, height);

    try {
      const scale = Math.max(width / source.element.videoWidth, videoHeight / source.element.videoHeight);
      const drawW = source.element.videoWidth * scale;
      const drawH = source.element.videoHeight * scale;
      ctx.drawImage(
        source.element,
        x + (width - drawW) / 2,
        y + (videoHeight - drawH) / 2,
        drawW,
        drawH,
      );
    } catch {
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(x, y, width, videoHeight);
    }

    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.fillRect(x, y + videoHeight, width, labelHeight);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '600 22px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textBaseline = 'middle';
    const label = source.displayName || source.participantId;
    const maxLabelWidth = width - 32;
    let text = label;
    while (ctx.measureText(text).width > maxLabelWidth && text.length > 1) {
      text = `${text.slice(0, -2)}…`;
    }
    ctx.fillText(text, x + 16, y + videoHeight + labelHeight / 2);
    ctx.restore();
  }

  function refreshAudioMix() {
    if (!audioContext || !audioDestination) return;
    const liveTracks = new Set(
      sources
        .getAudioTracks()
        .filter((track) => track.kind === 'audio' && track.readyState !== 'ended' && track.enabled),
    );

    for (const [track, source] of audioSources) {
      if (liveTracks.has(track)) continue;
      try {
        source.disconnect();
      } catch {
        /* already disconnected */
      }
      audioSources.delete(track);
    }

    for (const track of liveTracks) {
      if (audioSources.has(track)) continue;
      try {
        const source = audioContext.createMediaStreamSource(new MediaStream([track]));
        source.connect(audioDestination);
        audioSources.set(track, source);
      } catch {
        /* track ended / not connectable — skip */
      }
    }
  }

  function paintFrame() {
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const videos = sources
      .getVideoSources()
      .filter((source) => source.element.videoWidth > 0 && source.element.videoHeight > 0);
    if (videos.length) {
      const cols = Math.ceil(Math.sqrt(videos.length));
      const rows = Math.ceil(videos.length / cols);
      const gap = 18;
      const cellW = (canvas.width - gap * (cols + 1)) / cols;
      const cellH = (canvas.height - gap * (rows + 1)) / rows;
      videos.forEach((source, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        drawVideoTile(ctx, source, gap + col * (cellW + gap), gap + row * (cellH + gap), cellW, cellH);
      });
    } else {
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '600 30px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Recording LoungeMesh session', canvas.width / 2, canvas.height / 2);
      ctx.textAlign = 'start';
    }
    refreshAudioMix();
    rafId = window.requestAnimationFrame(paintFrame);
  }

  function buildMixedStream(quality: '720p' | '480p'): MediaStream | null {
    canvas = document.createElement('canvas');
    if (quality === '480p') {
      canvas.width = 848;
      canvas.height = 480;
    } else {
      canvas.width = 1280;
      canvas.height = 720;
    }
    const captured = canvas.captureStream(FRAME_RATE);

    const Ctx = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) {
      audioContext = new Ctx();
      audioDestination = audioContext.createMediaStreamDestination();
      audioDestination.stream.getAudioTracks().forEach((t) => captured.addTrack(t));
      refreshAudioMix();
    }
    return captured;
  }

  function attachRecorder(active: MediaRecorder, mimeType: string | undefined) {
    recordedMimeType = mimeType ?? active.mimeType ?? undefined;
    chunks = [];
    active.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    active.start(1000);
    recorder = active;
  }

  function startRecorderOnStream(stream: MediaStream, mimeType: string | undefined): MediaRecorder | null {
    const Recorder = getMediaRecorder();
    if (!Recorder) return null;
    try {
      const active = new Recorder(stream, mimeType ? { mimeType } : undefined);
      attachRecorder(active, mimeType ?? active.mimeType);
      return active;
    } catch {
      return null;
    }
  }

  function fallbackToWebm(stream: MediaStream): boolean {
    const fallbackType = pickRecorderMimeType([...WEBM_RECORDER_TYPES]);
    if (!fallbackType || fallbackType === recordedMimeType) return false;
    const active = startRecorderOnStream(stream, fallbackType);
    return !!active;
  }

  function start(quality: '720p' | '480p' = '720p'): boolean {
    if (!supported || isRecording.value) return false;
    const Recorder = getMediaRecorder();
    if (!Recorder) return false;
    let stream: MediaStream | null = null;
    try {
      stream = buildMixedStream(quality);
      if (!stream) return false;
      const mimeType = pickRecorderMimeType();
      const active = startRecorderOnStream(stream, mimeType);
      if (!active) return false;
      active.onerror = () => {
        if (recordedMimeType?.startsWith('video/webm')) return;
        try {
          if (active.state !== 'inactive') active.stop();
        } catch {
          /* already stopped */
        }
        fallbackToWebm(stream!);
      };
      rafId = window.requestAnimationFrame(paintFrame);
      isRecording.value = true;
      return true;
    } catch {
      cleanup();
      return false;
    }
  }

  function cleanup() {
    if (rafId !== undefined) window.cancelAnimationFrame(rafId);
    rafId = undefined;
    for (const source of audioSources.values()) {
      try {
        source.disconnect();
      } catch {
        /* already disconnected */
      }
    }
    audioSources.clear();
    audioDestination = undefined;
    void audioContext?.close().catch(() => {});
    audioContext = undefined;
    canvas = undefined;
  }

  function stop(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!recorder || !isRecording.value) {
        resolve(null);
        return;
      }
      const active = recorder;
      active.onstop = () => {
        cleanup();
        isRecording.value = false;
        const type = active.mimeType || recordedMimeType;
        resolve(chunks.length ? new Blob(chunks, type ? { type } : undefined) : null);
        recorder = undefined;
        recordedMimeType = undefined;
      };
      try {
        if (active.state === 'recording') {
          try {
            active.requestData();
          } catch {
            /* final chunk may already be available */
          }
        }
        active.stop();
      } catch {
        cleanup();
        isRecording.value = false;
        resolve(null);
      }
    });
  }

  return { isSupported: supported, isRecording, start, stop };
}
