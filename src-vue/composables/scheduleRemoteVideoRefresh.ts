import { nextTick } from 'vue';
import { useLocalStore } from '@/stores/localStore';

/** Recompute Jitsi video subscriptions after DOM / participant list changes. */
export function scheduleRemoteVideoSubscriptionRefresh(): void {
  void nextTick(() => {
    useLocalStore().calculateUsersOnScreen();
  });
}
