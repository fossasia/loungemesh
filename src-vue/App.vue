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
  position: relative;
  width: 100%;
  min-height: 100vh;
  cursor: default;
  font-family: var(--font-display);
}
</style>
