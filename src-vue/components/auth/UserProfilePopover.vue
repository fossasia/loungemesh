<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuthStore } from '@/stores/authStore';

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const auth = useAuthStore();

const displayName = ref(auth.user?.displayName || '');
const avatarUrl = ref(auth.user?.avatarUrl || '');
const successMsg = ref('');
const errorMsg = ref('');
const loading = ref(false);

const icsUrl = computed(() => {
  if (!auth.user) return '';
  // Return feed link (dynamic protocol & host)
  return `${window.location.protocol}//${window.location.host}/api/calendar/feed/${auth.user.id}.ics`;
});

const copied = ref(false);

function copyIcsUrl() {
  if (!icsUrl.value) return;
  void navigator.clipboard.writeText(icsUrl.value);
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 2000);
}

async function handleUpdateProfile() {
  if (!displayName.value.trim()) {
    errorMsg.value = 'Display Name cannot be empty.';
    return;
  }

  errorMsg.value = '';
  successMsg.value = '';
  loading.value = true;

  try {
    await auth.updateProfile(displayName.value.trim(), avatarUrl.value.trim() || null);
    successMsg.value = 'Profile updated successfully!';
  } catch (err: any) {
    errorMsg.value = err.message || 'Failed to update profile.';
  } finally {
    loading.value = false;
  }
}

async function handleLogout() {
  await auth.logout();
  emit('close');
}

async function handleGoogleLink() {
  try {
    await auth.linkGoogleCalendar();
  } catch (err: any) {
    errorMsg.value = 'Failed to initiate Google link.';
  }
}
</script>

<template>
  <!-- Backdrop to close popover on clicking outside -->
  <div class="dropdownBackdrop" @click="emit('close')" />

  <div class="popoverCard">
      <div class="popoverHeader">
        <h3 class="popoverTitle">User Settings</h3>
        <button type="button" class="closeBtn" @click="emit('close')" aria-label="Close">
          &times;
        </button>
      </div>

      <div class="profileSummary">
        <img :src="auth.userAvatarUrl" alt="Avatar" class="avatar" />
        <div class="details">
          <span class="name">{{ auth.user?.displayName }}</span>
          <span class="email">{{ auth.user?.email }}</span>
        </div>
      </div>

      <div class="popoverBody">
        <p v-if="successMsg" class="success" role="status">{{ successMsg }}</p>
        <p v-if="errorMsg" class="error" role="alert">{{ errorMsg }}</p>

        <form class="form" @submit.prevent="handleUpdateProfile">
          <div class="inputGroup">
            <label for="profName">Display Name</label>
            <input id="profName" v-model="displayName" type="text" required />
          </div>

          <div class="inputGroup">
            <label for="profAvatar">Avatar Image URL</label>
            <input id="profAvatar" v-model="avatarUrl" type="url" placeholder="https://..." />
          </div>

          <button type="submit" class="saveBtn" :disabled="loading">
            {{ loading ? 'Saving...' : 'Save Settings' }}
          </button>
        </form>

        <div class="divider" />

        <div class="section">
          <h4 class="sectionTitle">Google Calendar Integration</h4>
          <p class="sectionText">
            Synchronize your scheduled meetings directly to Google Calendar.
          </p>
          <div v-if="auth.isGoogleLinked" class="linkStatus linked">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
            </svg>
            <span>Linked to Google Account</span>
          </div>
          <button v-else type="button" class="linkBtn" @click="handleGoogleLink">
            Link Google Calendar
          </button>
        </div>

        <div class="section">
          <h4 class="sectionTitle">Personal Calendar Feed (.ics)</h4>
          <p class="sectionText">
            Subscribe to this link in Google Calendar or Apple Calendar to sync meetings live over HTTP.
          </p>
          <div class="copyGroup">
            <input type="text" :value="icsUrl" readonly class="urlInput" />
            <button type="button" class="copyBtn" @click="copyIcsUrl">
              {{ copied ? 'Copied' : 'Copy' }}
            </button>
          </div>
        </div>

        <button type="button" class="logoutBtn" @click="handleLogout">
          Sign Out
        </button>
      </div>
  </div>
</template>

<style scoped>
.dropdownBackdrop {
  position: fixed;
  inset: 0;
  background: transparent;
  z-index: 10900;
}
 
