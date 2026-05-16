import { afterEach, describe, expect, it } from 'vitest';
import {
  collectSessionAudioTracks,
  collectSessionVideoElements,
  makeRecorderSources,
} from './sessionRecorderSources';

function audioTrack(): MediaStreamTrack {
  return { kind: 'audio', stop() {} } as unknown as MediaStreamTrack;
}
function videoTrack(): MediaStreamTrack {
  return { kind: 'video', stop() {} } as unknown as MediaStreamTrack;
}
function jitsiTrack(tracks: MediaStreamTrack[]) {
  return { getOriginalStream: () => ({ getTracks: () => tracks }) } as never;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('collectSessionVideoElements', () => {
  it('returns only videos inside the session root', () => {
    document.body.innerHTML =
      '<div class="sessionRoot"><video></video><video></video></div><video></video>';
    expect(collectSessionVideoElements()).toHaveLength(2);
  });
});

describe('collectSessionAudioTracks', () => {
  it('gathers audio tracks from local and remote participants, skipping video', () => {
    const local = { audio: jitsiTrack([audioTrack(), videoTrack()]) };
    const conference = {
      users: {
        u1: { audio: jitsiTrack([audioTrack()]) },
        u2: undefined,
        u3: {},
      },
    };
    const tracks = collectSessionAudioTracks(local, conference);
    expect(tracks).toHaveLength(2);
    expect(tracks.every((t) => t.kind === 'audio')).toBe(true);
  });
});

describe('makeRecorderSources', () => {
  it('wires both collectors against the live stores', () => {
    const sources = makeRecorderSources({ audio: undefined }, { users: {} });
    expect(sources.getVideoElements()).toEqual([]);
    expect(sources.getAudioTracks()).toEqual([]);
  });
});
