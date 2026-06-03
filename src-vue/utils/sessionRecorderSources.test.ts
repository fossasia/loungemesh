import { afterEach, describe, expect, it } from 'vitest';
import {
  collectSessionAudioTracks,
  collectSessionVideoSources,
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

describe('collectSessionVideoSources', () => {
  it('returns labeled videos inside user tiles', () => {
    document.body.innerHTML =
      '<div class="sessionRoot"><div id="u1" class="userContainer" data-recording-name="Ada"><video></video></div></div><video></video>';
    expect(collectSessionVideoSources()).toEqual([
      expect.objectContaining({ participantId: 'u1', displayName: 'Ada' }),
    ]);
  });

  it('falls back through visible name text and generated participant ids', () => {
    document.body.innerHTML = `
      <div class="sessionRoot">
        <div id="u2" class="userContainer"><span class="nameText">Grace</span><video></video></div>
        <div class="userContainer"><span class="nameTag">Linus</span><video></video></div>
        <div class="userContainer"><video></video></div>
      </div>
    `;
    expect(collectSessionVideoSources().map((source) => [source.participantId, source.displayName])).toEqual([
      ['u2', 'Grace'],
      ['participant-2', 'Linus'],
      ['participant-3', 'participant-3'],
    ]);
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
    expect(sources.getVideoSources()).toEqual([]);
    expect(sources.getAudioTracks()).toEqual([]);
  });
});
