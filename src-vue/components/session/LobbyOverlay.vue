<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { useAuthStore } from '@/stores/authStore';
import { useMediaEngine } from '@/composables/useMediaEngine';

const features = useSessionFeaturesStore();
const conference = useConferenceStore();
const local = useLocalStore();
const auth = useAuthStore();
const { engine, leaveRoom, disconnect } = useMediaEngine();
const router = useRouter();

// Waiting form fields
const guestName = ref(conference.displayName || '');
const guestEmail = ref('');
const guestReason = ref('');
const errorMsg = ref('');

// Auth form fields
const activeTab = ref<'guest' | 'login' | 'signup'>('guest');
const authEmail = ref('');
const authPassword = ref('');
const authName = ref('');
const authError = ref('');
const authLoading = ref(false);

function requestJoin() {
  if (!guestName.value.trim()) {
    errorMsg.value = 'Please enter your name.';
    return;
  }
  errorMsg.value = '';
  conference.setDisplayName(guestName.value.trim());

  features.localLobbyPending = true;
  engine.sendCommand(
    'lobby',
    JSON.stringify({
      action: 'wait',
      id: local.id,
      name: guestName.value.trim(),
      email: guestEmail.value.trim() || undefined,
      reason: guestReason.value.trim() || undefined,
    }),
  );
}

async function handleAuthSubmit() {
  authError.value = '';
  if (!authEmail.value || !authPassword.value || (activeTab.value === 'signup' && !authName.value)) {
    authError.value = 'Please fill out all fields.';
    return;
  }

  authLoading.value = true;
  try {
    if (activeTab.value === 'login') {
      await auth.login(authEmail.value, authPassword.value);
    } else {
      await auth.signup(authEmail.value, authPassword.value, authName.value);
    }
  } catch (err: any) {
    authError.value = err.message || 'Authentication failed. Please try again.';
  } finally {
    authLoading.value = false;
  }
}

async function exitLobby() {
  features.resetForLeave();
  await local.stopAllLocalMedia();
  leaveRoom();
  conference.leaveConference();
  disconnect();
  router.push('/');
}
</script>

