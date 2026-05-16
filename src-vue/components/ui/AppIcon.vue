<script setup lang="ts">
import { computed, type Component } from 'vue';
import {
  ArrowRight,
  BarChart3,
  Circle,
  EyeOff,
  FileText,
  Hand,
  MessageSquare,
  Mic,
  MicOff,
  Minus,
  MonitorUp,
  MoreVertical,
  Pencil,
  Plus,
  Presentation,
  Smile,
  User,
  Video,
  VideoOff,
  VolumeX,
  X,
} from '@lucide/vue';

const props = withDefaults(
  defineProps<{
    name: IconName;
    size?: number;
    strokeWidth?: number;
  }>(),
  { size: 22, strokeWidth: 2 },
);

export type IconName =
  | 'arrow-right'
  | 'bar-chart'
  | 'chat'
  | 'close'
  | 'eye-off'
  | 'file-text'
  | 'hand'
  | 'mic'
  | 'mic-off'
  | 'minus'
  | 'monitor-up'
  | 'more-vertical'
  | 'pencil'
  | 'plus'
  | 'record'
  | 'smile'
  | 'stage'
  | 'user'
  | 'video'
  | 'video-off'
  | 'volume-x';

const registry: Record<IconName, Component> = {
  'arrow-right': ArrowRight,
  'bar-chart': BarChart3,
  chat: MessageSquare,
  close: X,
  'eye-off': EyeOff,
  'file-text': FileText,
  hand: Hand,
  mic: Mic,
  'mic-off': MicOff,
  minus: Minus,
  'monitor-up': MonitorUp,
  'more-vertical': MoreVertical,
  pencil: Pencil,
  plus: Plus,
  record: Circle,
  smile: Smile,
  stage: Presentation,
  user: User,
  video: Video,
  'video-off': VideoOff,
  'volume-x': VolumeX,
};

const icon = computed(() => registry[props.name]);
</script>

<template>
  <component
    :is="icon"
    class="appIcon"
    :size="size"
    :stroke-width="strokeWidth"
    aria-hidden="true"
  />
</template>

<style scoped>
.appIcon {
  display: block;
  flex-shrink: 0;
}
</style>
