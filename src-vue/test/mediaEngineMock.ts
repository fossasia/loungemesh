import { vi } from 'vitest';
import { ref } from 'vue';
import type { MediaService, MediaServiceEventMap } from '@/services/MediaService';
import type { JitsiTrack } from '@/types/jitsi';

type Handler = (...args: unknown[]) => void;

export function createMediaEngineMock(overrides: Partial<MediaService> = {}) {
  const handlers = new Map<string, Set<Handler>>();
  const connected = ref(false);
  const joined = ref(false);
  let tokenRefreshFn: (() => Promise<string | null>) | undefined;

  const engine = {
    handlers,
    _emit<E extends keyof MediaServiceEventMap>(event: E, ...args: MediaServiceEventMap[E]) {
      handlers.get(event as string)?.forEach((fn) => fn(...args));
    },
    init: vi.fn(),
    connect: vi.fn(async () => {
      connected.value = true;
    }),
    disconnect: vi.fn(() => {
      connected.value = false;
      joined.value = false;
    }),
    joinRoom: vi.fn(async () => {
      joined.value = true;
    }),
    leaveRoom: vi.fn(() => {
      joined.value = false;
    }),
    createLocalTracks: vi.fn(async (devices: string[]) =>
      devices.map((d) => ({
        getType: () => (d === 'audio' ? 'audio' : 'video'),
        videoType: d === 'desktop' ? 'desktop' : 'camera',
        attach: vi.fn(),
        detach: vi.fn(),
        isMuted: () => false,
        mute: vi.fn(),
        unmute: vi.fn(),
        dispose: vi.fn(),
      })) as unknown as JitsiTrack[],
    ),
    addLocalTrack: vi.fn(),
    replaceLocalTrack: vi.fn(),
    setParticipantVolume: vi.fn(),
    disconnectParticipantAudio: vi.fn(),
    refreshRemoteAudio: vi.fn(),
    resumePlayback: vi.fn(),
    setReceiverConstraints: vi.fn(),
    setDisplayName: vi.fn(),
    setLocalParticipantProperty: vi.fn(),
    sendTextMessage: vi.fn(),
    sendCommand: vi.fn(),
    getLocalUserId: vi.fn(() => 'local-1'),
    getConference: vi.fn(() => ({
      getLocalVideoTrack: vi.fn(() => ({ videoType: 'camera' })),
    })),
    isConnected: vi.fn(() => connected.value),
    isJoined: vi.fn(() => joined.value),
    on: vi.fn((event: string, fn: Handler) => {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(fn);
    }),
    off: vi.fn(),
    onTokenExpired: vi.fn((fn: () => Promise<string | null>) => {
      tokenRefreshFn = fn;
    }),
    dispose: vi.fn(),
    async refreshToken() {
      return tokenRefreshFn?.() ?? null;
    },
    ...overrides,
  };

  return { engine, connected, joined };
}

export function mockUseMediaEngine(engine: ReturnType<typeof createMediaEngineMock>['engine']) {
  const connected = ref(engine.isConnected());
  const joined = ref(engine.isJoined());
  return {
    engine,
    connected,
    joined,
    engineError: ref(undefined),
    connect: vi.fn(async () => {
      await engine.connect();
      connected.value = engine.isConnected();
    }),
    disconnect: vi.fn(() => {
      engine.disconnect();
      connected.value = false;
      joined.value = false;
    }),
    joinRoom: vi.fn(async (...args: Parameters<MediaService['joinRoom']>) => {
      await engine.joinRoom(...args);
      joined.value = engine.isJoined();
    }),
    leaveRoom: vi.fn(() => {
      engine.leaveRoom();
      joined.value = false;
    }),
    createLocalTracks: engine.createLocalTracks,
    replaceLocalTrack: engine.replaceLocalTrack,
    setParticipantVolume: engine.setParticipantVolume,
    getConference: engine.getConference,
  };
}
