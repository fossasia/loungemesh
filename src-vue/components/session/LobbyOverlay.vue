<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { useAuthStore } from '@/stores/authStore';
import { useMediaEngine } from '@/composables/useMediaEngine';
import AppIcon from '@/components/ui/AppIcon.vue';

const features = useSessionFeaturesStore();
const conference = useConferenceStore();
const local = useLocalStore();
const auth = useAuthStore();
const { engine, leaveRoom, disconnect } = useMediaEngine();
const router = useRouter();

// Waiting form fields
const guestName = ref('');
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
  if (features.lobbyForm === 'details' && !guestEmail.value.trim()) {
    errorMsg.value = 'Please enter your email.';
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
  if (local.id) {
    engine.sendCommand('lobby', JSON.stringify({ action: 'cancel', id: local.id }));
  }
  features.resetForLeave();
  await local.stopAllLocalMedia();
  leaveRoom();
  conference.leaveConference();
  disconnect();
  if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
    window.parent.postMessage({ source: 'loungemesh', action: 'leave', event: 'hangup', type: 'hangup' }, '*');
  } else {
    router.push('/');
  }
}
</script>

<template>
  <div v-if="features.configLoaded && features.isLobbyBlocked" class="lobby">
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
        <div class="gmeetRadar" aria-hidden="true">
          <div class="radarRing ring1"></div>
          <div class="radarRing ring2"></div>
          <div class="radarRing ring3"></div>
          <div class="radarCore">
            <AppIcon name="user" :size="28" />
          </div>
        </div>
        <h2 class="title">Asking to join...</h2>
        <p class="sub">
          Lobby mode is on. Please wait. The host will admit you shortly.
        </p>
        <div class="detailsPreview" v-if="guestName">
          <span class="previewLabel">Requesting as:</span>
          <span class="previewValue">{{ guestName }}</span>
        </div>

        <!-- Live device preview toggles while waiting in lobby -->
        <div class="deviceToggles">
          <button
            type="button"
            class="deviceBtn"
            :class="{ active: !local.mute, warning: local.mute }"
            @click="local.toggleMute()"
            :title="local.mute ? 'Unmute microphone' : 'Mute microphone'"
          >
            <AppIcon :name="local.mute ? 'mic-off' : 'mic'" :size="16" />
            <span>{{ local.mute ? 'Mic Off' : 'Mic On' }}</span>
          </button>
          <button
            type="button"
            class="deviceBtn"
            :class="{ active: !local.cameraOff, warning: local.cameraOff }"
            @click="local.toggleCamera()"
            :title="local.cameraOff ? 'Turn on camera' : 'Turn off camera'"
          >
            <AppIcon :name="local.cameraOff ? 'video-off' : 'video'" :size="16" />
            <span>{{ local.cameraOff ? 'Camera Off' : 'Camera On' }}</span>
          </button>
        </div>

        <button type="button" class="btnCancel" @click="exitLobby">
          Cancel Request
        </button>
      </template>

      <!-- Form View -->
      <template v-else>
        <!-- Card Tabs -->
        <div class="authLinks">
          <button type="button" class="authSwitch" @click="activeTab = activeTab === 'guest' ? 'login' : 'guest'">
            {{ activeTab === 'guest' ? 'Have an invited email? Sign in' : 'Ask to join instead' }}
          </button>
          <button
            v-if="activeTab !== 'guest'"
            type="button"
            class="authSwitch"
            @click="activeTab = activeTab === 'login' ? 'signup' : 'login'"
          >
            {{ activeTab === 'login' ? 'Create an account' : 'Sign in instead' }}
          </button>
        </div>

        <!-- Guest Join Form -->
        <form v-if="activeTab === 'guest'" class="form" @submit.prevent="requestJoin">
          <p v-if="errorMsg" class="errorAlert" role="alert">{{ errorMsg }}</p>
          <h2 class="title">Request Entry</h2>
          <p class="sub">
            {{ features.lobbyForm === 'details'
              ? 'Enter your name and email. The host will admit you.'
              : 'Enter your name. The host will admit you.' }}
          </p>
          
          <div class="inputGroup">
            <label for="lobbyGuestName">Name <span class="requiredMark">Required</span></label>
            <input
              id="lobbyGuestName"
              v-model="guestName"
              type="text"
              autocomplete="off"
              required
            />
          </div>

          <div v-if="features.lobbyForm === 'details'" class="inputGroup">
            <label for="lobbyGuestEmail">Email <span class="requiredMark">Required</span></label>
            <input
              id="lobbyGuestEmail"
              v-model="guestEmail"
              type="email"
              autocomplete="off"
              required
            />
          </div>

          <div v-if="features.lobbyForm === 'details'" class="inputGroup">
            <label for="lobbyGuestReason">Message to the host</label>
            <input
              id="lobbyGuestReason"
              v-model="guestReason"
              type="text"
              autocomplete="off"
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
          <p class="sub">Sign in with the email that was invited. Any other account still waits for the host.</p>

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
  background: var(--color-bg-page);
  padding: 24px;
  box-sizing: border-box;
  overflow: auto;
  pointer-events: auto;
}

