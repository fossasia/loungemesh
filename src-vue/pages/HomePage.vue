<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppHeader from '@/components/layout/AppHeader.vue';
import NameInputForm from '@/components/home/NameInputForm.vue';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { formatSphereName } from '@/utils/formatSphereName';

const router = useRouter();
const conference = useConferenceStore();
const local = useLocalStore();

onMounted(() => {
  local.stopAllLocalMedia();
});

function goSession(payload: { displayName: string; sessionName: string }) {
  const name = formatSphereName(payload.displayName);
  conference.setDisplayName(name);
  conference.setConferenceName(payload.sessionName);
  router.push(`/session/${payload.sessionName}`);
}
</script>

<template>
  <div class="home">
    <AppHeader variant="home" />
    <main class="page">
      <div class="center">
        <h1 class="title">Flowspace</h1>
        <p class="sub">Spatial video lounges for informal online events</p>
        <NameInputForm class="formWrap" @submit="goSession" />
      </div>
    </main>
  </div>
</template>

<style scoped>
.home {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}
.page {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.center {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px;
  max-width: 420px;
  width: 100%;
}
.title {
  margin: 0 0 8px;
  font-size: 2rem;
  font-weight: var(--fw-medium);
  color: var(--color-text-default);
}
.sub {
  font-weight: 500;
  font-size: 1.25rem;
  margin: 0 0 32px;
  color: var(--color-mono10);
  text-align: center;
}
.formWrap {
  width: 100%;
}
</style>
