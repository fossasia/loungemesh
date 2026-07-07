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
  <a v-if="variant === 'home'" class="hdr home" href="/" rel="home">
    <img :src="logo" alt="LoungeMesh" class="logo" width="32" height="32" />
    <span class="brand"><slot>LoungeMesh</slot></span>
  </a>
  <div v-else class="sessionBrand" aria-hidden="true">
    <img :src="logo" alt="" class="logoMark" width="40" height="40" />
    <span class="brandWord">LoungeMesh</span>
  </div>
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
.sessionBrand {
  position: fixed;
  top: 14px;
  right: 18px;
  left: auto;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  pointer-events: none;
  user-select: none;
  opacity: 0.22;
}
.logoMark {
  flex-shrink: 0;
  filter: saturate(0.85);
}
.brandWord {
  font-weight: var(--fw-medium);
  font-size: 1.1rem;
  letter-spacing: 0.02em;
  color: var(--color-mono30);
}
</style>
