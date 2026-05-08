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
    position: 'absolute',
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
const showAvatar = computed(() => !videoTrack.value || !!videoTrack.value.isMuted?.());
const speaking = computed(() => !!user.value?.speaking && !user.value?.mute);
const reaction = computed(() => features.userReactions[props.id]?.emoji);
const handUp = computed(
  () =>
    user.value?.properties?.handRaised === true ||
    user.value?.properties?.handRaised === 'true',
);
</script>

<template>
  <div v-if="user" class="userContainer" :id="id" :style="style">
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
    <NameTag>
      <span v-if="handUp" class="handBadge">✋</span>
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
.handBadge {
  margin-right: 4px;
}
</style>
