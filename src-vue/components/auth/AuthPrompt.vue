<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '@/stores/authStore';
import AppIcon from '@/components/ui/AppIcon.vue';

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

async function handleSubmit() {
  if (!email.value || !password.value || (!isLogin.value && !displayName.value)) {
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
          @click="isLogin = true; errorMsg = ''"
        >
          Sign In
        </button>
        <button
          type="button"
          class="tab"
          :class="{ active: !isLogin }"
          @click="isLogin = false; errorMsg = ''"
        >
          Create Account
        </button>
      </div>

      <form class="form" @submit.prevent="handleSubmit">
        <p v-if="errorMsg" class="error" role="alert">{{ errorMsg }}</p>

        <div v-if="!isLogin" class="inputGroup">
          <label for="displayName">Display Name</label>
          <input
            id="displayName"
            v-model="displayName"
            type="text"
            placeholder="John Doe"
            required
          />
        </div>

        <div class="inputGroup">
          <label for="email">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            placeholder="you@example.com"
            required
          />
        </div>

        <div class="inputGroup">
          <label for="password">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            placeholder="••••••••"
            required
          />
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
            <path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114A5.69 5.69 0 0 1 8.3 12.825a5.69 5.69 0 0 1 5.691-5.69c2.32 0 4.12 1.34 4.88 3.14l3.52-1.74A9.9 9.9 0 0 0 13.99 4.5a9.99 9.99 0 0 0-9.99 9.99 9.99 9.99 0 0 0 9.99 9.99 9.38 9.38 0 0 0 9.69-9.52c0-.68-.08-1.34-.23-1.99H12.24Z"/>
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
  top: 18px;
  right: 18px;
  background: transparent;
  border: none;
  font-size: 24px;
  color: var(--color-mono30, #6970a0);
  cursor: pointer;
  width: 36px;
  height: 36px;
  line-height: 36px;
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
}
 
.inputGroup label {
  font-size: var(--fs-small, 14px);
  font-weight: 600;
  color: var(--color-mono10, #1e2240);
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
</style>
