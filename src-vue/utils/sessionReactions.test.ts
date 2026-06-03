import { describe, expect, it, vi } from 'vitest';
import { sendSessionReaction } from './sessionReactions';

describe('sendSessionReaction', () => {
  it('no-ops without a participant id', () => {
    const setReaction = vi.fn();
    const sendCommand = vi.fn();
    const closePanel = vi.fn();
    sendSessionReaction('', undefined, '👍', setReaction, sendCommand, closePanel);
    expect(setReaction).not.toHaveBeenCalled();
    expect(sendCommand).not.toHaveBeenCalled();
    expect(closePanel).not.toHaveBeenCalled();
  });

  it('publishes a reaction for the local or engine user id', () => {
    const setReaction = vi.fn();
    const sendCommand = vi.fn();
    const closePanel = vi.fn();
    sendSessionReaction('', 'engine-user', '👍', setReaction, sendCommand, closePanel);
    expect(setReaction).toHaveBeenCalledWith('engine-user', '👍');
    expect(sendCommand).toHaveBeenCalledWith(
      'react',
      JSON.stringify({ id: 'engine-user', emoji: '👍' }),
    );
    expect(closePanel).toHaveBeenCalled();
  });
});
