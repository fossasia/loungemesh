<script setup lang="ts">
import { computed } from 'vue';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { shouldShowConferenceError } from '@/services/conferenceErrorDetail';
import Info from '@/components/common/Info.vue';

const conf = useConferenceStore();
const conn = useConnectionStore();

const errors = computed(() => {
  const items: string[] = [];
  if (conn.error?.trim()) items.push(conn.error);
  if (shouldShowConferenceError(conf.error, conf.isJoined)) {
    items.push(conf.error!);
  }
  return items;
});

function clearErrors() {
  conn.$patch({ error: undefined });
  conf.$patch({ error: undefined });
}
</script>

<template>
  <Info v-if="errors.length" :managed="false" @dismiss="clearErrors">
    <template v-for="(err, i) in errors" :key="i">{{ err }}<br v-if="i < errors.length - 1" /></template>
  </Info>
</template>
