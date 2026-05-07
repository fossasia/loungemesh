import { useLocalStore } from '@/stores/localStore';

/** Re-run viewport/Colibri selection after DOM or participants update. */
export function scheduleReceiverRefresh(): void {
  requestAnimationFrame(() => {
    useLocalStore().calculateUsersOnScreen();
  });
}
