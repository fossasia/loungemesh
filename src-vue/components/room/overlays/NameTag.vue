<script setup lang="ts">
defineProps<{
  role?: 'host' | 'moderator' | 'attendee' | '';
}>();
</script>

<template>
  <div class="nameTag">
    <span v-if="role === 'host'" class="roleIcon hostIcon" title="Host" aria-label="Host">👑</span>
    <span v-else-if="role === 'moderator'" class="roleIcon modIcon" title="Moderator" aria-label="Moderator">🛡️</span>
    <slot />
  </div>
</template>

<style scoped>
/* Legacy `NameTag` from src/components/NameTag/NameTag.tsx */
.nameTag {
  margin-top: 5px;
  box-sizing: border-box;
  width: 100%;
  max-width: 200px;
  border-radius: var(--radius-sm);
  font-weight: 500;
  color: var(--color-mono0);
  background: var(--color-mono80);
  text-align: center;
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: 4px;
  padding: 8px 5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nameTag:hover {
  background: var(--color-mono60);
  border: 1px solid var(--color-mono60);
}
.roleIcon {
  font-size: 11px;
  line-height: 1;
  flex-shrink: 0;
}
</style>
