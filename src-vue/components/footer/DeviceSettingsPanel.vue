<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useLocalStore } from '@/stores/localStore';
import { deviceLabel, listMediaDevices, type ListedMediaDevices } from '@/utils/listMediaDevices';
import { loadMediaDevicePrefs } from '@/utils/mediaDevicePrefs';
import {
  deviceGroupLabel,
  fallbackDeviceLabel,
  supportsAudioOutput,
  type DeviceKind,
} from '@/utils/deviceSettings';

const emit = defineEmits<{ close: [] }>();
const local = useLocalStore();
const listed = ref<ListedMediaDevices>({ audioInputs: [], videoInputs: [], audioOutputs: [] });
const prefs = ref(loadMediaDevicePrefs());
const showSpeakers = computed(() => supportsAudioOutput());

async function refresh() {
  listed.value = await listMediaDevices();
  prefs.value = loadMediaDevicePrefs();
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close');
}

onMounted(() => {
  void refresh();
  document.addEventListener('keydown', onKey);
});

onUnmounted(() => {
  document.removeEventListener('keydown', onKey);
});

function optionLabel(kind: DeviceKind, device: MediaDeviceInfo, index: number): string {
  return deviceLabel(device, fallbackDeviceLabel(kind, index));
}

async function pick(kind: DeviceKind, deviceId: string) {
  if (kind === 'audioinput') await local.switchAudioInput(deviceId);
  else if (kind === 'videoinput') await local.switchVideoInput(deviceId);
  else await local.switchAudioOutput(deviceId);
  prefs.value = loadMediaDevicePrefs();
}

function selected(kind: DeviceKind): string | undefined {
  return prefs.value[kind];
}
</script>

<template>
  <div class="deviceBackdrop" @click="emit('close')" />
  <div
    class="deviceSheet"
    role="dialog"
    aria-label="Device settings"
    @click.stop
  >
    <h2 class="sheetTitle">Devices</h2>
    <section class="group">
      <h3>{{ deviceGroupLabel('videoinput') }}</h3>
      <p v-if="!listed.videoInputs.length" class="empty">No cameras found</p>
      <button
        v-for="(device, index) in listed.videoInputs"
        :key="device.deviceId"
        type="button"
        class="deviceRow"
        :class="{ selected: selected('videoinput') === device.deviceId }"
        :aria-pressed="selected('videoinput') === device.deviceId"
        @click="pick('videoinput', device.deviceId)"
      >
        {{ optionLabel('videoinput', device, index) }}
      </button>
    </section>
    <section class="group">
      <h3>{{ deviceGroupLabel('audioinput') }}</h3>
      <p v-if="!listed.audioInputs.length" class="empty">No microphones found</p>
      <button
        v-for="(device, index) in listed.audioInputs"
        :key="device.deviceId"
        type="button"
        class="deviceRow"
        :class="{ selected: selected('audioinput') === device.deviceId }"
        :aria-pressed="selected('audioinput') === device.deviceId"
        @click="pick('audioinput', device.deviceId)"
      >
        {{ optionLabel('audioinput', device, index) }}
      </button>
    </section>
    <section v-if="showSpeakers" class="group">
      <h3>{{ deviceGroupLabel('audiooutput') }}</h3>
      <p v-if="!listed.audioOutputs.length" class="empty">No speakers found</p>
      <button
        v-for="(device, index) in listed.audioOutputs"
        :key="device.deviceId"
        type="button"
        class="deviceRow"
        :class="{ selected: selected('audiooutput') === device.deviceId }"
        :aria-pressed="selected('audiooutput') === device.deviceId"
        @click="pick('audiooutput', device.deviceId)"
      >
        {{ optionLabel('audiooutput', device, index) }}
      </button>
    </section>
    <button type="button" class="closeRow" @click="emit('close')">Close</button>
  </div>
</template>

<style scoped>
.deviceBackdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  z-index: 99999;
}
.deviceSheet {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 8px);
  transform: translateX(-50%);
  z-index: 100000;
  width: min(360px, calc(100vw - 24px));
  max-height: min(520px, 60vh);
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 14px;
  border-radius: var(--radius-sm);
  background: #fff;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  box-sizing: border-box;
}
.sheetTitle {
  margin: 0 0 10px;
  font-size: var(--fs-h2);
  font-weight: var(--fw-medium);
  text-align: center;
}
.group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}
.group h3 {
  margin: 0;
  font-size: var(--fs-small);
  font-weight: var(--fw-medium);
  color: var(--color-mono30);
}
.empty {
  margin: 0;
  font-size: 16px;
  color: var(--color-mono30);
}
.deviceRow,
.closeRow {
  min-height: 44px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--line-dark, #d0d5dd);
  border-radius: var(--radius-sm);
  background: #fff;
  font-size: 16px;
  font-family: var(--font-body);
  text-align: left;
  cursor: pointer;
}
.deviceRow.selected {
  border-color: var(--color-blue100);
  background: var(--color-blue10, #e4eaff);
}
.closeRow {
  text-align: center;
  font-weight: var(--fw-medium);
}

@media (max-width: 768px) {
  .deviceSheet {
    position: fixed !important;
    left: 0;
    right: 0;
    bottom: 0;
    transform: none;
    width: 100%;
    max-height: 70vh;
    border-radius: 14px 14px 0 0;
  }
}
</style>