<template>
  <div v-if="features.isLobbyBlocked" class="lobby">
    <div class="card">
      <!-- Rejection View -->
      <template v-if="features.lobbyRejected">
        <div class="iconCircle errorIcon">
          &times;
        </div>
        <h2 class="title">Entry Declined</h2>
        <p class="sub textError">
          Your request to join this meeting was declined by the host.
        </p>
        <button type="button" class="btnExit" @click="exitLobby">
          Exit to Homepage
        </button>
      </template>

      <!-- Waiting Approval View -->
      <template v-else-if="features.localLobbyPending">
        <div class="spinner"></div>
        <h2 class="title">Asking to join...</h2>
        <p class="sub">
          Lobby mode is on. Please wait. The host will admit you shortly.
        </p>
        <div class="detailsPreview" v-if="guestName">
          <span class="previewLabel">Requesting as:</span>
          <span class="previewValue">{{ guestName }}</span>
        </div>
        <button type="button" class="btnCancel" @click="exitLobby">
          Cancel Request
        </button>
      </template>

      <!-- Form View -->
      <template v-else>
        <!-- Card Tabs -->
        <div class="tabs">
          <button
            type="button"
            class="tab"
            :class="{ active: activeTab === 'guest' }"
            @click="activeTab = 'guest'"
          >
            Guest Join
          </button>
          <button
            type="button"
            class="tab"
            :class="{ active: activeTab === 'login' }"
            @click="activeTab = 'login'"
          >
            Sign In
          </button>
          <button
            type="button"
            class="tab"
            :class="{ active: activeTab === 'signup' }"
            @click="activeTab = 'signup'"
          >
            Register
          </button>
        </div>

        <!-- Guest Join Form -->
        <form v-if="activeTab === 'guest'" class="form" @submit.prevent="requestJoin">
          <p v-if="errorMsg" class="errorAlert" role="alert">{{ errorMsg }}</p>
          <h2 class="title">Request Entry</h2>
          <p class="sub">Enter your details to request access to the meeting room.</p>
          
          <div class="inputGroup">
            <label for="lobbyGuestName">Your Name *</label>
            <input
              id="lobbyGuestName"
              v-model="guestName"
              type="text"
              placeholder="e.g. John Doe"
              required
            />
          </div>

          <div class="inputGroup">
            <label for="lobbyGuestEmail">Email Address (optional)</label>
            <input
              id="lobbyGuestEmail"
              v-model="guestEmail"
              type="email"
              placeholder="e.g. john@example.com"
            />
          </div>

          <div class="inputGroup">
            <label for="lobbyGuestReason">Message to Host (optional)</label>
            <input
              id="lobbyGuestReason"
              v-model="guestReason"
              type="text"
              placeholder="e.g. Asking to join presentation"
            />
          </div>

          <div class="buttonRow">
            <button type="button" class="btnCancel" @click="exitLobby">Exit</button>
            <button type="submit" class="btnSubmit">Request to Join</button>
          </div>
        </form>

        <!-- Auth Forms -->
        <form v-else class="form" @submit.prevent="handleAuthSubmit">
          <p v-if="authError" class="errorAlert" role="alert">{{ authError }}</p>
          <h2 class="title">
            {{ activeTab === 'login' ? 'Sign In to Account' : 'Create an Account' }}
          </h2>
          <p class="sub">Registered accounts bypass the waiting lobby automatically.</p>

          <div v-if="activeTab === 'signup'" class="inputGroup">
            <label for="lobbyAuthName">Display Name</label>
            <input
              id="lobbyAuthName"
              v-model="authName"
              type="text"
              placeholder="John Doe"
              required
            />
          </div>

          <div class="inputGroup">
            <label for="lobbyAuthEmail">Email Address</label>
            <input
              id="lobbyAuthEmail"
              v-model="authEmail"
              type="email"
              placeholder="you@example.com"
              required
            />
          </div>

          <div class="inputGroup">
            <label for="lobbyAuthPassword">Password</label>
            <input
              id="lobbyAuthPassword"
              v-model="authPassword"
              type="password"
              placeholder="••••••••"
              required
            />
          </div>

          <div class="buttonRow">
            <button type="button" class="btnCancel" @click="exitLobby">Exit</button>
            <button type="submit" class="btnSubmit" :disabled="authLoading">
              {{ authLoading ? 'Loading...' : (activeTab === 'login' ? 'Sign In' : 'Sign Up') }}
            </button>
          </div>
        </form>
      </template>
    </div>
  </div>
</template>

<style scoped>
.lobby {
  position: fixed;
  inset: 0;
  z-index: 9000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 50% 50%, rgba(240, 244, 255, 0.95) 0%, rgba(228, 234, 255, 0.98) 100%);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  pointer-events: auto;
  animation: overlayFadeIn 0.3s ease-out;
}

