<script setup lang="ts">
import { watch } from 'vue';
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
import MicIcon from '@/components/icons/MicIcon.vue';
import MicOffIcon from '@/components/icons/MicOffIcon.vue';
import PhoneOffIcon from '@/components/icons/PhoneOffIcon.vue';

const props = defineProps<{ id: string }>();

const router = useRouter();
const conference = useConferenceStore();
const local = useLocalStore();
const { engine } = useMediaEngine();

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
  try {
    await ensureLocalTracks(local, engine);
  } catch {
    /* continue — session will retry */
  }
  router.push(`/session/${conference.conferenceName}`);
}
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
    <IconButton :label="local.mute ? 'Unmute' : 'Mute'" :warning="local.mute" @click="local.toggleMute()">
      <template #icon>
        <MicOffIcon v-if="local.mute" />
        <MicIcon v-else />
      </template>
    </IconButton>
    <button type="button" class="btn-primary-round" @click="join">
      <PhoneOffIcon class="join-ico" aria-hidden="true" />
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
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}
</style>
