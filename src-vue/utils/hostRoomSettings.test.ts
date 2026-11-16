import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { useLocalStore } from '@/stores/localStore';
import {
  broadcastHostRoomSettings,
} from './hostRoomSettings';

describe('hostRoomSettings', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('broadcasts a moderator wallpaper and ignores attendees', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('mod');
    features.setHost('host');
    features.userGrants.mod = { moderator: true };
    features.gridBackgroundUrl = 'data:image/jpeg;base64,abc';
    const engine = { sendCommand: vi.fn() };
    broadcastHostRoomSettings(engine as never, features);
    expect(engine.sendCommand).toHaveBeenCalledWith('room', JSON.stringify({ action: 'reload' }));

    local.setMyID('guest');
    features.userGrants = {};
    engine.sendCommand.mockClear();
    broadcastHostRoomSettings(engine as never, features);
    expect(engine.sendCommand).not.toHaveBeenCalled();
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

  it('broadcasts reload command for wallpapers', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('host');
    features.setHost('host');
    const url = 'data:image/jpeg;base64,xxxx';
    features.gridBackgroundUrl = url;

    const engine = { sendCommand: vi.fn() };
    broadcastHostRoomSettings(engine as never, features);
    expect(engine.sendCommand).toHaveBeenCalledWith(
      'room',
      JSON.stringify({ action: 'reload' }),
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