@keyframes overlayFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.card {
  width: 100%;
  max-width: 440px;
  padding: 32px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(79, 110, 247, 0.15);
  border-radius: 24px;
  box-shadow: 0 30px 60px -15px rgba(30, 34, 64, 0.15), 0 10px 20px -5px rgba(30, 34, 64, 0.05);
  display: flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;
  animation: cardEnter 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes cardEnter {
  from { transform: scale(0.9) translateY(20px); opacity: 0; }
  to { transform: scale(1) translateY(0); opacity: 1; }
}

.iconCircle {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: bold;
  margin-bottom: 20px;
}

.errorIcon {
  background: #fff5f5;
  border: 2px solid #ffc9c9;
  color: #fa5252;
}

.spinner {
  width: 44px;
  height: 44px;
  border: 4px solid #e2e8f0;
  border-top-color: #4f6ef7;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 24px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.title {
  margin: 0 0 8px;
  font-size: 1.5rem;
  font-weight: 700;
  color: #1e2240;
  text-align: center;
}

.sub {
  margin: 0 0 24px;
  color: #6970a0;
  font-size: var(--fs-small, 14px);
  line-height: 1.5;
  text-align: center;
  font-weight: 500;
}

.textError {
  color: #fa5252;
}

.detailsPreview {
  width: 100%;
  padding: 12px 16px;
  background: #f8fafc;
  border: 1px solid rgba(79, 110, 247, 0.1);
  border-radius: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  box-sizing: border-box;
}

.previewLabel {
  font-size: 13px;
  font-weight: 600;
  color: #6970a0;
}

.previewValue {
  font-size: 14px;
  font-weight: 700;
  color: #1e2240;
}

.tabs {
  display: flex;
  width: 100%;
  border-bottom: 2px solid rgba(79, 110, 247, 0.1);
  margin-bottom: 24px;
}

.tab {
  flex: 1;
  background: transparent;
  border: none;
  padding: 12px 0;
  font-size: var(--fs-body, 15px);
  font-weight: 600;
  color: #6970a0;
  cursor: pointer;
  position: relative;
  transition: all 0.2s;
}

.tab.active {
  color: #4f6ef7;
}

.tab.active::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  right: 0;
  height: 3px;
  background: #4f6ef7;
  border-radius: 3px 3px 0 0;
}

.form {
  width: 100%;
  display: flex;
  flex-direction: column;
}

.errorAlert {
  background: #fff5f5;
  border: 1px solid #ffc9c9;
  color: #fa5252;
  padding: 12px;
  border-radius: 10px;
  font-size: var(--fs-small, 14px);
  margin-bottom: 16px;
  font-weight: 500;
  width: 100%;
  box-sizing: border-box;
}

.inputGroup {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
  width: 100%;
}

.inputGroup label {
  font-size: var(--fs-small, 13px);
  font-weight: 600;
  color: #1e2240;
}

.inputGroup input {
  padding: 11px 14px;
  border: 2px solid rgba(79, 110, 247, 0.15);
  border-radius: 10px;
  background: #fff;
  font-family: inherit;
  font-size: var(--fs-body, 14px);
  outline: none;
  transition: all 0.2s;
  box-sizing: border-box;
  width: 100%;
}

.inputGroup input:focus {
  border-color: #4f6ef7;
  box-shadow: 0 0 0 4px rgba(79, 110, 247, 0.15);
}

.buttonRow {
  display: flex;
  gap: 12px;
  width: 100%;
  margin-top: 12px;
}

.btnSubmit {
  flex: 2;
  background: linear-gradient(135deg, #4f6ef7 0%, #3e5cd9 100%);
  color: #fff;
  border: none;
  padding: 12px;
  font-size: var(--fs-body, 14px);
  font-weight: 600;
  border-radius: 10px;
  cursor: pointer;
  box-shadow: 0 4px 12px -2px rgba(79, 110, 247, 0.3);
  transition: all 0.2s;
}

.btnSubmit:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px -2px rgba(79, 110, 247, 0.4);
}

.btnSubmit:disabled {
  background: #cbd5e1;
  color: #64748b;
  cursor: not-allowed;
  box-shadow: none;
}

.btnCancel {
  flex: 1;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  color: #475569;
  padding: 12px;
  font-size: var(--fs-body, 14px);
  font-weight: 600;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.btnCancel:hover {
  background: #e2e8f0;
}

.btnExit {
  width: 100%;
  background: #fa5252;
  color: #fff;
  border: none;
  padding: 12px;
  font-size: var(--fs-body, 14px);
  font-weight: 600;
  border-radius: 10px;
  cursor: pointer;
  box-shadow: 0 4px 12px -2px rgba(250, 82, 82, 0.3);
  transition: all 0.2s;
}

.btnExit:hover {
  background: #e03131;
}
</style>
