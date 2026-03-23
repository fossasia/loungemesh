<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import JitsiConnection from '@/components/runtime/JitsiConnection.vue';
import LocalStoreLogic from '@/components/runtime/LocalStoreLogic.vue';
import PanWrapper from '@/components/layout/PanWrapper.vue';
import Room from '@/components/room/Room.vue';
import FooterBar from '@/components/layout/FooterBar.vue';
import IconButton from '@/components/ui/IconButton.vue';
import RemoteUsers from '@/components/room/RemoteUsers.vue';
import LocalUser from '@/components/room/LocalUser.vue';
import AppHeader from '@/components/layout/AppHeader.vue';
import ErrorHandler from '@/components/common/ErrorHandler.vue';
import Info from '@/components/common/Info.vue';
import { defineAsyncComponent } from 'vue';
import MoreTab from '@/components/footer/MoreTab.vue';
import ScreenshareButton from '@/components/footer/ScreenshareButton.vue';
import StageButton from '@/components/stage/StageButton.vue';

const ChatPanel = defineAsyncComponent(() => import('@/components/chat/ChatPanel.vue'));
const StagePanel = defineAsyncComponent(() => import('@/components/stage/StagePanel.vue'));
import { useLocalStore } from '@/stores/localStore';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useMediaEngine } from '@/composables/useMediaEngine';
import MicIcon from '@/components/icons/MicIcon.vue';
import MicOffIcon from '@/components/icons/MicOffIcon.vue';

/** Absorbs `props: true` route param so it is not forwarded as a stray DOM attribute (multi-root page). */
defineProps<{ id: string }>();

const route = useRoute();
const identifier = computed(() => String(route.params.id ?? ''));

const local = useLocalStore();
const conf = useConferenceStore();
const { disconnect, leaveRoom, engine } = useMediaEngine();
const router = useRouter();

// Pinia can preserve pan/zoom across navigations; force a deterministic recenter per session.
watch(
  () => identifier.value,
  () => local.resetViewportForRoom(),
  { immediate: true }
);

function leave() {
  local.setOnStage(false);
  engine.setLocalParticipantProperty('onStage', false);
  leaveRoom();
  conf.leaveConference();
  disconnect();
  router.push('/');
}
</script>

<template>
  <ErrorHandler />
  <AppHeader />
  <JitsiConnection />
  <LocalStoreLogic />
  <PanWrapper>
    <Room :identifier="identifier">
      <RemoteUsers />
      <LocalUser />
    </Room>
  </PanWrapper>
  <StagePanel />
  <FooterBar left-text="Flowspace">
    <StageButton />
    <IconButton :label="local.mute ? 'Unmute' : 'Mute'" :warning="local.mute" @click="local.toggleMute()">
      <template #icon>
        <MicOffIcon v-if="local.mute" />
        <MicIcon v-else />
      </template>
    </IconButton>
    <ScreenshareButton />
    <button type="button" class="btn-leave-call" @click="leave">Leave Call</button>
    <template #right>
      <ChatPanel />
      <MoreTab />
    </template>
  </FooterBar>
</template>

<style scoped>
</style>
