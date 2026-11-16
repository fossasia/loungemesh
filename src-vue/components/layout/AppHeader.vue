<script setup lang="ts">
import { computed, ref } from 'vue';
import logo from '@/assets/logo.svg';
import { useAuthStore } from '@/stores/authStore';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import AppIcon from '@/components/ui/AppIcon.vue';
import AuthPrompt from '@/components/auth/AuthPrompt.vue';
import UserProfilePopover from '@/components/auth/UserProfilePopover.vue';

withDefaults(
  defineProps<{
    variant?: 'home' | 'session';
  }>(),
  { variant: 'session' },
);

const auth = useAuthStore();
const conference = useConferenceStore();
const features = useSessionFeaturesStore();
const showProfile = ref(false);

const sessionBadgeKind = computed<'connecting' | 'lobby' | 'host' | 'moderator' | ''>(() => {
  if (!features.configLoaded) return 'connecting';
  if (features.isLobbyBlocked) return 'lobby';
  if (!conference.isJoined && conference.isJoining) return 'connecting';
  if (features.isHost) return 'host';
  if (features.isModerator) return 'moderator';
  return '';
});

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
  
  <div v-else class="sessionBrand" data-testid="session-brand">
    <div class="brandGroup">
      <img :src="logo" alt="" class="logoMark" width="22" height="22" />
      <span class="brandWord">LoungeMesh</span>
    </div>
    <template v-if="sessionBadgeKind">
      <span class="brandDivider" aria-hidden="true" />
      <div
        class="headerRoleBadge"
        :class="`status-${sessionBadgeKind}`"
        data-testid="header-role-badge"
      >
        <span v-if="sessionBadgeKind === 'connecting'" class="badgeInner connecting">
          <span class="statusDot" aria-hidden="true" /> Connecting…
        </span>
        <span v-else-if="sessionBadgeKind === 'lobby'" class="badgeInner lobby">
          <AppIcon name="clock" :size="12" /> In lobby
        </span>
        <span v-else-if="sessionBadgeKind === 'host'" class="badgeInner host">
          <AppIcon name="award" :size="12" /> Host
        </span>
        <span v-else-if="sessionBadgeKind === 'moderator'" class="badgeInner mod">
          <AppIcon name="shield" :size="12" /> Moderator
        </span>
      </div>
    </template>
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
  left: 18px;
  right: auto;
  z-index: 100;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 6px 14px 6px 10px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: 9999px;
  box-shadow: 0 4px 16px -2px rgba(30, 34, 64, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04);
  user-select: none;
  pointer-events: auto;
  box-sizing: border-box;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.sessionBrand:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px -2px rgba(30, 34, 64, 0.12), 0 2px 4px rgba(0, 0, 0, 0.04);
}

.brandGroup {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.logoMark {
  flex-shrink: 0;
  display: block;
}

.brandWord {
  font-weight: 700;
  font-size: 13.5px;
  letter-spacing: -0.01em;
  color: var(--color-mono10, #1e2240);
  line-height: 1;
}

.brandDivider {
  width: 1px;
  height: 14px;
  background: rgba(148, 163, 184, 0.4);
  flex-shrink: 0;
  margin: 0 1px;
}

.headerRoleBadge {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}

.badgeInner {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  line-height: 1;
}

.badgeInner.host {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.14), rgba(251, 191, 36, 0.22));
  border: 1px solid rgba(245, 158, 11, 0.5);
  color: #d97706;
  box-shadow: 0 1px 3px rgba(245, 158, 11, 0.12);
}

.badgeInner.mod {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.14), rgba(139, 92, 246, 0.22));
  border: 1px solid rgba(99, 102, 241, 0.5);
  color: #6366f1;
  box-shadow: 0 1px 3px rgba(99, 102, 241, 0.12);
}

.badgeInner.connecting {
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: #2563eb;
  text-transform: none;
  font-weight: 600;
  letter-spacing: 0;
}

.badgeInner.lobby {
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.35);
  color: #b45309;
  text-transform: none;
  font-weight: 600;
  letter-spacing: 0;
}

.statusDot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #3b82f6;
  animation: headerPulse 1.4s ease-in-out infinite;
}

@keyframes headerPulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.4;
    transform: scale(0.85);
  }
}
</style>
