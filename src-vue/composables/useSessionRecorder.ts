import { ref, type Ref } from 'vue';

type MediaRecorderCtor = typeof MediaRecorder;

function getMediaRecorder(): MediaRecorderCtor | undefined {
  return (globalThis as { MediaRecorder?: MediaRecorderCtor }).MediaRecorder;
}

/** Pick the first supported recording mime type, or undefined if none. */
export function pickRecorderMimeType(candidates?: string[]): string | undefined {
  const list = candidates ?? [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
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
  start: () => boolean;
  stop: () => Promise<Blob | null>;
};

const FRAME_RATE = 24;
const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;

/**
 * Client-side session recorder: composites the on-screen video tiles onto a
 * canvas and mixes every audio track through Web Audio, then records both with
 * MediaRecorder. This needs no server component (Jibri); the host downloads the
 * resulting .webm locally. Returns a no-op recorder when unsupported.
 */
export function useSessionRecorder(sources: SessionRecorderSources): SessionRecorder {
  const isRecording = ref(false);
  const supported = isRecordingSupported();

  let recorder: MediaRecorder | undefined;
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
      ctx.fillText('Recording Flowspace session', canvas.width / 2, canvas.height / 2);
      ctx.textAlign = 'start';
    }
    refreshAudioMix();
    rafId = window.requestAnimationFrame(paintFrame);
  }

  function buildMixedStream(): MediaStream | null {
    canvas = document.createElement('canvas');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
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

  function start(): boolean {
    if (!supported || isRecording.value) return false;
    const Recorder = getMediaRecorder();
    if (!Recorder) return false;
    try {
      const stream = buildMixedStream();
      if (!stream) return false;
      const mimeType = pickRecorderMimeType();
      recorder = new Recorder(stream, mimeType ? { mimeType } : undefined);
      chunks = [];
      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      recorder.start(1000);
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
        const type = active.mimeType || 'video/webm';
        resolve(chunks.length ? new Blob(chunks, { type }) : null);
        recorder = undefined;
      };
      try {
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
