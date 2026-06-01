<script setup lang="ts">
import Card from './Card.vue';

defineProps<{
  title: string;
  onClose?: () => void;
}>();
</script>

<template>
  <Card className="menuCard" :title="title" :onClose="onClose">
    <slot />
  </Card>
</template>

<style scoped>
.menuCard {
  position: fixed;
  z-index: 10001;
}
</style>