.popoverCard {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 12px;
  background: #ffffff;
  border: 1px solid rgba(79, 110, 247, 0.15);
  border-radius: 20px;
  box-shadow: 0 20px 40px -10px rgba(30, 34, 64, 0.12), 0 5px 15px -3px rgba(30, 34, 64, 0.04);
  width: 350px;
  max-height: calc(100vh - 100px);
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  z-index: 11000;
  animation: popoverEnter 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
 
@keyframes popoverEnter {
  from {
    transform: translateY(-10px) scale(0.98);
    opacity: 0;
  }
  to {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}
 
.popoverHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
 
.popoverTitle {
  margin: 0;
  font-size: var(--fs-body, 16px);
  font-weight: 700;
  color: var(--color-mono10, #1e2240);
}
 
.closeBtn {
  background: transparent;
  border: none;
  font-size: 22px;
  color: var(--color-mono30, #6970a0);
  cursor: pointer;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
}

.closeBtn:hover {
  background-color: #f0f4ff;
  color: #4f6ef7;
}
 
.profileSummary {
  display: flex;
  align-items: center;
  gap: 14px;
  background: #f0f4ff;
  padding: 16px;
  border-radius: 14px;
  margin-bottom: 20px;
}
 
.avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: #e2e8f0;
  object-fit: cover;
  border: 2px solid #4f6ef7;
}
 
.details {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
 
.name {
  font-weight: 700;
  font-size: var(--fs-body, 15px);
  color: var(--color-mono10, #1e2240);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
 
.email {
  font-size: var(--fs-small, 13px);
  color: var(--color-mono30, #6970a0);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}
 
.popoverBody {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
 
.success {
  background: #ebfbee;
  border: 1px solid #b2f2bb;
  color: #2b8a3e;
  padding: 10px;
  border-radius: 8px;
  font-size: var(--fs-small, 13px);
  margin: 0;
  font-weight: 600;
}
 
.error {
  background: #fff5f5;
  border: 1px solid #ffc9c9;
  color: #fa5252;
  padding: 10px;
  border-radius: 8px;
  font-size: var(--fs-small, 13px);
  margin: 0;
  font-weight: 600;
}
 
.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
 
.inputGroup {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
 
.inputGroup label {
  font-size: var(--fs-small, 13px);
  font-weight: 600;
  color: var(--color-mono10, #1e2240);
}
 
.inputGroup input {
  padding: 9px 12px;
  border: 2px solid rgba(79, 110, 247, 0.15);
  border-radius: 10px;
  font-family: inherit;
  font-size: var(--fs-small, 14px);
  outline: none;
  transition: all 0.2s;
}
 
.inputGroup input:focus {
  border-color: #4f6ef7;
  box-shadow: 0 0 0 3px rgba(79, 110, 247, 0.12);
}
 
.saveBtn {
  background: linear-gradient(135deg, #f0f4ff 0%, #e2e8f0 100%);
  color: #4f6ef7;
  border: 1px solid rgba(79, 110, 247, 0.2);
  padding: 10px 14px;
  font-size: var(--fs-small, 14px);
  font-weight: 600;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}
 
.saveBtn:hover {
  background: #eef2ff;
  border-color: #4f6ef7;
}
 
.divider {
  height: 2px;
  background: rgba(79, 110, 247, 0.1);
}
 
.section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
 
.sectionTitle {
  margin: 0;
  font-size: var(--fs-small, 13px);
  font-weight: 700;
  color: var(--color-mono10, #1e2240);
}
 
.sectionText {
  margin: 0;
  font-size: 12px;
  color: var(--color-mono30, #6970a0);
  line-height: 1.45;
  font-weight: 500;
}
 
.linkStatus {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--fs-small, 13px);
  font-weight: 600;
}
 
.linkStatus.linked {
  color: #2b8a3e;
}
 
.linkBtn {
  background: linear-gradient(135deg, #4f6ef7 0%, #3e5cd9 100%);
  color: #fff;
  border: none;
  padding: 10px 14px;
  font-size: var(--fs-small, 13px);
  font-weight: 600;
  border-radius: 10px;
  cursor: pointer;
  box-shadow: 0 4px 10px -2px rgba(79, 110, 247, 0.25);
  transition: all 0.2s;
}
 
.linkBtn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 14px -2px rgba(79, 110, 247, 0.35);
}
 
.copyGroup {
  display: flex;
  gap: 8px;
}
 
.urlInput {
  flex: 1;
  padding: 8px 12px;
  border: 2px solid rgba(79, 110, 247, 0.15);
  border-radius: 10px;
  font-size: var(--fs-small, 12px);
  background: #f8fafc;
  color: var(--color-mono30, #6970a0);
  outline: none;
  font-weight: 500;
}
 
.copyBtn {
  background: #4f6ef7;
  color: #fff;
  border: none;
  padding: 8px 14px;
  font-size: var(--fs-small, 12px);
  font-weight: 600;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}
 
.copyBtn:hover {
  background: #3e5cd9;
}
 
.logoutBtn {
  border: 2px solid #ffc9c9;
  background: #fff;
  color: #fa5252;
  padding: 11px;
  font-size: var(--fs-small, 14px);
  font-weight: 600;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 4px;
}
 
.logoutBtn:hover {
  background: #fff5f5;
  border-color: #fa5252;
}
</style>
