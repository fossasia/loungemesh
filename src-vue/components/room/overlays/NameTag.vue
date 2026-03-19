<template>
  <div class="nameTag"><slot /></div>
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
  padding: 8px 5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nameTag:hover {
  background: var(--color-mono60);
  border: 1px solid var(--color-mono60);
}
</style>

