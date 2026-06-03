<script setup lang="ts"></script>

<template>
  <div class="app">
    <RouterView />
  </div>
</template>

<style scoped>
/* Legacy `AppContainer` from src/App.tsx */
.app {
  text-align: center;
  position: fixed;
  width: 100%;
  height: 100%;
  cursor: default;
  font-family: var(--font-display);
}
</style>
