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
  /** Live video elements (local + remote tiles) to composite into the frame. */
  getVideoElements: () => HTMLVideoElement[];
  /** Raw audio MediaStreamTracks (local mic + remote participants) to mix. */
  getAudioTracks: () => MediaStreamTrack[];
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
  let canvas: HTMLCanvasElement | undefined;

  function paintFrame() {
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const videos = sources.getVideoElements().filter((v) => v.videoWidth > 0 && v.videoHeight > 0);
    if (videos.length) {
      const cols = Math.ceil(Math.sqrt(videos.length));
      const rows = Math.ceil(videos.length / cols);
      const cellW = canvas.width / cols;
      const cellH = canvas.height / rows;
      videos.forEach((video, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        try {
          ctx.drawImage(video, col * cellW, row * cellH, cellW, cellH);
        } catch {
          /* video not ready / cross-origin — skip this frame */
        }
      });
    }
    rafId = window.requestAnimationFrame(paintFrame);
  }

  function buildMixedStream(): MediaStream | null {
    canvas = document.createElement('canvas');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    const captured = canvas.captureStream(FRAME_RATE);

    const audioTracks = sources.getAudioTracks().filter(Boolean);
    if (audioTracks.length) {
      const Ctx = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        audioContext = new Ctx();
        const destination = audioContext.createMediaStreamDestination();
        for (const track of audioTracks) {
          try {
            const source = audioContext.createMediaStreamSource(new MediaStream([track]));
            source.connect(destination);
          } catch {
            /* track ended / not connectable — skip */
          }
        }
        destination.stream.getAudioTracks().forEach((t) => captured.addTrack(t));
      }
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
