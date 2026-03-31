<script setup lang="ts">
import { computed } from 'vue';
import { useConferenceStore } from '@/stores/conferenceStore';
import RemoteUser from './RemoteUser.vue';
import { buildRemoteUserList } from './remoteUserList';

const conference = useConferenceStore();

/**
 * Structured list so v-memo can track both id and position.
 * Avoids re-rendering the entire user subtree on unrelated store updates.
 */
const users = computed(() => buildRemoteUserList(conference.users));
</script>

<template>
  <!--
    Composite key skips re-rendering unless position, mute or identity changed.
    Track/volume updates are handled internally via JitsiAdapter's GainNode.
  -->
  <RemoteUser
    v-for="u in users"
    :key="`${u.id}:${u.x}:${u.y}:${u.mute}`"
    :id="u.id"
  />
</template>

