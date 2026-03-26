<script setup lang="ts">
import { useRouter } from 'vue-router';
import Info from '@/components/common/Info.vue';
import AppHeader from '@/components/layout/AppHeader.vue';
import NameInputForm from '@/components/home/NameInputForm.vue';
import { useConferenceStore } from '@/stores/conferenceStore';
import Wave from '@/assets/wave.svg';

const router = useRouter();
const conference = useConferenceStore();

function goSession(name: string) {
  conference.setConferenceName(name);
  router.push(`/session/${name}`);
}
</script>

<template>
  <AppHeader />
  <Info>
    Welcome to our Prototype<br />
    Please use <b>Chromium</b> or <b>Chrome</b> for now for a stable Experience
  </Info>
  <main class="page">
    <div class="center">
      <div class="headlineRow">
        <img :src="Wave" alt="" class="wave" />
        <h1 class="big">Welcome to Flowspace</h1>
      </div>
      <h3 class="sub">Spatial video lounges for informal online events</h3>
      <NameInputForm class="formWrap" @submit="goSession" />
    </div>
  </main>
</template>

<style scoped>
.page {
  height: 100%;
}
.center {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 32px;
}
.headlineRow {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: 8px;
}
.wave {
  width: 44px;
  height: 44px;
}
.big {
  font-size: 2.5rem;
  font-weight: 500;
  color: var(--color-text-default);
  margin: 0;
}
.sub {
  font-weight: 500;
  font-size: 1.5rem;
  margin: 0;
  margin-top: 4px;
  color: var(--color-mono10);
}
.formWrap {
  margin-top: 40px;
}
</style>
