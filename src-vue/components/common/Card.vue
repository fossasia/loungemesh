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
      <span class="title">{{ title }}</span>
      <button type="button" class="close" @click="onClose?.()">
        <span class="x">×</span>
        <span class="sr">Close</span>
      </button>
    </div>
    <slot />
  </div>
</template>

<style scoped>
/* Legacy `Card` from src/components/common/Card/Card.tsx */
.box {
  position: fixed;
  z-index: 10001;
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 1);
  box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
}
.header {
  padding: 8px 0;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
}
.title {
  font-weight: var(--fw-medium);
}
.close {
  border: none;
  background: transparent;
  padding: 8px;
  width: 40px;
  height: 40px;
  transform: translate(0, -8px);
  border-radius: 50px;
  cursor: pointer;
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

