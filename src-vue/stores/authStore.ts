import { defineStore } from 'pinia';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  googleId?: string | null;
  googleToken?: string | null;
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as UserProfile | null,
    isAuthenticated: false,
    loading: true,
    showAuthPrompt: false,
  }),
  getters: {
    isGoogleLinked(): boolean {
      return !!this.user?.googleId;
    },
    userAvatarUrl(): string {
      return this.user?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(this.user?.displayName || 'guest')}`;
    },
  },
  actions: {
    async checkAuth() {
      this.loading = true;
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          this.user = await response.json();
          this.isAuthenticated = true;
        } else {
          this.user = null;
          this.isAuthenticated = false;
        }
      } catch (err) {
        console.error('Failed to check auth:', err);
        this.user = null;
        this.isAuthenticated = false;
      } finally {
        this.loading = false;
      }
    },

    async signup(email: string, password: string, displayName: string) {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Signup failed');
      }

      await this.checkAuth();
    },

    async login(email: string, password: string) {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Login failed');
      }

      await this.checkAuth();
    },

    async logout() {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch (err) {
        console.error('Logout error:', err);
      } finally {
        this.user = null;
        this.isAuthenticated = false;
      }
    },

    async updateProfile(displayName: string, avatarUrl?: string | null) {
      const response = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, avatarUrl }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Profile update failed');
      }

      this.user = await response.json();
    },

    async linkGoogleCalendar() {
      try {
        const response = await fetch('/api/auth/google');
        if (!response.ok) throw new Error('Failed to initiate Google link');
        const data = await response.json();
        if (data.url) {
          window.location.href = data.url;
        }
      } catch (err) {
        console.error('Link Google Calendar error:', err);
        throw err;
      }
    },
  },
});