@keyframes overlayFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.card {
  width: 100%;
  max-width: 440px;
  padding: 40px 32px;
  background: var(--color-bg-card);
  border: 1px solid var(--line-light);
  border-radius: var(--radius-round);
  color: var(--color-mono10);
  display: flex;
  flex-direction: column;
  align-items: stretch;
  text-align: center;
  box-sizing: border-box;
}

.authLinks {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 8px;
}

.authSwitch {
  border: none;
  background: transparent;
  color: var(--color-blue100);
  font-family: var(--font-body);
  font-size: var(--fs-small);
  cursor: pointer;
  padding: 4px;
}

@media (max-width: 640px) {
  .lobby {
    padding: 16px;
    align-items: flex-start;
  }
  .card {
    padding: 28px 18px;
  }
  .buttonRow {
    flex-direction: column;
  }
  .buttonRow button {
    width: 100%;
  }
  .inputGroup input {
    font-size: 16px;
  }
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
  background: var(--color-bg-card);
  border: 2px solid var(--color-red100);
  color: var(--color-red100);
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
  background: var(--color-bg-card);
  border: 1px solid var(--color-red100);
  color: var(--color-red100);
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
  color: var(--color-mono10);
}

.requiredMark {
  color: var(--color-red100);
  font-size: 0.75rem;
  font-weight: 600;
  margin-left: 6px;
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
  background: var(--color-red100);
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
  background: var(--btn-warning-bg-hover);
}

/* Google Meet style Waiting Lobby Radar & Device Controls */
.gmeetRadar {
  position: relative;
  width: 96px;
  height: 96px;
  margin: 0 auto 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.radarCore {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4);
  z-index: 2;
}

.radarRing {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid rgba(79, 110, 247, 0.4);
  animation: radarPulse 2.4s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
}

.radarRing.ring2 {
  animation-delay: 0.8s;
}

.radarRing.ring3 {
  animation-delay: 1.6s;
}

@keyframes radarPulse {
  0% {
    transform: scale(0.6);
    opacity: 0.8;
  }
  100% {
    transform: scale(1.35);
    opacity: 0;
  }
}

.deviceToggles {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin: 16px 0 20px;
}

.deviceBtn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 9999px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-text-default);
  transition: all 0.2s ease;
}

.deviceBtn:hover {
  background: rgba(255, 255, 255, 0.16);
  transform: translateY(-1px);
}

.deviceBtn.warning {
  border-color: var(--color-red100);
  background: var(--color-bg-card);
  color: var(--color-red100);
}

.deviceBtn.active {
  border-color: rgba(34, 197, 94, 0.4);
  background: rgba(34, 197, 94, 0.12);
  color: #22c55e;
}
</style>
