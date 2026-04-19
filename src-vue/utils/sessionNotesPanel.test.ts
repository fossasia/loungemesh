import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canPublishSharedNotes,
  createNotesPushScheduler,
  featureCardStyleForPanel,
  nextNotesDraft,
  shouldApplyRemoteNotesDraft,
} from './sessionNotesPanel';

const layout = {
  right: '16px',
  bottom: '88px',
  height: '480px',
  notesWidth: '560px',
};

describe('sessionNotesPanel', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('styles notes and moderator panels differently', () => {
    expect(featureCardStyleForPanel('moderator', layout)).toEqual({
      right: '16px',
      bottom: '88px',
    });
    expect(featureCardStyleForPanel('notes', layout)).toEqual({
      right: '16px',
      bottom: '88px',
      width: '560px',
      height: '480px',
      maxHeight: '480px',
    });
  });

  it('applies remote notes only when the notes panel is closed', () => {
    expect(shouldApplyRemoteNotesDraft('moderator')).toBe(true);
    expect(shouldApplyRemoteNotesDraft('notes')).toBe(false);
    expect(nextNotesDraft('notes', 'remote', 'local')).toBe('local');
    expect(nextNotesDraft('moderator', 'remote', 'local')).toBe('remote');
  });

  it('blocks publishing when the user cannot edit notes', () => {
    expect(canPublishSharedNotes(true)).toBe(true);
    expect(canPublishSharedNotes(false)).toBe(false);
  });

  it('schedules publish only for users who can edit', () => {
    const publish = vi.fn();
    let allowed = false;
    const { push, dispose } = createNotesPushScheduler(
      () => allowed,
      () => 'draft',
      publish,
    );
    push();
    vi.advanceTimersByTime(400);
    expect(publish).not.toHaveBeenCalled();

    allowed = true;
    push();
    vi.advanceTimersByTime(400);
    expect(publish).toHaveBeenCalledWith('draft');
    dispose();
  });
});
