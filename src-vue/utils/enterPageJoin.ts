import type { Router } from 'vue-router';
import type { useConferenceStore } from '@/stores/conferenceStore';
import type { useLocalStore } from '@/stores/localStore';
import type { MediaService } from '@/services/MediaService';
import { unlockMediaPlaybackNow } from '@/utils/resumeMediaPlayback';

type ConferenceStore = ReturnType<typeof useConferenceStore>;
type LocalStore = ReturnType<typeof useLocalStore>;

export async function joinFromEnterPage(
  local: LocalStore,
  engine: MediaService,
  conference: ConferenceStore,
  router: Router,
  ensureTracks: (local: LocalStore, engine: MediaService) => Promise<unknown>,
): Promise<void> {
  unlockMediaPlaybackNow(engine);
  try {
    await ensureTracks(local, engine);
  } catch {
    /* continue — session will retry */
  }
  await router.push(`/session/${conference.conferenceName}`);
}
