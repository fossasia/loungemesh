/**
 * Contract test for the MediaService interface.
 * Uses a lightweight in-memory stub to verify the event/listener contract
 * without needing a real Jitsi connection.
 */
import { describe, it, expect, vi } from 'vitest';
import type { MediaService, MediaServiceEvent, MediaServiceEventMap } from './MediaService';

type Listener = (...args: unknown[]) => void;

class StubMediaService implements MediaService {
  private listeners = new Map<MediaServiceEvent, Set<Listener>>();
  private _connected = false;
  private _joined = false;
  private _refreshFn?: () => Promise<string | null>;

  init() {}
  async connect() { this._connected = true; this.emit('connected'); }
  disconnect() { this._connected = false; this.emit('disconnected'); }
  async joinRoom(
    _room: string,
    _displayName: string,
    _conferenceOptions: Record<string, unknown>,
  ) {
    this._joined = true;
    this.emit('conferenceJoined');
  }
  leaveRoom() { this._joined = false; }
  async createLocalTracks() { return []; }
  async addLocalTrack() {}
  async replaceLocalTrack() {}
  setParticipantVolume() {}
  setReceiverConstraints() {}
  setDisplayName() {}
  setLocalParticipantProperty() {}
  sendTextMessage() {}
  sendCommand() {}
  removeCommand() {}
  getLocalUserId() { return 'stub-user'; }
  getConference() { return undefined; }
  isConnected() { return this._connected; }
  isJoined() { return this._joined; }

  on<E extends MediaServiceEvent>(event: E, fn: (...args: MediaServiceEventMap[E]) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn as Listener);
  }
  off<E extends MediaServiceEvent>(event: E, fn: (...args: MediaServiceEventMap[E]) => void) {
    this.listeners.get(event)?.delete(fn as Listener);
  }
  onTokenExpired(fn: () => Promise<string | null>) { this._refreshFn = fn; }
  dispose() { this.listeners.clear(); }

  emit<E extends MediaServiceEvent>(event: E, ...args: MediaServiceEventMap[E]) {
    this.listeners.get(event)?.forEach((fn) => fn(...args));
  }
}

describe('MediaService contract (StubMediaService)', () => {
  it('fires connected event on connect()', async () => {
    const svc = new StubMediaService();
    const cb = vi.fn();
    svc.on('connected', cb);
    await svc.connect();
    expect(cb).toHaveBeenCalledTimes(1);
    expect(svc.isConnected()).toBe(true);
  });

  it('fires disconnected event on disconnect()', async () => {
    const svc = new StubMediaService();
    const cb = vi.fn();
    svc.on('disconnected', cb);
    await svc.connect();
    svc.disconnect();
    expect(cb).toHaveBeenCalledTimes(1);
    expect(svc.isConnected()).toBe(false);
  });

  it('fires conferenceJoined on joinRoom()', async () => {
    const svc = new StubMediaService();
    const cb = vi.fn();
    svc.on('conferenceJoined', cb);
    await svc.joinRoom('r1', 'Alice', {});
    expect(cb).toHaveBeenCalledTimes(1);
    expect(svc.isJoined()).toBe(true);
  });

  it('off() removes listener', async () => {
    const svc = new StubMediaService();
    const cb = vi.fn();
    svc.on('connected', cb);
    svc.off('connected', cb);
    await svc.connect();
    expect(cb).not.toHaveBeenCalled();
  });

  it('onTokenExpired stores the refresh callback', async () => {
    const svc = new StubMediaService();
    const refreshFn = vi.fn().mockResolvedValue('new-jwt');
    svc.onTokenExpired(refreshFn);
    expect((svc as unknown as { _refreshFn?: unknown })._refreshFn).toBe(refreshFn);
  });

  it('tokenExpired event fires correctly', () => {
    const svc = new StubMediaService();
    const cb = vi.fn();
    svc.on('tokenExpired', cb);
    svc.emit('tokenExpired');
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('dispose() clears all listeners', async () => {
    const svc = new StubMediaService();
    const cb = vi.fn();
    svc.on('connected', cb);
    svc.dispose();
    await svc.connect();
    expect(cb).not.toHaveBeenCalled();
  });
});
