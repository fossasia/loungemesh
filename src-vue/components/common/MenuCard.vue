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
/* Legacy `MenuCard` from src/components/common/Menu/Menu.tsx */
.menuCard {
  width: 270px;
  padding: 15px;
  top: 15px;
  right: 15px;
  bottom: 80px;
}
</style>

