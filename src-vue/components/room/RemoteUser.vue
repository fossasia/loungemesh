<script setup lang="ts">
import { computed } from 'vue';
import { useConferenceStore } from '@/stores/conferenceStore';
import RemoteVideo from './RemoteVideo.vue';
import RemoteAudio from './RemoteAudio.vue';
import DesktopVideo from './DesktopVideo.vue';
import NameTag from './overlays/NameTag.vue';
import UserBackdrop from './overlays/UserBackdrop.vue';
import MuteIndicator from './overlays/MuteIndicator.vue';

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
</script>

<template>
  <div v-if="user" class="userContainer" :id="id" :style="style">
    <div class="videoContainer">
      <UserBackdrop :onStage="user.properties?.onStage === true || user.properties?.onStage === 'true'" />
      <template v-if="(user as any)?.video?.videoType === 'desktop'">
        <DesktopVideo :id="id" :track="user.video" />
      </template>
      <template v-else>
        <RemoteVideo :id="id" :track="user.video" />
      </template>
    </div>
    <RemoteAudio :id="id" :track="user.audio" :volume="user.volume" />
    <MuteIndicator v-if="user.mute" />
    <NameTag>{{ (user as any)?.user?._displayName ?? 'Friendly Sphere' }}</NameTag>
  </div>
</template>

<style scoped>
.videoContainer {
  width: auto;
  height: 200px;
  border-radius: 100px;
  position: relative;
}
</style>

