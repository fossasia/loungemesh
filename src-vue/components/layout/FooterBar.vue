<script setup lang="ts">
defineProps<{
  leftText?: string;
}>();
</script>

<template>
  <div class="footer">
    <div class="left">{{ leftText }}</div>
    <div class="center"><slot /></div>
    <div class="right"><slot name="right" /></div>
  </div>
</template>

<style scoped>
/* Legacy `Footer` Container from src/components/Footer/Footer.tsx */
.footer {
  position: absolute;
  bottom: 0;
  width: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  pointer-events: none;
  z-index: 5000;
  font-family: var(--font-body);
}
.left,
.center,
.right {
  pointer-events: auto;
}
.left {
  margin-left: 12px;
  min-width: 120px;
  text-align: left;
  color: var(--color-text-default);
  font-weight: var(--fw-medium);
}
.center {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin: 10px;
  gap: 10px;
  overflow: visible;
}
.center :deep(button) {
  margin: 0 5px;
}
.right {
  margin-right: 12px;
  min-width: 120px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

/* Phone footer: two even rows so mic, camera, screenshare, and leave stay on screen. */
@media (max-width: 768px) {
  .footer {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 4px;
    padding: 6px 6px calc(6px + env(safe-area-inset-bottom, 0px));
    box-sizing: border-box;
    background: color-mix(in srgb, var(--color-bg-page) 92%, white);
  }
  .left {
    display: none;
  }
  .center,
  .right {
    display: contents;
  }
  .footer :deep(button) {
    pointer-events: auto;
    margin: 0;
    width: 100%;
    min-width: 0;
    min-height: 40px;
    padding: 6px;
    justify-self: stretch;
  }
  .footer :deep(.btn-leave-call) {
    grid-column: span 2;
    font-size: 0.8rem;
  }
}
</style>
