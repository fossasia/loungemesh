import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canPublishSharedNotes,
  createNotesPushScheduler,
  featureCardStyleForPanel,
  nextNotesDraft,
  shouldApplyRemoteNotesDraft,
  shouldPublishNotesDraft,
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

  it('applies remote notes only when there are no local edits', () => {
    expect(shouldApplyRemoteNotesDraft(false)).toBe(true);
    expect(shouldApplyRemoteNotesDraft(true)).toBe(false);
    expect(nextNotesDraft(true, 'remote', 'local')).toBe('local');
    expect(nextNotesDraft(false, 'remote', 'local')).toBe('remote');
  });

  it('skips publishing unchanged drafts', () => {
    expect(shouldPublishNotesDraft('same', 'same')).toBe(false);
    expect(shouldPublishNotesDraft('new', 'old')).toBe(true);
  });

  it('blocks publishing when the user cannot edit notes', () => {
    expect(canPublishSharedNotes(true)).toBe(true);
    expect(canPublishSharedNotes(false)).toBe(false);
  });

  it('schedules publish only for users who can edit', () => {
    const publish = vi.fn();
    let allowed = false;
    const { push, flush, cancel, dispose } = createNotesPushScheduler(
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

    publish.mockClear();
    flush();
    expect(publish).toHaveBeenCalledWith('draft');
    dispose();
  });

  it('skips a scheduled publish if editing access is revoked before it fires', () => {
    const publish = vi.fn();
    let allowed = true;
    const { push } = createNotesPushScheduler(
      () => allowed,
      () => 'draft',
      publish,
    );
    push();
    allowed = false;
    vi.advanceTimersByTime(400);
    expect(publish).not.toHaveBeenCalled();
  });

  it('cancel clears a pending publish', () => {
    const publish = vi.fn();
    const { push, cancel } = createNotesPushScheduler(
      () => true,
      () => 'draft',
      publish,
    );
    push();
    cancel();
    vi.advanceTimersByTime(400);
    expect(publish).not.toHaveBeenCalled();
  });
});
