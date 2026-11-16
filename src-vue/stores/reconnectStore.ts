import { defineStore } from 'pinia';
import {
  type ReconnectPhase,
  MAX_RECONNECT_ATTEMPTS,
  getDelayForAttempt,
} from '@/utils/reconnectPolicy';

export type ReconnectState = {
  phase: ReconnectPhase;
  attempt: number;
  secondsLeft: number;
  lastReason: string;
  isIntentionalLeave: boolean;
};

export const useReconnectStore = defineStore('reconnect', {
  state: (): ReconnectState => ({
    phase: 'online',
    attempt: 0,
    secondsLeft: 0,
    lastReason: '',
    isIntentionalLeave: false,
  }),

  actions: {
    _delayTimer: undefined as number | undefined,
    _countdownTimer: undefined as number | undefined,
    _recoveryTimer: undefined as number | undefined,
    _retryAction: undefined as (() => Promise<void> | void) | undefined,

    setRetryAction(action: (() => Promise<void> | void) | undefined) {
      this._retryAction = action;
    },

    setIntentionalLeave(val: boolean) {
      this.isIntentionalLeave = val;
      if (val) {
        this.clearTimers();
        this.phase = 'online';
        this.attempt = 0;
        this.secondsLeft = 0;
      }
    },

    clearTimers() {
      if (this._delayTimer !== undefined) {
        window.clearTimeout(this._delayTimer);
        this._delayTimer = undefined;
      }
      if (this._countdownTimer !== undefined) {
        window.clearInterval(this._countdownTimer);
        this._countdownTimer = undefined;
      }
      if (this._recoveryTimer !== undefined) {
        window.clearTimeout(this._recoveryTimer);
        this._recoveryTimer = undefined;
      }
    },

    onConnectionLost(reason = 'connection_lost') {
      if (this.isIntentionalLeave) return;
      if (this.phase === 'waiting') return;

      this.lastReason = reason;
      this.clearTimers();

      const nextAttempt = this.attempt + 1;
      const delay = getDelayForAttempt(nextAttempt);

      if (delay === null) {
        this.phase = 'exhausted';
        this.attempt = MAX_RECONNECT_ATTEMPTS;
        this.secondsLeft = 0;
        return;
      }

      this.attempt = nextAttempt;
      this.phase = 'waiting';
      this.secondsLeft = Math.ceil(delay / 1000);

      this._countdownTimer = window.setInterval(() => {
        if (this.secondsLeft > 1) {
          this.secondsLeft -= 1;
        } else {
          this.secondsLeft = 0;
          window.clearInterval(this._countdownTimer);
          this._countdownTimer = undefined;
        }
      }, 1000);

      this._delayTimer = window.setTimeout(() => {
        void this.triggerAttempt();
      }, delay);
    },

    async triggerAttempt() {
      this.clearTimers();
      this.phase = 'attempting';
      this.secondsLeft = 0;

      if (this._retryAction) {
        try {
          await this._retryAction();
        } catch {
          // Failure to initiate triggers next cycle
          this.phase = 'online'; // allow onConnectionLost to schedule next
          this.onConnectionLost(this.lastReason);
        }
      }
    },

    retryNow() {
      if (this.phase === 'online') return;
      if (this.phase === 'exhausted') {
        this.attempt = 0;
      }
      void this.triggerAttempt();
    },

    onConnectionRecovered() {
      this.clearTimers();
      const wasDisconnected = this.phase !== 'online';
      if (wasDisconnected) {
        this.phase = 'recovered';
        this.attempt = 0;
        this.secondsLeft = 0;
        this._recoveryTimer = window.setTimeout(() => {
          this.phase = 'online';
          this._recoveryTimer = undefined;
        }, 2500);
      } else {
        this.phase = 'online';
        this.attempt = 0;
        this.secondsLeft = 0;
      }
    },

    reset() {
      this.clearTimers();
      this.phase = 'online';
      this.attempt = 0;
      this.secondsLeft = 0;
      this.lastReason = '';
      this.isIntentionalLeave = false;
      this._retryAction = undefined;
    },
  },
});
