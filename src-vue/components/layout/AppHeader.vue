<script setup lang="ts">
import { ref } from 'vue';
import logo from '@/assets/logo.svg';
import { useAuthStore } from '@/stores/authStore';
import AuthPrompt from '@/components/auth/AuthPrompt.vue';
import UserProfilePopover from '@/components/auth/UserProfilePopover.vue';

withDefaults(
  defineProps<{
    variant?: 'home' | 'session';
  }>(),
  { variant: 'session' },
);

const auth = useAuthStore();
const showProfile = ref(false);

function handleProfileClick() {
  if (auth.isAuthenticated) {
    showProfile.value = !showProfile.value;
  } else {
    auth.showAuthPrompt = !auth.showAuthPrompt;
  }
}
</script>

<template>
  <header v-if="variant === 'home'" class="hdr homeHdr">
    <a class="brandLink" href="/" rel="home">
      <img :src="logo" alt="LoungeMesh" class="logo" width="32" height="32" />
      <span class="brand"><slot>LoungeMesh</slot></span>
    </a>
    
    <div class="userMenu">
      <button type="button" class="profileBtn" @click="handleProfileClick" aria-label="Profile menu">
        <img v-if="auth.isAuthenticated" :src="auth.userAvatarUrl" alt="User Avatar" class="avatarImg" />
        <span v-else class="signInPill">Sign In / Register</span>
      </button>
      
      <UserProfilePopover v-if="showProfile" @close="showProfile = false" />
      <AuthPrompt v-if="auth.showAuthPrompt" @close="auth.showAuthPrompt = false" />
    </div>
  </header>
  
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
  justify-content: space-between;
  z-index: 10000;
  font-weight: var(--fw-medium);
  font-size: var(--fs-h2);
  text-decoration: none;
  color: var(--color-text-default);
  background: var(--color-bg-card);
  box-shadow: 0 1px 4px rgba(79, 110, 247, 0.12);
  box-sizing: border-box;
}

.hdr.homeHdr {
  position: sticky;
  top: 0;
  width: 100%;
  padding: 12px 24px;
}

.brandLink {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  color: inherit;
}

.logo {
  flex-shrink: 0;
}

.brand {
  line-height: 1;
}

.userMenu {
  position: relative;
  display: flex;
  align-items: center;
}

.profileBtn {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  outline: none;
}

.avatarImg {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 2px solid var(--color-blue100, #3b82f6);
  background: #f1f5f9;
  object-fit: cover;
  transition: transform 0.2s;
}

.avatarImg:hover {
  transform: scale(1.05);
}

.signInPill {
  background: var(--btn-primary-bg, #3b82f6);
  color: var(--btn-primary-fg, #fff);
  padding: 8px 16px;
  border-radius: var(--radius-round, 9999px);
  font-size: var(--fs-small, 14px);
  font-weight: var(--fw-medium, 500);
  transition: background-color 0.2s, transform 0.1s;
}

.signInPill:hover {
  background: #2563eb;
  transform: translateY(-1px);
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
