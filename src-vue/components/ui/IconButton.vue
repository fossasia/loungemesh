<script setup lang="ts">
import { playUiSound, type UiSoundId } from '@/utils/uiSounds';
import AppIcon from '@/components/ui/AppIcon.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    label: string;
    active?: boolean;
    highlight?: boolean;
    warning?: boolean;
    error?: boolean;
    ghost?: boolean;
    primary?: boolean;
    /** Short click feedback; set false to silence this button. */
    sound?: UiSoundId | false;
    /** Unread / new-activity indicator dot. */
    activityDot?: boolean;
    disabled?: boolean;
  }>(),
  { ghost: false, primary: false, sound: 'tap', activityDot: false, disabled: false },
);

function onClick(): void {
  if (props.disabled) return;
  if (props.sound !== false) playUiSound(props.sound);
}
</script>

<template>
  <button
    class="ibtn"
    :class="{
      active: !!active,
      highlight: !!highlight,
      warning: !!warning,
      error: !!error,
      ghost,
      primary,
      hasActivityDot: !!activityDot,
      disabled: !!disabled,
    }"
    type="button"
    :title="label"
    :aria-label="label"
    :disabled="disabled"
    v-bind="$attrs"
    @click="onClick"
  >
    <span class="icon"><slot name="icon" /></span>
    <span v-if="error" class="errorBadge" title="Hardware error">
      <AppIcon name="alert-triangle" :size="12" />
    </span>
    <span class="sr-only">{{ label }}</span>
  </button>
</template>

<style scoped>
.ibtn {
  position: relative;
  font-size: var(--fs-body);
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 46px;
  min-width: 46px;
  padding: 12px;
  border-radius: var(--radius-round);
  border: 2px solid transparent;
  color: var(--btn-default-fg);
  background-color: var(--btn-default-bg);
  font-weight: normal;
  font-family: var(--font-body);
  cursor: pointer;
}

.ibtn :deep(svg) {
  stroke: var(--btn-default-fg);
}

.ibtn.primary :deep(svg) {
  stroke: var(--btn-primary-fg);
}

.ibtn.active :deep(svg) {
  stroke: var(--btn-active-fg);
}

.ibtn.highlight :deep(svg) {
  stroke: var(--btn-highlight-fg);
}

.ibtn.warning :deep(svg) {
  stroke: var(--btn-warning-fg);
}

.ibtn:hover {
  background-color: var(--btn-default-bg-hover);
}

.ibtn:active {
  background-color: var(--color-mono60);
}

.ibtn.disabled,
.ibtn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  pointer-events: none;
}

.ibtn:focus {
  outline: none;
}

.ibtn.ghost {
  background-color: transparent;
}
.ibtn.ghost:hover {
  background-color: var(--btn-default-bg);
}

.ibtn.primary {
  color: var(--btn-primary-fg);
  background-color: var(--btn-primary-bg);
}
.ibtn.primary:hover {
  background-color: var(--btn-primary-bg-hover);
  color: var(--btn-default-fg);
}
.ibtn.primary:active {
  background-color: var(--color-mono0);
  color: var(--btn-primary-fg);
}

.ibtn.active {
  color: var(--btn-active-fg);
  background-color: var(--btn-active-bg);
}

.ibtn.highlight {
  color: var(--btn-highlight-fg);
  background-color: var(--btn-highlight-bg);
}
.ibtn.highlight:hover {
  background-color: var(--btn-highlight-bg-hover);
}
.ibtn.highlight:active {
  background-color: var(--color-mono80);
}

.ibtn.warning {
  color: var(--btn-warning-fg);
  background-color: var(--btn-warning-bg);
}
.ibtn.warning:hover {
  background-color: var(--btn-warning-bg-hover);
  border: solid 2px var(--color-red100);
}
.ibtn.warning:active {
  background-color: var(--color-mono0);
}

.icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.ibtn.hasActivityDot::after {
  content: '';
  position: absolute;
  top: 5px;
  right: 5px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--color-blue100);
  border: 2px solid var(--btn-default-bg);
  pointer-events: none;
}

.ibtn.highlight.hasActivityDot::after,
.ibtn.active.hasActivityDot::after,
.ibtn.warning.hasActivityDot::after {
  border-color: currentColor;
}

.ibtn.error {
  color: #fff;
  background-color: #ef4444;
  border-color: #dc2626;
}
.ibtn.error :deep(svg) {
  stroke: #fff;
}
.ibtn.error:hover {
  background-color: #dc2626;
}
.errorBadge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #f59e0b;
  color: #fff;
  border-radius: 50%;
  padding: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  z-index: 2;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 768px) {
  .ibtn {
    min-height: 42px;
    min-width: 42px;
    padding: 9px;
    gap: 8px;
  }
}
</style>
