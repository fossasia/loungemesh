<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { JitsiTrackLike } from '@/types/jitsi';
import {
  mediaDebug,
  mediaDebugVideoAfterAttach,
  mediaDebugVideoElement,
} from '@/utils/mediaDebug';

const props = defineProps<{ id: string; track?: JitsiTrackLike; speaking?: boolean }>();
const el = ref<HTMLVideoElement | null>(null);

async function attachTrack(track: typeof props.track) {
  if (!track) {
    mediaDebug('RemoteVideo', 'attach:skipped', { participantId: props.id, reason: 'no-track' });
    return;
  }
  if (!el.value) {
    mediaDebug('RemoteVideo', 'attach:skipped', { participantId: props.id, reason: 'no-element' });
    return;
  }
  try {
    track.detach?.(el.value);
  } catch {
    /* not attached yet */
  }
  mediaDebugVideoElement('RemoteVideo', 'attach:before', props.id, el.value, {
    trackMuted: track.isMuted?.(),
  });
  try {
    track.attach?.(el.value);
    mediaDebugVideoElement('RemoteVideo', 'attach:after', props.id, el.value);
    mediaDebugVideoAfterAttach('RemoteVideo', props.id, el.value);
    // Explicit play() for Firefox — autoplay attribute alone is not always honoured.
    // The srcObject only contains video (audio goes through Web Audio), so browsers
    // allow this even under strict autoplay policies.
    if (el.value.paused) {
      el.value.play().catch(() => {
        /* Autoplay still blocked — will resume on next user gesture */
      });
    }
  } catch (err) {
    mediaDebug('RemoteVideo', 'attach:failed', {
      participantId: props.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

onMounted(() => {
  void nextTick(() => attachTrack(props.track));
});

watch(
  () => props.track,
  async (t, prev) => {
    if (prev && el.value) {
      try {
        prev.detach?.(el.value);
      } catch {
        /* ignore */
      }
    }
    await nextTick();
    await attachTrack(t);
  },
);

watch(el, (node) => {
  if (node && props.track) void attachTrack(props.track);
});

onBeforeUnmount(() => {
  if (props.track && el.value) {
    try {
      props.track.detach?.(el.value);
    } catch {
      /* ignore */
    }
  }
});
</script>

<template>
  <video
    ref="el"
    autoplay
    playsinline
    muted
    class="remoteVideo"
    :class="{ speaking: !!speaking, hidden: !!track?.isMuted?.() }"
    :id="`${id}video`"
  />
</template>

<style scoped>
.remoteVideo {
  position: relative;
  z-index: 1;
  display: block;
  width: 200px;
  height: 200px;
  border-radius: 999px;
  object-fit: cover;
  background: #0f172a;
  border: 4px solid var(--color-mono60);
  box-sizing: border-box;
  transition: border-color 0.2s ease;
}
.remoteVideo.hidden {
  visibility: hidden;
}
.remoteVideo.speaking {
  border-color: var(--color-blue100);
  animation: speakPulse 1.8s ease-in-out infinite;
}

@keyframes speakPulse {
  0%, 100% { box-shadow: 0 0 0 2px rgba(79, 110, 247, 0.3); }
  50%       { box-shadow: 0 0 0 8px rgba(79, 110, 247, 0.08); }
}
</style>
