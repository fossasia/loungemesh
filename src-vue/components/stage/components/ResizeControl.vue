<script setup lang="ts">
defineProps<{ onClick?: () => void }>();
</script>

<template>
  <div class="resizeContainer" @click="onClick?.()">
    <div class="resizeEl">
      <!-- inline Maximize2-ish icon -->
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M15 3h6v6"
          stroke="white"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          d="M9 21H3v-6"
          stroke="white"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          d="M21 3l-7 7"
          stroke="white"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          d="M3 21l7-7"
          stroke="white"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </div>
  </div>
</template>

<style scoped>
/* Legacy `ResizeControl` from src/addons/Stage/components/ResizeControl.tsx */
.resizeContainer {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
}
.resizeContainer > div {
  display: none;
}
.resizeContainer:hover {
  background-color: rgba(255, 255, 255, 0.2);
}
.resizeContainer:hover > div {
  display: block;
}
.resizeEl {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: rgba(0, 0, 0, 0.5);
  padding: 15px;
  border-radius: 50%;
}
</style>

