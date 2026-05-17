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

/* Phones / narrow viewports: the control row would otherwise overflow off-screen. */
@media (max-width: 768px) {
  .footer {
    flex-direction: column;
    align-items: stretch;
    padding-bottom: 4px;
  }
  .left {
    display: none;
  }
  .center {
    flex-wrap: wrap;
    justify-content: center;
    margin: 6px;
    gap: 6px;
  }
  .center :deep(button) {
    margin: 0 2px;
  }
  .right {
    margin: 0 6px 2px;
    min-width: 0;
    justify-content: center;
    flex-wrap: wrap;
  }
}
</style>
