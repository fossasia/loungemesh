<script setup lang="ts">
import logo from '@/assets/logo.svg';
</script>

<template>
  <a class="hdr" href="/" rel="home">
    <img :src="logo" alt="" class="logo" width="32" height="32" />
    <span class="brand"><slot>Flowspace</slot></span>
  </a>
</template>

<style scoped>
.hdr {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  position: fixed;
  margin: 10px 0;
  right: 10px;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  z-index: 10000;
  font-weight: var(--fw-medium);
  font-size: var(--fs-h2);
  text-decoration: none;
  color: var(--color-text-default);
  background: var(--color-bg-card);
  box-shadow: 0 1px 4px rgba(79, 110, 247, 0.12);
}
.logo {
  flex-shrink: 0;
}
.brand {
  line-height: 1;
}
</style>
