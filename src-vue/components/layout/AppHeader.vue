<script setup lang="ts">
import kissingCat from '@/assets/kissingCat.svg';
import loveCat from '@/assets/loveCat.svg';
</script>

<template>
  <a class="hdr" target="_blank" rel="noopener noreferrer" href="https://chatmosphere.cc">
    <img :src="kissingCat" alt="" class="cat default" width="40" height="40" />
    <img :src="loveCat" alt="" class="cat hover" width="40" height="40" />
    <slot />
  </a>
</template>

<style scoped>
.hdr {
  display: flex;
  flex-direction: row;
  align-items: center;
  position: fixed;
  margin: 10px 0;
  right: 10px;
  padding: 10px;
  border-radius: 5px;
  z-index: 10000;
  font-weight: 500;
  font-size: 1.25rem;
  text-decoration: none;
  color: #000;
  height: 40px;
}
.cat.hover {
  display: none;
  margin-right: 5px;
}
.cat.default {
  margin-right: 5px;
}
.hdr:hover .cat.default {
  display: none;
}
.hdr:hover .cat.hover {
  display: inline;
}
</style>
