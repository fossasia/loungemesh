import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import { useLocalStore } from '@/stores/localStore';
import { scheduleRemoteVideoSubscriptionRefresh } from './scheduleRemoteVideoRefresh';

describe('scheduleRemoteVideoSubscriptionRefresh', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('recomputes on-screen users on the next tick', async () => {
    const local = useLocalStore();
    const spy = vi.spyOn(local, 'calculateUsersOnScreen');
    scheduleRemoteVideoSubscriptionRefresh();
    expect(spy).not.toHaveBeenCalled();
    await nextTick();
    expect(spy).toHaveBeenCalled();
  });
});
