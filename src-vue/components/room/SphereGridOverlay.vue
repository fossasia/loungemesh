<script setup lang="ts">
import { computed } from 'vue';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { useAuthStore } from '@/stores/authStore';
import UserBackdrop from '@/components/room/overlays/UserBackdrop.vue';
import GridTileVideo from '@/components/room/GridTileVideo.vue';
import { sphereGridMembers } from '@/utils/sphereGrid';
import IconButton from '@/components/ui/IconButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const conference = useConferenceStore();
const local = useLocalStore();
const features = useSessionFeaturesStore();
const auth = useAuthStore();

const members = computed(() => {
  conference.usersEpoch;
  const remotes = Object.values(conference.users).map((user) => ({
    id: user.id,
    pos: user.pos,
    properties: user.properties,
    displayName: user.user?._displayName,
  }));
  return sphereGridMembers(
    local.pos,
    local.id,
    conference.displayName || 'You',
    remotes,
    { presenterId: features.stageOccupantId || undefined },
  );
});

const showLocalVideo = computed(() => !!local.video && !local.cameraOff);

function remoteVideo(id: string) {
  return conference.users[id]?.video;
}

function remoteAvatar(id: string): string | undefined {
  const url = conference.users[id]?.properties?.avatarUrl;
  return typeof url === 'string' ? url : undefined;
}

function close() {
  features.gridView = false;
}
</script>

<template>
  <div class="sphereGrid" role="dialog" aria-label="People in your sphere">
    <div class="gridHeader">
      <h2>In your sphere</h2>
      <IconButton label="Close grid view" @click="close">
        <template #icon><AppIcon name="close" /></template>
      </IconButton>
    </div>
    <div class="gridTiles">
      <article v-for="member in members" :key="member.id" class="tile">
        <div class="tileVideo">
          <template v-if="member.isLocal">
            <GridTileVideo v-if="showLocalVideo" :track="local.video" muted />
            <UserBackdrop
              v-else
              :displayName="member.displayName"
              :avatarUrl="auth.user?.avatarUrl"
            />
          </template>
          <template v-else>
            <GridTileVideo v-if="remoteVideo(member.id)" :track="remoteVideo(member.id)" muted />
            <UserBackdrop
              v-else
              :displayName="member.displayName"
              :avatarUrl="remoteAvatar(member.id)"
            />
          </template>
        </div>
        <p class="tileName">{{ member.displayName }}</p>
      </article>
    </div>
  </div>
</template>

<style scoped>
.sphereGrid {
  position: fixed;
  inset: 0;
  z-index: 6500;
  background: var(--color-mono95, #f4f4f7);
  display: flex;
  flex-direction: column;
  padding: 16px 16px 120px;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}
.gridHeader {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.gridHeader h2 {
  margin: 0;
  font-size: var(--fs-h2);
  font-weight: var(--fw-medium);
}
.gridTiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}
.tile {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.tileVideo {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 16px;
  overflow: hidden;
  background: #0f172a;
}
.tileName {
  margin: 0;
  font-size: 16px;
  font-weight: var(--fw-medium);
  text-align: center;
}

@media (max-width: 768px) {
  .gridTiles {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .gridHeader :deep(.ibtn) {
    min-width: 44px;
    min-height: 44px;
  }
}

@media (max-width: 480px) {
  .gridTiles {
    grid-template-columns: 1fr;
  }
  .sphereGrid {
    padding: 12px 12px 140px;
  }
}
</style>
