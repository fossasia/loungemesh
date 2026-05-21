<script setup lang="ts">
import { computed } from 'vue';
import { worldToRoom } from '@/constants/pan';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import RemoteVideo from './RemoteVideo.vue';
import RemoteAudio from './RemoteAudio.vue';
import DesktopVideo from './DesktopVideo.vue';
import NameTag from './overlays/NameTag.vue';
import UserBackdrop from './overlays/UserBackdrop.vue';
import MuteIndicator from './overlays/MuteIndicator.vue';

const props = defineProps<{
  id: string;
  x?: number;
  y?: number;
  displayName?: string;
}>();
const conference = useConferenceStore();
const local = useLocalStore();
const features = useSessionFeaturesStore();

const user = computed(() => {
  conference.usersEpoch;
  return conference.users[props.id];
});
const style = computed(() => {
  const x = props.x ?? user.value?.pos?.x ?? 0;
  const y = props.y ?? user.value?.pos?.y ?? 0;
  const display = worldToRoom({ x, y }, local.roomBounds);
  return {
    position: 'absolute' as const,
    width: '200px',
    height: '200px',
    left: `${display.x}px`,
    top: `${display.y}px`,
  };
});
const nameLabel = computed(
  () => props.displayName ?? user.value?.user?._displayName ?? 'Friendly Sphere',
);
const isDesktop = computed(() => user.value?.video?.videoType === 'desktop');
const videoTrack = computed(() => conference.users[props.id]?.video);
const videoTrackKey = computed(() => {
  const t = videoTrack.value as { getTrackLabel?: () => string } | undefined;
  return t?.getTrackLabel?.() ?? props.id;
});
const showAvatar = computed(() => !videoTrack.value);
const speaking = computed(() => !!user.value?.speaking && !user.value?.mute);
const reaction = computed(() => features.userReactions[props.id]?.emoji);
const handUp = computed(
  () =>
    user.value?.properties?.handRaised === true ||
    user.value?.properties?.handRaised === 'true',
);
</script>

<template>
  <div
    v-if="user"
    class="userContainer"
    :id="id"
    :data-recording-participant="id"
    :data-recording-name="nameLabel"
    :style="style"
  >
    <div class="videoContainer" :class="{ desktop: isDesktop }">
      <UserBackdrop
        v-if="showAvatar"
        :onStage="user.properties?.onStage === true || user.properties?.onStage === 'true'"
      />
      <template v-if="isDesktop && videoTrack">
        <DesktopVideo :id="id" :track="videoTrack" />
      </template>
      <template v-else-if="videoTrack">
        <RemoteVideo :key="videoTrackKey" :id="id" :track="videoTrack" :speaking="speaking" />
      </template>
    </div>
    <RemoteAudio :id="id" :volume="user?.volume" />
    <MuteIndicator v-if="user.mute" />
    <span v-if="reaction" class="floatReact">{{ reaction }}</span>
    <!-- Prominent hand-raise badge floating above the video -->
    <div v-if="handUp" class="handBadge" title="Hand raised">✋</div>
    <NameTag>
      {{ nameLabel }}
    </NameTag>
  </div>
</template>

<style scoped>
.videoContainer {
  width: auto;
  height: 200px;
  border-radius: 100px;
  position: relative;
  z-index: 1;
}
.videoContainer.desktop {
  border-radius: var(--radius-sm);
}
.floatReact {
  position: absolute;
  top: -8px;
  right: -8px;
  font-size: 1.5rem;
  z-index: 5;
  pointer-events: none;
}

/* Floating hand-raise badge: prominent, above the video circle */
.handBadge {
  position: absolute;
  top: -18px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 1.6rem;
  line-height: 1;
  z-index: 10;
  pointer-events: none;
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.5));
  animation: handBounce 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both,
             handFloat 2.5s ease-in-out 0.45s infinite;
}

@keyframes handBounce {
  from { opacity: 0; transform: translateX(-50%) scale(0.3) rotate(-25deg); }
  to   { opacity: 1; transform: translateX(-50%) scale(1) rotate(0deg); }
}

@keyframes handFloat {
  0%, 100% { transform: translateX(-50%) translateY(0); }
  50%       { transform: translateX(-50%) translateY(-4px); }
}

/* Tile entrance: scale up from a small dot with a spring overshoot */
.userContainer {
  animation: tileEnter 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

@keyframes tileEnter {
  from { opacity: 0; transform: scale(0.35); }
  to   { opacity: 1; transform: scale(1); }
}
</style>
