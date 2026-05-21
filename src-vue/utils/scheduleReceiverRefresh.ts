import { useLocalStore } from '@/stores/localStore';

/**
 * Re-run viewport/Colibri selection after DOM or participants update.
 *
 * Uses a double rAF: when a participant joins/rejoins, the first frame may run
 * before Vue has painted the new `.userContainer`, so the on-screen detection
 * (and therefore receiver constraints) would miss the new tile. Recomputing on
 * the following frame guarantees the DOM reflects the new participant.
 */
export function scheduleReceiverRefresh(): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      useLocalStore().calculateUsersOnScreen();
    });
  });
}
