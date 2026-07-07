<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '@/stores/authStore';

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const auth = useAuthStore();

const isLogin = ref(true);
const email = ref('');
const password = ref('');
const displayName = ref('');
const errorMsg = ref('');
const loading = ref(false);

const emailError = ref(false);
const passwordError = ref(false);
const displayNameError = ref(false);

async function handleSubmit() {
  const isEmailEmpty = !email.value.trim();
  const isPasswordEmpty = !password.value.trim();
  const isNameEmpty = !isLogin.value && !displayName.value.trim();

  emailError.value = isEmailEmpty;
  passwordError.value = isPasswordEmpty;
  displayNameError.value = isNameEmpty;

  if (isEmailEmpty || isPasswordEmpty || isNameEmpty) {
    errorMsg.value = 'Please fill out all fields.';
    return;
  }

  errorMsg.value = '';
  loading.value = true;

  try {
    if (isLogin.value) {
      await auth.login(email.value, password.value);
    } else {
      await auth.signup(email.value, password.value, displayName.value);
    }
    emit('close');
  } catch (err: any) {
    errorMsg.value = err.message || 'An error occurred. Please try again.';
  } finally {
    loading.value = false;
  }
}

async function handleGoogleLogin() {
  errorMsg.value = '';
  try {
    await auth.linkGoogleCalendar(); // Triggers Google login
  } catch (err: any) {
    errorMsg.value = err.message || 'Failed to start Google login.';
  }
}

function clearErrors() {
  emailError.value = false;
  passwordError.value = false;
  displayNameError.value = false;
  errorMsg.value = '';
}
</script>

