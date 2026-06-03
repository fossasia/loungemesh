<script setup lang="ts">
import { computed } from 'vue';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import RemoteUser from './RemoteUser.vue';
import { buildRemoteUserList } from './remoteUserList';

const conference = useConferenceStore();
const features = useSessionFeaturesStore();

const users = computed(() => {
  conference.usersEpoch;
  const list = buildRemoteUserList(conference.users);
  if (!features.lobbyEnabled) return list;
  return list.filter((u) => features.lobbyApproved[u.id] || u.id === features.hostId);
});
</script>

<template>
  <RemoteUser
    v-for="u in users"
    :key="u.id"
    :id="u.id"
    :x="u.x"
    :y="u.y"
    :display-name="u.displayName"
  />
</template>
