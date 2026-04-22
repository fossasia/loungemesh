<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import LocalStoreLogic from '@/components/runtime/LocalStoreLogic.vue';
import PanWrapper from '@/components/layout/PanWrapper.vue';
import Room from '@/components/room/Room.vue';
import LocalUser from '@/components/room/LocalUser.vue';
import FooterBar from '@/components/layout/FooterBar.vue';
import IconButton from '@/components/ui/IconButton.vue';
import ErrorHandler from '@/components/common/ErrorHandler.vue';
import AppHeader from '@/components/layout/AppHeader.vue';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { useMediaEngine } from '@/composables/useMediaEngine';
import { ensureLocalTracks } from '@/composables/ensureLocalTracks';
import { joinFromEnterPage } from '@/utils/enterPageJoin';
import AppIcon from '@/components/ui/AppIcon.vue';

const props = defineProps<{ id: string }>();

const router = useRouter();
const conference = useConferenceStore();
const local = useLocalStore();
const { engine } = useMediaEngine();
const joiningSession = ref(false);

watch(
  () => props.id,
  (id) => {
    if (id) {
      conference.setConferenceName(id);
      local.resetViewportForRoom();
    }
  },
  { immediate: true },
);

async function join() {
  joiningSession.value = true;
  await joinFromEnterPage(local, engine, conference, router, ensureLocalTracks);
}

onBeforeUnmount(() => {
  if (!joiningSession.value) {
    local.stopAllLocalMedia();
  }
});
</script>

<template>
  <AppHeader />
  <LocalStoreLogic />
  <PanWrapper>
    <Room>
      <LocalUser />
    </Room>
  </PanWrapper>
  <ErrorHandler />
  <div id="centerContainer" class="centerOverlay">
    <p class="sub">Move around the space, then join when you are ready.</p>
  </div>
  <FooterBar>
    <IconButton
      :label="local.cameraOff ? 'Turn on camera' : 'Turn off camera'"
      :warning="local.cameraOff"
      @click="local.toggleCamera()"
    >
      <template #icon>
        <AppIcon :name="local.cameraOff ? 'video-off' : 'video'" />
      </template>
    </IconButton>
    <IconButton
      :label="local.mute ? 'Unmute' : 'Mute'"
      :warning="local.mute"
      @click="local.toggleMute()"
    >
      <template #icon>
        <AppIcon :name="local.mute ? 'mic-off' : 'mic'" />
      </template>
    </IconButton>
    <button type="button" class="btn-primary-round" @click="join">
      <AppIcon name="arrow-right" class="join-ico" />
      Join
    </button>
  </FooterBar>
</template>

<style scoped>
.centerOverlay {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  max-width: 90%;
  z-index: 1;
  pointer-events: none;
  text-align: center;
}
.sub {
  margin: 0;
  font-weight: 500;
  font-size: 1.25rem;
  color: var(--color-mono10);
}
.join-ico {
  flex-shrink: 0;
}
</style>
