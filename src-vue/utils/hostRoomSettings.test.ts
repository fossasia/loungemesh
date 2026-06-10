import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { useLocalStore } from '@/stores/localStore';
import {
  broadcastHostRoomSettings,
  loadPersistedHostRoomSettings,
  persistHostRoomSettings,
} from './hostRoomSettings';
import { ROOM_BACKGROUND_CHUNK_SIZE } from './roomBackgroundSync';

describe('hostRoomSettings', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('persists and loads settings per session', () => {
    persistHostRoomSettings('room-a', {
      gridBackgroundUrl: 'data:image/jpeg;base64,abc',
      notesTemplate: '# Notes',
    });
    expect(loadPersistedHostRoomSettings('room-a')).toEqual({
      gridBackgroundUrl: 'data:image/jpeg;base64,abc',
      notesTemplate: '# Notes',
    });
    expect(loadPersistedHostRoomSettings('room-b')).toBeNull();
  });

  it('ignores invalid persisted JSON and empty session ids', () => {
    localStorage.setItem('loungemesh:host-room:bad', '{not-json');
    expect(loadPersistedHostRoomSettings('bad')).toBeNull();
    expect(loadPersistedHostRoomSettings('')).toBeNull();
    localStorage.setItem('loungemesh:host-room:null', 'null');
    expect(loadPersistedHostRoomSettings('null')).toBeNull();
    localStorage.setItem('loungemesh:host-room:str', '"nope"');
    expect(loadPersistedHostRoomSettings('str')).toBeNull();
  });

  it('ignores non-string persisted fields', () => {
    localStorage.setItem(
      'loungemesh:host-room:typed',
      JSON.stringify({ gridBackgroundUrl: 1, notesTemplate: false }),
    );
    expect(loadPersistedHostRoomSettings('typed')).toEqual({});
  });

  it('no-ops when session id is missing or localStorage is unavailable', () => {
    expect(persistHostRoomSettings('', { notesTemplate: '# Notes' })).toBeUndefined();
    const storage = globalThis.localStorage;
    vi.stubGlobal('localStorage', undefined);
    expect(loadPersistedHostRoomSettings('room')).toBeNull();
    expect(() => persistHostRoomSettings('room', { notesTemplate: '# Notes' })).not.toThrow();
    vi.stubGlobal('localStorage', storage);
  });

  it('swallows localStorage write failures', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() =>
      persistHostRoomSettings('room-a', { notesTemplate: '# Notes' }),
    ).not.toThrow();
  });

  it('ignores broadcasts from non-host participants', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('guest');
    features.setHost('host');
    features.gridBackgroundUrl = 'data:image/jpeg;base64,abc';
    const engine = { sendCommand: vi.fn() };
    broadcastHostRoomSettings(engine as never, features);
    expect(engine.sendCommand).not.toHaveBeenCalled();
  });

  it('does not broadcast without a wallpaper', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('host');
    features.setHost('host');
    const engine = { sendCommand: vi.fn() };
    broadcastHostRoomSettings(engine as never, features);
    expect(engine.sendCommand).not.toHaveBeenCalled();
  });

  it('broadcasts chunked room commands for large wallpapers', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('host');
    features.setHost('host');
    const url = 'data:image/jpeg;base64,' + 'x'.repeat(ROOM_BACKGROUND_CHUNK_SIZE + 1);
    features.gridBackgroundUrl = url;

    const engine = { sendCommand: vi.fn() };
    broadcastHostRoomSettings(engine as never, features);
    expect(engine.sendCommand).toHaveBeenCalledWith(
      'room',
      JSON.stringify({ action: 'begin', total: 2 }),
    );
    expect(engine.sendCommand).toHaveBeenCalledWith(
      'room',
      expect.stringContaining('"action":"chunk"'),
    );
  });

  it('broadcasts clear only when explicitly requested', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('host');
    features.setHost('host');
    features.gridBackgroundUrl = '';
    const engine = { sendCommand: vi.fn() };
    broadcastHostRoomSettings(engine as never, features);
    expect(engine.sendCommand).not.toHaveBeenCalled();
    broadcastHostRoomSettings(engine as never, features, { announceClear: true });
    expect(engine.sendCommand).toHaveBeenCalledWith('room', JSON.stringify({ action: 'clear' }));
  });
});
