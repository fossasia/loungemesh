<script setup lang="ts">
import { computed } from 'vue';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import type { JitsiTrackLike } from '@/types/jitsi';
import StageVideoAttach from '@/components/stage/StageVideoAttach.vue';
import StageUser from '@/components/stage/components/StageUser.vue';
import IconButton from '@/components/ui/IconButton.vue';
import EyeOffIcon from '@/components/icons/EyeOffIcon.vue';
import VolumeXIcon from '@/components/icons/VolumeXIcon.vue';

const conference = useConferenceStore();
const local = useLocalStore();

const remoteStageUsers = computed(() => {
  const out: Array<{ id: string; audio?: JitsiTrackLike; video?: JitsiTrackLike }> = [];
  for (const id of Object.keys(conference.users)) {
    const u = conference.users[id];
    const p = u?.properties?.onStage;
    if (p === true || p === 'true') {
      out.push({ id, audio: u.audio, video: u.video });
    }
  }
  return out;
});

const showStrip = computed(() => remoteStageUsers.value.length > 0 || local.onStage);

const vol = computed(() => (local.stageMute ? 0 : 0.8));
</script>

<template>
  <template v-if="showStrip">
    <div class="scroll">
      <div class="inner">
        <div class="controls">
          <IconButton
            v-if="!local.stageVisible"
            label="show"
            ghost
            warning
            @click="local.toggleStage()"
          >
            <template #icon><EyeOffIcon /></template>
          </IconButton>
          <IconButton v-else label="hide" ghost @click="local.toggleStage()">
            <template #icon><EyeOffIcon /></template>
          </IconButton>

          <IconButton
            v-if="local.stageVisible && local.stageMute"
            label="unmute"
            ghost
            warning
            @click="local.toggleStageMute()"
          >
            <template #icon><VolumeXIcon /></template>
          </IconButton>
          <IconButton v-if="local.stageVisible && !local.stageMute" label="mute" ghost @click="local.toggleStageMute()">
            <template #icon><VolumeXIcon /></template>
          </IconButton>
        </div>

        <div v-if="local.onStage" class="userContainer">
          <StageVideoAttach v-if="local.video && local.videoType === 'camera'" :track="local.video" mirrored />
          <StageVideoAttach v-else-if="local.video" :track="local.video" />
        </div>

        <template v-if="local.stageVisible">
          <StageUser
            v-for="u in remoteStageUsers"
            :key="u.id"
            :id="u.id"
            :video="u.video"
            :audio="u.audio"
            :volume="vol"
            :selected="u.id === local.selectedUsersOnStage[0]"
          />
        </template>
      </div>
    </div>
  </template>
</template>

<style scoped>
.scroll {
  position: absolute;
  top: 24px;
  left: 0;
  bottom: 24px;
  padding-right: 60px;
  padding-left: 24px;
  width: 12%;
  overflow-y: auto;
  overflow-x: visible;
}
.inner {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.controls {
  display: flex;
  flex-direction: row;
}
.userContainer {
  width: 100%;
  height: auto;
  background-color: white;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 24px 48px 0 rgba(0, 0, 0, 0.25);
  position: relative;
}
</style>
