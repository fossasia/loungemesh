<script setup lang="ts">
import { computed } from 'vue';
import { worldToRoom } from '@/constants/pan';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { isParticipantOnStage } from '@/components/stage/getStageOccupantId';
import RemoteVideo from './RemoteVideo.vue';
import RemoteAudio from './RemoteAudio.vue';
import NameTag from './overlays/NameTag.vue';
import UserBackdrop from './overlays/UserBackdrop.vue';
import MuteIndicator from './overlays/MuteIndicator.vue';
import { getVectorDistance } from '@/utils/vector';

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
const videoTrack = computed(() => conference.users[props.id]?.video);
const videoTrackKey = computed(() => {
  const t = videoTrack.value as { getTrackLabel?: () => string } | undefined;
  return t?.getTrackLabel?.() ?? props.id;
});
const isPresenter = computed(() => features.stageOccupantId === props.id);
const distance = computed(() => {
  if (!local.pos || !user.value?.pos) return 0;
  return getVectorDistance(local.pos, user.value.pos);
});
const isOutsideSphere = computed(() => distance.value > 650);
const showAvatar = computed(() => {
  if (isStageOccupant.value) return true;
  if (!videoTrack.value) return true;
  if (isOutsideSphere.value && features.isStageModeActive) return true;
  return false;
});
const speaking = computed(() => {
  if (isOutsideSphere.value && !isPresenter.value) return false;
  return !!user.value?.speaking && !user.value?.mute;
});
const reaction = computed(() => features.userReactions[props.id]?.emoji);
const handUp = computed(
  () =>
    user.value?.properties?.handRaised === true ||
    user.value?.properties?.handRaised === 'true',
);
const isStageOccupant = computed(() => {
  conference.usersEpoch;
  return isParticipantOnStage(props.id, features.stageOccupantId, conference.users);
});
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
    <div
      class="videoContainer"
      :class="{
        avatarTile: showAvatar,
        speaking: speaking && showAvatar,
        onStageOccupant: isStageOccupant,
      }"
    >
      <UserBackdrop v-if="showAvatar" :onStage="isStageOccupant" />
      <template v-if="videoTrack && !isStageOccupant && !(isOutsideSphere && features.isStageModeActive)">
        <RemoteVideo :key="videoTrackKey" :id="id" :track="videoTrack" :speaking="speaking" />
      </template>
      <span v-if="reaction" class="floatReact">{{ reaction }}</span>
      <div v-if="handUp" class="handBadge" title="Hand raised">✋</div>
    </div>
    <RemoteAudio :id="id" :volume="user?.volume" />
    <MuteIndicator v-if="user.mute" />
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
  box-sizing: border-box;
  border: 4px solid transparent;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  overflow: visible;
}
/* Backdrop is position:absolute, so keep tile width without video (for overlay anchoring). */
.videoContainer:not(.desktop) {
  width: 200px;
}
.videoContainer.desktop {
  border-radius: var(--radius-sm);
}
/* Tile entrance: scale up from a small dot with a spring overshoot */
.userContainer {
  animation: tileEnter 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  transition: left 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), top 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

@keyframes tileEnter {
  from { opacity: 0; transform: scale(0.35); }
  to   { opacity: 1; transform: scale(1); }
}
</style>

<style scoped src="./participantTileOverlays.css"></style>
