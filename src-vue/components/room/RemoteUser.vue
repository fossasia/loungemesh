<script setup lang="ts">
import { computed } from 'vue';
import { useConferenceStore } from '@/stores/conferenceStore';
import RemoteVideo from './RemoteVideo.vue';
import RemoteAudio from './RemoteAudio.vue';
import DesktopVideo from './DesktopVideo.vue';
import NameTag from './overlays/NameTag.vue';
import UserBackdrop from './overlays/UserBackdrop.vue';
import MuteIndicator from './overlays/MuteIndicator.vue';
import SpeakingRing from './overlays/SpeakingRing.vue';

const props = defineProps<{ id: string }>();
const conference = useConferenceStore();

const user = computed(() => conference.users[props.id]);
const style = computed(() => ({
  position: 'absolute',
  width: '200px',
  height: '200px',
  left: `${user.value?.pos?.x ?? 0}px`,
  top: `${user.value?.pos?.y ?? 0}px`,
}));
const displayName = computed(
  () => (user.value as { user?: { _displayName?: string } })?.user?._displayName ?? 'Friendly Sphere',
);
const isDesktop = computed(() => user.value?.video?.videoType === 'desktop');
const speaking = computed(() => !!user.value?.speaking && !user.value?.mute);
</script>

<template>
  <div v-if="user" class="userContainer" :id="id" :style="style">
    <div class="videoContainer" :class="{ desktop: isDesktop }">
      <SpeakingRing :active="speaking" />
      <UserBackdrop :onStage="user.properties?.onStage === true || user.properties?.onStage === 'true'" />
      <template v-if="isDesktop">
        <DesktopVideo :id="id" :track="user.video" />
      </template>
      <template v-else>
        <RemoteVideo :id="id" :track="user.video" />
      </template>
    </div>
    <RemoteAudio :id="id" :track="user.audio" :volume="user.volume" />
    <MuteIndicator v-if="user.mute" />
    <NameTag>{{ displayName }}</NameTag>
  </div>
</template>

<style scoped>
.videoContainer {
  width: auto;
  height: 200px;
  border-radius: 100px;
  position: relative;
}
.videoContainer.desktop {
  border-radius: var(--radius-sm);
}
</style>
