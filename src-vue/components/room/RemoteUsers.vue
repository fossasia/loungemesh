<script setup lang="ts">
import { computed } from 'vue';
import { useConferenceStore } from '@/stores/conferenceStore';
import RemoteUser from './RemoteUser.vue';

const conference = useConferenceStore();
const ids = computed(() => Object.keys(conference.users));
</script>

<template>
  <RemoteUser v-for="id in ids" :key="id" :id="id" />
</template>

