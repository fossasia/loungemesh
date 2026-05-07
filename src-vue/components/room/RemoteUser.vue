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
const hasLiveVideo = computed(() => {
  conference.usersEpoch;
  const video = user.value?.video;
  return !!video && !video.isMuted();
});
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
        v-if="!hasLiveVideo"
        :onStage="user.properties?.onStage === true || user.properties?.onStage === 'true'"
      />
      <template v-if="isDesktop">
        <DesktopVideo v-show="hasLiveVideo" :id="id" :track="user.video" />
      </template>
      <template v-else>
        <RemoteVideo v-show="hasLiveVideo" :id="id" :track="user.video" :speaking="speaking" />
      </template>
    </div>
    <RemoteAudio :id="id" :track="user.audio" :volume="user.volume" />
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
