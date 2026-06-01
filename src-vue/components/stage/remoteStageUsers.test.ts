import { describe, expect, it } from 'vitest';
import { remoteStageUsers } from './remoteStageUsers';

describe('remoteStageUsers', () => {
  it('includes only users marked for the stage', () => {
    const users = remoteStageUsers({
      on: { properties: { onStage: 'true' }, audio: {} as never },
      off: { properties: { onStage: false } },
      bool: { properties: { onStage: true }, video: {} as never },
      'no-props': { properties: undefined },
      missing: undefined,
    });
    expect(users).toEqual([
      { id: 'on', audio: {}, video: undefined },
      { id: 'bool', audio: undefined, video: {} },
    ]);
  });
});
