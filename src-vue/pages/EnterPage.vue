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
import Info from '@/components/common/Info.vue';
import Wave from '@/assets/wave.svg';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import MicIcon from '@/components/icons/MicIcon.vue';
import MicOffIcon from '@/components/icons/MicOffIcon.vue';
import PhoneOffIcon from '@/components/icons/PhoneOffIcon.vue';

const props = defineProps<{ id: string }>();

const router = useRouter();
const conference = useConferenceStore();
const local = useLocalStore();

watch(
  () => props.id,
  (id) => {
    if (id) conference.setConferenceName(id);
  },
  { immediate: true }
);

function join() {
  router.push(`/session/${conference.conferenceName}`);
}
</script>

<template>
  <Info>
    Welcome to our Prototype<br />
    Please use <b>Chromium</b> or <b>Chrome</b> for now for a stable Experience
  </Info>
  <LocalStoreLogic />
  <PanWrapper>
    <Room>
      <LocalUser />
    </Room>
  </PanWrapper>
  <ErrorHandler />
  <div id="centerContainer" class="centerOverlay">
    <div class="headlineRow">
      <img :src="Wave" alt="" class="wave" />
      <h1 class="big">Welcome to Chatmosphere</h1>
    </div>
    <h3 class="sub">The Open Source Videochat for Cozy Talks</h3>
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
  top: 200px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 1;
  pointer-events: none;
}
.headlineRow {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: 8px;
}
.wave {
  width: 44px;
  height: 44px;
}
.big {
  margin: 0;
  font-size: 2.5rem;
  font-weight: 500;
  color: var(--color-text-default);
}
.sub {
  margin: 8px 0 0;
  font-weight: 500;
  font-size: 1.5rem;
  color: var(--color-mono10);
}
.join-ico {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}
</style>
