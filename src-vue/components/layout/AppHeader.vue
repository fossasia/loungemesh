<script setup lang="ts">
import logo from '@/assets/logo.svg';

withDefaults(
  defineProps<{
    variant?: 'home' | 'session';
  }>(),
  { variant: 'session' },
);
</script>

<template>
  <a class="hdr" :class="variant" href="/" rel="home">
    <img :src="logo" alt="Flowspace" class="logo" width="32" height="32" />
    <span class="brand"><slot>Flowspace</slot></span>
  </a>
</template>

<style scoped>
.hdr {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  z-index: 10000;
  font-weight: var(--fw-medium);
  font-size: var(--fs-h2);
  text-decoration: none;
  color: var(--color-text-default);
  background: var(--color-bg-card);
  box-shadow: 0 1px 4px rgba(79, 110, 247, 0.12);
}
.hdr.session {
  position: fixed;
  margin: 10px 0;
  right: 10px;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
}
.hdr.home {
  position: static;
  align-self: center;
  margin: 24px auto 0;
  padding: 10px 18px;
  border-radius: var(--radius-round);
}
.logo {
  flex-shrink: 0;
}
.brand {
  line-height: 1;
}
</style>
