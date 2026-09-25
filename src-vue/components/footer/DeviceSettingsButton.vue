<script setup lang="ts">
import { ref } from 'vue';
import IconButton from '@/components/ui/IconButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import DeviceSettingsPanel from './DeviceSettingsPanel.vue';

const open = ref(false);

function toggle() {
  open.value = !open.value;
}
</script>

<template>
  <div class="deviceWrap">
    <IconButton
      label="Device settings"
      :active="open"
      sound="panel"
      @click="toggle"
    >
      <template #icon><AppIcon name="settings" /></template>
    </IconButton>
    <DeviceSettingsPanel v-if="open" @close="open = false" />
  </div>
</template>

<style scoped>
.deviceWrap {
  position: relative;
  display: inline-flex;
  overflow: visible;
}
</style>
