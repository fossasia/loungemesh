import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { useLocalStore } from '@/stores/localStore';
import {
  broadcastHostRoomSettings,
} from './hostRoomSettings';
import { ROOM_BACKGROUND_CHUNK_SIZE } from './roomBackgroundSync';

describe('hostRoomSettings', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
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
