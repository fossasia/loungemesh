<script setup lang="ts">
import { computed, type Component } from 'vue';
import {
  ArrowRight,
  BarChart3,
  Bell,
  BellOff,
  ChevronDown,
  ChevronUp,
  Circle,
  Eye,
  EyeOff,
  FileText,
  Hand,
  Maximize2,
  MessageSquare,
  Mic,
  MicOff,
  Minimize2,
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
  Volume2,
  X,
  LogOut,
  UserMinus,
  Info,
  Settings,
  AlertTriangle,
  Download,
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
  | 'bell'
  | 'bell-off'
  | 'chat'
  | 'chevron-down'
  | 'chevron-up'
  | 'close'
  | 'eye'
  | 'eye-off'
  | 'file-text'
  | 'hand'
  | 'maximize'
  | 'minimize'
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
  | 'volume-x'
  | 'volume-2'
  | 'log-out'
  | 'user-minus'
  | 'info'
  | 'settings'
  | 'alert-triangle'
  | 'download';

const registry: Record<IconName, Component> = {
  'arrow-right': ArrowRight,
  'bar-chart': BarChart3,
  bell: Bell,
  'bell-off': BellOff,
  chat: MessageSquare,
  'chevron-down': ChevronDown,
  'chevron-up': ChevronUp,
  close: X,
  eye: Eye,
  'eye-off': EyeOff,
  'file-text': FileText,
  hand: Hand,
  maximize: Maximize2,
  minimize: Minimize2,
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
  'volume-2': Volume2,
  'log-out': LogOut,
  'user-minus': UserMinus,
  info: Info,
  settings: Settings,
  'alert-triangle': AlertTriangle,
  download: Download,
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
