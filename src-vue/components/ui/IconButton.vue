<script setup lang="ts">
defineOptions({ inheritAttrs: false });

withDefaults(
  defineProps<{
    label: string;
    active?: boolean;
    highlight?: boolean;
    warning?: boolean;
    ghost?: boolean;
    primary?: boolean;
  }>(),
  { ghost: false, primary: false }
);
</script>

<template>
  <button
    class="ibtn"
    :class="{ active: !!active, highlight: !!highlight, warning: !!warning, ghost, primary }"
    type="button"
    :title="label"
    :aria-label="label"
    v-bind="$attrs"
  >
    <span class="icon"><slot name="icon" /></span>
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
