<script setup lang="ts">
defineProps<{
  title: string;
  onClose?: () => void;
  className?: string;
}>();
</script>

<template>
  <div class="box" :class="className || ''">
    <div class="header">
      <div class="titleRow">
        <span class="title">{{ title }}</span>
        <slot name="afterTitle" />
      </div>
      <button type="button" class="close" @click="onClose?.()">
        <span class="x">×</span>
        <span class="sr">Close</span>
      </button>
    </div>
    <div class="content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
/* Legacy `Card` from src/components/common/Card/Card.tsx */
.box {
  position: fixed;
  z-index: 10001;
  border-radius: var(--radius-md, 12px);
  background: rgba(255, 255, 255, 1);
  border: 1px solid var(--line-light, #e2e8f0);
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.14), 0 2px 6px rgba(15, 23, 42, 0.06);
  display: flex;
  flex-direction: column;
  text-align: left;
}
.header {
  padding: 14px 16px 10px;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--line-light, #eef2f6);
}
.titleRow {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 12px 16px 16px;
}
.title {
  font-weight: 600;
  font-size: 15px;
  color: var(--color-text-default);
}
.close {
  border: none;
  background: transparent;
  padding: 0;
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 9999px;
  color: var(--color-mono30, #475569);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.close:hover {
  background-color: var(--btn-default-bg-hover);
}
.x {
  font-size: 22px;
  line-height: 1;
}
.sr {
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
</style>