<template>
  <!-- Backdrop for clicking outside to close -->
  <div class="dropdownBackdrop" @click="emit('close')" />

  <div class="modalCard">
      <button type="button" class="closeBtn" @click="emit('close')" aria-label="Close">
        &times;
      </button>
 
      <div class="tabs">
        <button
          type="button"
          class="tab"
          :class="{ active: isLogin }"
          @click="isLogin = true; clearErrors()"
        >
          Sign In
        </button>
        <button
          type="button"
          class="tab"
          :class="{ active: !isLogin }"
          @click="isLogin = false; clearErrors()"
        >
          Create Account
        </button>
      </div>

      <form class="form" novalidate @submit.prevent="handleSubmit">
        <p v-if="errorMsg" class="error" role="alert">{{ errorMsg }}</p>

        <div v-if="!isLogin" class="inputGroup">
          <label for="displayName">
            Display Name<span class="required-marker">*</span>
          </label>
          <input
            id="displayName"
            v-model="displayName"
            :class="{ 'input-error': displayNameError }"
            type="text"
            placeholder="John Doe"
            @input="displayNameError = false; errorMsg = ''"
          />
          <Transition name="tooltip-fade">
            <div v-if="displayNameError" class="custom-tooltip">Name is required</div>
          </Transition>
        </div>

        <div class="inputGroup">
          <label for="email">
            Email<span class="required-marker">*</span>
          </label>
          <input
            id="email"
            v-model="email"
            :class="{ 'input-error': emailError }"
            type="email"
            placeholder="you@example.com"
            @input="emailError = false; errorMsg = ''"
          />
          <Transition name="tooltip-fade">
            <div v-if="emailError" class="custom-tooltip">Email is required</div>
          </Transition>
        </div>

        <div class="inputGroup">
          <label for="password">
            Password<span class="required-marker">*</span>
          </label>
          <input
            id="password"
            v-model="password"
            :class="{ 'input-error': passwordError }"
            type="password"
            placeholder="••••••••"
            @input="passwordError = false; errorMsg = ''"
          />
          <Transition name="tooltip-fade">
            <div v-if="passwordError" class="custom-tooltip">Password is required</div>
          </Transition>
        </div>

        <button type="submit" class="submitBtn" :disabled="loading">
          {{ loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up') }}
        </button>
      </form>

      <div class="divider">
        <span>or continue with</span>
      </div>

      <div class="oauthButtons">
        <button type="button" class="oauthBtn google" @click="handleGoogleLogin">
          <svg class="oauthIcon" viewBox="0 0 24 24" width="18" height="18">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          Google
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

.modalCard {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 12px;
  background: #ffffff;
  border: 1px solid rgba(79, 110, 247, 0.15);
  border-radius: 20px;
  box-shadow: 0 20px 40px -10px rgba(30, 34, 64, 0.12), 0 5px 15px -3px rgba(30, 34, 64, 0.04);
  width: 360px;
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

.closeBtn {
  position: absolute;
  top: 12px;
  right: 12px;
  background: transparent;
  border: none;
  font-size: 20px;
  color: var(--color-mono30, #6970a0);
  cursor: pointer;
  width: 28px;
  height: 28px;
  line-height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  z-index: 10;
}

.closeBtn:hover {
  background-color: #f0f4ff;
  color: #4f6ef7;
}

.tabs {
  display: flex;
  border-bottom: 2px solid rgba(79, 110, 247, 0.1);
  margin-bottom: 24px;
  margin-right: 28px; /* Leave space for close button */
}

.tab {
  flex: 1;
  background: transparent;
  border: none;
  padding: 12px 0;
  font-size: var(--fs-body, 15px);
  font-weight: 600;
  color: var(--color-mono30, #6970a0);
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
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.error {
  background: #fff5f5;
  border: 1px solid #ffc9c9;
  color: #fa5252;
  padding: 12px;
  border-radius: 10px;
  font-size: var(--fs-small, 14px);
  margin: 0;
  font-weight: 500;
}

.inputGroup {
  display: flex;
  flex-direction: column;
  gap: 6px;
  position: relative;
}

.inputGroup label {
  font-size: var(--fs-small, 14px);
  font-weight: 600;
  color: var(--color-mono10, #1e2240);
  display: inline-flex;
  align-items: center;
}

.required-marker {
  color: #fa5252;
  margin-left: 3px;
  font-weight: bold;
}

.inputGroup input {
  padding: 11px 14px;
  border: 2px solid rgba(79, 110, 247, 0.15);
  border-radius: 10px;
  background: #fff;
  font-family: inherit;
  font-size: var(--fs-body, 15px);
  outline: none;
  transition: all 0.2s;
}

.inputGroup input:focus {
  border-color: #4f6ef7;
  box-shadow: 0 0 0 4px rgba(79, 110, 247, 0.15);
}

.inputGroup input.input-error {
  border-color: #fa5252 !important;
  background-color: #fff5f5 !important;
}

.inputGroup input.input-error:focus {
  box-shadow: 0 0 0 4px rgba(250, 82, 82, 0.15);
}

.submitBtn {
  background: linear-gradient(135deg, #4f6ef7 0%, #3e5cd9 100%);
  color: #fff;
  border: none;
  padding: 14px;
  font-size: var(--fs-body, 15px);
  font-weight: 600;
  border-radius: 12px;
  cursor: pointer;
  box-shadow: 0 8px 16px -4px rgba(79, 110, 247, 0.3);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  margin-top: 8px;
}

.submitBtn:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 24px -4px rgba(79, 110, 247, 0.4);
  background: linear-gradient(135deg, #5b79ff 0%, #4562df 100%);
}

.submitBtn:active {
  transform: translateY(0);
}

.submitBtn:disabled {
  background: #cbd5e1;
  color: #64748b;
  box-shadow: none;
  cursor: not-allowed;
}

.divider {
  display: flex;
  align-items: center;
  text-align: center;
  margin: 24px 0;
  color: var(--color-mono30, #6970a0);
  font-size: var(--fs-small, 13px);
  font-weight: 500;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid rgba(79, 110, 247, 0.15);
}

.divider:not(:empty)::before {
  margin-right: .8em;
}

.divider:not(:empty)::after {
  margin-left: .8em;
}

.oauthButtons {
  display: flex;
  gap: 12px;
}

.oauthBtn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 2px solid rgba(79, 110, 247, 0.15);
  background: #fff;
  border-radius: 12px;
  padding: 12px;
  font-size: var(--fs-small, 14px);
  font-weight: 600;
  color: var(--color-mono10, #1e2240);
  cursor: pointer;
  transition: all 0.2s;
}

.oauthBtn:hover {
  background: #f0f4ff;
  border-color: #4f6ef7;
  color: #4f6ef7;
}

.oauthIcon {
  flex-shrink: 0;
}

.custom-tooltip {
  position: absolute;
  left: 0;
  bottom: -22px;
  background: #fa5252;
  color: #fff;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(250, 82, 82, 0.2);
  z-index: 10;
  pointer-events: none;
  white-space: nowrap;
}

.custom-tooltip::before {
  content: '';
  position: absolute;
  top: -4px;
  left: 15px;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-bottom: 5px solid #fa5252;
}

/* Transitions */
.tooltip-fade-enter-active,
.tooltip-fade-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}
.tooltip-fade-enter-from,
.tooltip-fade-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}
</style>
