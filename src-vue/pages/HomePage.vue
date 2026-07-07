<script setup lang="ts">
import { onMounted, ref, computed, watch, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import AppHeader from '@/components/layout/AppHeader.vue';
import NameInputForm from '@/components/home/NameInputForm.vue';
import ScheduleModal, { type ScheduledMeeting } from '@/components/home/ScheduleModal.vue';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { useAuthStore } from '@/stores/authStore';
import { formatSphereName } from '@/utils/formatSphereName';
import AppIcon from '@/components/ui/AppIcon.vue';

const router = useRouter();
const route = useRoute();
const conference = useConferenceStore();
const local = useLocalStore();
const auth = useAuthStore();

const upcomingMeetings = ref<ScheduledMeeting[]>([]);
const showScheduleModal = ref(false);
const selectedMeeting = ref<ScheduledMeeting | null>(null);
const showNewMenu = ref(false);
const joinRoomName = ref('');
const errorMsg = ref('');
const infoMsg = ref('');

const meetingDefaults = ref({
  lobbyEnabled: false,
  stagePromotionEnabled: true,
  allowParticipantRecording: false,
  roomDefaults: {
    notes: false,
    whiteboard: false,
    poll: false,
    moderator: false,
  }
});

watch(
  meetingDefaults,
  (newVal) => {
    localStorage.setItem('loungemesh:meeting_defaults', JSON.stringify(newVal));
  },
  { deep: true }
);

onMounted(() => {
  local.stopAllLocalMedia();
  
  // Parse URL parameters for OAuth errors or warnings
  if (route.query.error) {
    if (route.query.error === 'oauth_failed') {
      errorMsg.value = 'Google Calendar integration failed. Please try again.';
    } else if (route.query.error === 'no_email') {
      errorMsg.value = 'Failed to get email from Google Account.';
    } else {
      errorMsg.value = `Authentication issue: ${route.query.error}`;
    }
    router.replace({ query: {} });
  }

  // Parse URL parameters for successful actions
  if (route.query.success === 'google_linked') {
    infoMsg.value = 'Google Calendar linked successfully!';
    setTimeout(() => { infoMsg.value = ''; }, 5000);
    router.replace({ query: {} });
  }

  // Load meeting defaults from localStorage
  const saved = localStorage.getItem('loungemesh:meeting_defaults');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      meetingDefaults.value = {
        lobbyEnabled: parsed.lobbyEnabled ?? false,
        stagePromotionEnabled: parsed.stagePromotionEnabled ?? true,
        allowParticipantRecording: parsed.allowParticipantRecording ?? false,
        roomDefaults: {
          notes: parsed.roomDefaults?.notes ?? false,
          whiteboard: parsed.roomDefaults?.whiteboard ?? false,
          poll: parsed.roomDefaults?.poll ?? false,
          moderator: false,
        }
      };
    } catch (err) {
      console.error('Failed to parse meeting defaults:', err);
    }
  }
});

// Reactively watch for auth state changes to fetch/clear upcoming meetings
let pollInterval: ReturnType<typeof setInterval> | null = null;
watch(
  () => auth.isAuthenticated,
  (isAuthenticated) => {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    if (isAuthenticated) {
      void fetchUpcoming();
      pollInterval = setInterval(() => {
        void fetchUpcoming();
      }, 5000);
    } else {
      upcomingMeetings.value = [];
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  if (pollInterval) {
    clearInterval(pollInterval);
  }
});

async function fetchUpcoming() {
  try {
    const response = await fetch('/api/meetings/upcoming');
    if (response.ok) {
      upcomingMeetings.value = await response.json();
    }
  } catch (err) {
    console.error('Failed to fetch upcoming meetings:', err);
  }
}

// Handler for guest name form submit
function goSessionGuest(payload: { displayName: string; sessionName: string }) {
  const name = formatSphereName(payload.displayName);
  conference.setDisplayName(name);
  conference.setConferenceName(payload.sessionName);
  router.push(`/session/${payload.sessionName}`);
}

// Handler for logged-in join
function goSessionAuth(room: string) {
  if (!room.trim()) return;
  const name = formatSphereName(auth.user?.displayName || 'User');
  conference.setDisplayName(name);
  conference.setConferenceName(room.trim());
  router.push(`/session/${room.trim()}`);
}

// Create an instant meeting
async function startInstantMeeting() {
  showNewMenu.value = false;
  const roomName = `meet-${Math.random().toString(36).substring(2, 9)}`;
  
  try {
    const response = await fetch('/api/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Instant Meeting',
        roomName,
        isScheduled: false,
        lobbyEnabled: meetingDefaults.value.lobbyEnabled,
        stagePromotionEnabled: meetingDefaults.value.stagePromotionEnabled,
        allowParticipantRecording: meetingDefaults.value.allowParticipantRecording,
        roomDefaults: meetingDefaults.value.roomDefaults,
      }),
    });

    if (response.ok) {
      goSessionAuth(roomName);
    } else {
      // Fallback directly to room join if database failed
      goSessionAuth(roomName);
    }
  } catch (err) {
    console.error('Instant meeting create failed:', err);
    goSessionAuth(roomName);
  }
}

function openScheduleNew() {
  selectedMeeting.value = null;
  showScheduleModal.value = true;
  showNewMenu.value = false;
}

function openModifyMeeting(meet: ScheduledMeeting) {
  selectedMeeting.value = meet;
  showScheduleModal.value = true;
}

async function cancelMeeting(id: string) {
  if (!confirm('Are you sure you want to cancel this scheduled meeting?')) return;

  try {
    const response = await fetch(`/api/meetings/${id}`, {
      method: 'DELETE',
    });

    if (response.ok) {
      infoMsg.value = 'Meeting cancelled.';
      await fetchUpcoming();
      setTimeout(() => { infoMsg.value = ''; }, 3000);
    } else {
      errorMsg.value = 'Failed to cancel meeting.';
    }
  } catch (err) {
    console.error('Cancel meeting error:', err);
    errorMsg.value = 'Failed to cancel meeting.';
  }
}

function copyLink(roomName: string) {
  const link = `${window.location.protocol}//${window.location.host}/enter/${roomName}`;
  void navigator.clipboard.writeText(link);
  infoMsg.value = 'Meeting link copied to clipboard!';
  setTimeout(() => { infoMsg.value = ''; }, 3000);
}

function formatMeetingDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function canEditMeeting(meet: ScheduledMeeting): boolean {
  if (!auth.user?.id) return false;
  if (meet.hostId === auth.user.id) return true;
  if (meet.configs?.userGrants) {
    try {
      const grants = JSON.parse(meet.configs.userGrants);
      if (grants[auth.user.id]?.moderator) {
        return true;
      }
    } catch (err) {
      console.error('Error parsing userGrants in client:', err);
    }
  }
  return false;
}

function getUserRole(meet: ScheduledMeeting): 'host' | 'moderator' | null {
  if (!auth.user?.id) return null;
  if (meet.hostId === auth.user.id) return 'host';
  if (meet.configs?.userGrants) {
    try {
      const grants = JSON.parse(meet.configs.userGrants);
      if (grants[auth.user.id]?.moderator) {
        return 'moderator';
      }
    } catch (err) {
      // ignore
    }
  }
  return null;
}
</script>

<template>
  <div class="home">
    <div class="dashboardBackdrop" aria-hidden="true">
      <div class="ambient-glow-1"></div>
      <div class="ambient-glow-2"></div>
    </div>
    <AppHeader variant="home" />
    <main class="page">
      <div class="container">
        
        <!-- Header Section (spans full width) -->
        <header class="dashboardHeader">
          <h1 class="title">LoungeMesh</h1>
          <p class="sub">Spatial video lounges for informal online events</p>
          
          <p v-if="errorMsg" class="alert error" role="alert">{{ errorMsg }}</p>
          <p v-if="infoMsg" class="alert info" role="status">{{ infoMsg }}</p>
        </header>

        <!-- Main Dashboard Columns Grid -->
        <div class="dashboardGrid">
          <!-- Left Column Wrapper -->
          <div class="leftGridColumn">
            <!-- Action Dashboard (Left Column) -->
            <div class="dashboardColumn mainActions">
            <!-- Loading state when checking authentication session -->
            <div v-if="auth.loading" class="loadingDashboard" role="status">
              <div class="spinner"></div>
              <p>Loading your dashboard...</p>
            </div>

            <!-- Authenticated View: Direct actions to create or join meetings -->
            <div v-else-if="auth.isAuthenticated" class="authDashboard">
              <h2 class="sectionTitle">Host or join a meeting</h2>
              <div class="actionCardsGrid">
                
                <!-- Card 1: Start Instant Meeting -->
                <div class="actionCard">
                  <div class="cardIcon green">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                      <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                    </svg>
                  </div>
                  <h3>Instant Session</h3>
                  <p>Create a room right now, jump in, and share the invitation link.</p>
                  <button type="button" class="cardBtn primary" @click="startInstantMeeting">
                    Start meeting
                  </button>
                </div>

                <!-- Card 2: Schedule Meeting -->
                <div class="actionCard">
                  <div class="cardIcon blue">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                      <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zm-7 5h5v5h-5z"/>
                    </svg>
                  </div>
                  <h3>Schedule Event</h3>
                  <p>Plan a single or recurring meeting synced with Google Calendar.</p>
                  <button type="button" class="cardBtn secondary" @click="openScheduleNew">
                    Schedule meeting
                  </button>
                </div>

                <!-- Card 3: Join Room -->
                <div class="actionCard">
                  <div class="cardIcon orange">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                      <path d="M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 12H5v-2h6v2zm0-4H5v-2h6v2zm0-4H5V7h6v2zm9 8h-6v-2h6v2zm0-4h-6v-2h6v2zm0-4h-6V7h6v2z"/>
                    </svg>
                  </div>
                  <h3>Join Meeting</h3>
                  <p>Enter a meeting code or room name to join an active session.</p>
                  <div class="cardInputGroup">
                    <input
                      v-model="joinRoomName"
                      type="text"
                      placeholder="Enter code"
                      class="cardJoinInput"
                      @keyup.enter="goSessionAuth(joinRoomName)"
                    />
                    <button
                      type="button"
                      class="cardJoinBtn"
                      :disabled="!joinRoomName.trim()"
                      @click="goSessionAuth(joinRoomName)"
                    >
                      Join
                    </button>
                  </div>
                </div>

              </div>
            </div>

            <!-- Unauthenticated View: Join as guest with name input form -->
            <div v-else class="guestDashboard">
              <NameInputForm @submit="goSessionGuest" />
              
              <div class="authCtaBanner">
                <div class="ctaIcon">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                  </svg>
                </div>
                <div class="ctaContent">
                  <h4>Unlock Scheduling & Custom Integrations</h4>
                  <p>Sign in to schedule events in advance, sync directly with Google Calendar, and unlock full moderator roles.</p>
                  <button type="button" class="ctaLinkBtn" @click="auth.showAuthPrompt = true">
                    Sign In / Create Account &rarr;
                  </button>
                </div>
              </div>
            </div>
          </div>

            <!-- General Settings (Below Actions) -->
            <div v-if="auth.isAuthenticated" class="generalSettingsSection">
              <h2 class="sectionTitle">General meeting settings</h2>
              <p class="sectionSub">These defaults will apply to your hosted meetings. You can still modify them inside each active session.</p>
              
              <div class="dashboardColumn generalSettingsCard">
                <div class="settingsTogglesGrid">
                <!-- Group 1: Moderation Controls -->
                <div class="settingsGroup">
                  <h4 class="groupTitle">Session Moderation</h4>
                  <div class="groupToggles">
                    <label class="toggleRow">
                      <span class="toggleLabel">
                        <strong>Enable Lobby Room</strong>
                      </span>
                      <input type="checkbox" v-model="meetingDefaults.lobbyEnabled" class="toggleCheckbox" />
                    </label>

                    <label class="toggleRow">
                      <span class="toggleLabel">
                        <strong>Allow Presenter Promotion</strong>
                      </span>
                      <input type="checkbox" v-model="meetingDefaults.stagePromotionEnabled" class="toggleCheckbox" />
                    </label>

                    <label class="toggleRow">
                      <span class="toggleLabel">
                        <strong>Allow Local Recording</strong>
                      </span>
                      <input type="checkbox" v-model="meetingDefaults.allowParticipantRecording" class="toggleCheckbox" />
                    </label>
                  </div>
                </div>

                <!-- Group 2: Default Guest Permissions -->
                <div class="settingsGroup">
                  <h4 class="groupTitle">Guest Permissions</h4>
                  <div class="groupToggles">
                    <label class="toggleRow">
                      <span class="toggleLabel">
                        <strong>Allow Edit Notes</strong>
                      </span>
                      <input type="checkbox" v-model="meetingDefaults.roomDefaults.notes" class="toggleCheckbox" />
                    </label>

                    <label class="toggleRow">
                      <span class="toggleLabel">
                        <strong>Allow Whiteboard Draw</strong>
                      </span>
                      <input type="checkbox" v-model="meetingDefaults.roomDefaults.whiteboard" class="toggleCheckbox" />
                    </label>

                    <label class="toggleRow">
                      <span class="toggleLabel">
                        <strong>Allow Creating Polls</strong>
                      </span>
                      <input type="checkbox" v-model="meetingDefaults.roomDefaults.poll" class="toggleCheckbox" />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </div>

          <!-- Upcoming Meetings (Right Column) -->
          <div class="dashboardColumn upcomingSection">
            <div class="upcomingHeader">
              <div class="upcomingTitleRow">
                <svg class="headerIcon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <h3>Your upcoming meetings</h3>
                <span v-if="upcomingMeetings.length > 0" class="meetingCountBadge">
                  {{ upcomingMeetings.length }}
                </span>
              </div>
            </div>

            <div v-if="!auth.isAuthenticated" class="unauthPlaceholder">
              <p>Sign in to schedule and see your upcoming meetings here.</p>
            </div>

            <div v-else-if="upcomingMeetings.length === 0" class="emptyPlaceholder">
              <p>No upcoming meetings scheduled yet.</p>
            </div>

            <div v-else class="meetingsList">
              <div
                v-for="meet in upcomingMeetings"
                :key="meet.id"
                :class="['meetingCard', getUserRole(meet) === 'host' ? 'host-role' : '', getUserRole(meet) === 'moderator' ? 'moderator-role' : '']"
              >
                <div class="cardMainContent">
                  <div class="titleRow">
                    <span class="meetTitle">{{ meet.title }}</span>
                    <span v-if="getUserRole(meet) === 'host'" class="roleBadge host">Host</span>
                    <span v-else-if="getUserRole(meet) === 'moderator'" class="roleBadge moderator">Mod</span>
                    <span v-if="meet.recurrence && meet.recurrence !== 'NONE'" class="recurrenceBadge">
                      {{ meet.recurrence.toLowerCase() }}
                    </span>
                  </div>
                  <div class="timeRow">
                    <svg class="timeIcon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <span class="timeText">{{ formatMeetingDate(meet.startTime) }}</span>
                    <span v-if="meet.guestEmails && meet.guestEmails.length > 0" class="cardGuestCount" :title="meet.guestEmails.join(', ')">
                      <svg class="guestIcon" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                      </svg>
                      {{ meet.guestEmails.length }}
                    </span>
                  </div>
                </div>
                <div class="cardActions">
                  <button type="button" class="actionBtn copy" title="Copy invitation link" @click="copyLink(meet.roomName)">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="btnIcon">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    <span>Link</span>
                  </button>
                  <button type="button" class="actionBtn join primary" title="Join session" @click="goSessionAuth(meet.roomName)">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="btnIcon">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                      <polyline points="15 3 21 3 21 9"></polyline>
                      <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                    <span>Join</span>
                  </button>
                  <button v-if="canEditMeeting(meet)" type="button" class="actionBtn edit" title="Modify details" @click="openModifyMeeting(meet)">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="btnIcon">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                  <button v-if="canEditMeeting(meet)" type="button" class="actionBtn cancel" title="Cancel meeting" @click="cancelMeeting(meet.id)">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="btnIcon">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Features Showcase Section (Whitespace filler with rich aesthetics) -->
        <section class="featuresSection">
          <h3 class="featuresTitle">Experience Next-Gen Spatial Collaboration</h3>
          <div class="featuresGrid">
            <div class="featureCard">
              <div class="featureIcon blue">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                </svg>
              </div>
              <h4>Spatial Audio Lounges</h4>
              <p>Move around the virtual room. Audio levels adjust naturally based on your relative position and distance.</p>
            </div>

            <div class="featureCard">
              <div class="featureIcon green">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-6 14H7v-2h6v2zm3-4H7v-2h9v2zm0-4H7V7h9v2z"/>
                </svg>
              </div>
              <h4>Interactive Whiteboard</h4>
              <p>Draw, sketch, and brainstorm ideas in real-time with automatic persistence across participant updates.</p>
            </div>

            <div class="featureCard">
              <div class="featureIcon orange">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                  <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                </svg>
              </div>
              <h4>Collaborative Notes</h4>
              <p>Type meeting minutes, save outlines, and share rich text summaries instantly with the entire room.</p>
            </div>

            <div class="featureCard">
              <div class="featureIcon red">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z"/>
                </svg>
              </div>
              <h4>Moderator Controls</h4>
              <p>Configure lobbies, manage presenter promotion requests, and adjust permissions to maintain security.</p>
            </div>

            <div class="featureCard">
              <div class="featureIcon purple">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                  <path d="M21 3H3c-1.11 0-2 .89-2 2v12c0 1.1.89 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.11-.9-2-2-2zm0 14H3V5h18v12z"/>
                </svg>
              </div>
              <h4>Presenter Mode</h4>
              <p>Centralize presentation screens, focus media feeds, and run interactive presenter-led sessions easily.</p>
            </div>

            <div class="featureCard">
              <div class="featureIcon teal">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
                </svg>
              </div>
              <h4>Real-Time Audience Polls</h4>
              <p>Create, launch, and publish interactive polls during meetings to instantly capture audience feedback.</p>
            </div>
          </div>
        </section>

      </div>
    </main>

    <ScheduleModal
      v-if="showScheduleModal"
      :meeting="selectedMeeting"
      @close="showScheduleModal = false"
      @saved="fetchUpcoming"
    />
  </div>
</template>

<style scoped>
.home {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: radial-gradient(circle at 8% 18%, rgba(228, 234, 255, 1) 0%, rgba(242, 245, 255, 1) 50%, rgba(255, 255, 255, 1) 100%);
  position: relative;
  overflow-x: hidden;
}

.dashboardBackdrop {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

.ambient-glow-1 {
  position: absolute;
  top: -150px;
  left: -150px;
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, rgba(79, 110, 247, 0.18) 0%, rgba(79, 110, 247, 0) 70%);
  filter: blur(60px);
  pointer-events: none;
  z-index: 0;
}

.ambient-glow-2 {
  position: absolute;
  bottom: -150px;
  right: -150px;
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, rgba(226, 112, 34, 0.08) 0%, rgba(226, 112, 34, 0) 70%);
  filter: blur(60px);
  pointer-events: none;
  z-index: 0;
}
 
.page {
  flex: 1;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 24px 24px;
  position: relative;
  z-index: 1;
}
 
.container {
  display: flex;
  flex-direction: column;
  gap: 40px;
  max-width: 1600px;
  width: 92%;
}

.dashboardHeader {
  text-align: left;
}

.dashboardGrid {
  display: grid;
  grid-template-columns: 1.35fr 0.65fr;
  gap: 32px;
  align-items: stretch;
}
 
@media (max-width: 820px) {
  .dashboardGrid {
    grid-template-columns: 1fr;
    gap: 28px;
  }
}
 
.dashboardColumn {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 20px;
  padding: 32px;
  box-shadow: 0 20px 40px -15px rgba(30, 34, 64, 0.04), 0 1px 3px rgba(30, 34, 64, 0.01);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease, border-color 0.3s ease;
}

.leftGridColumn {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.sectionSub {
  font-size: 0.88rem;
  color: var(--color-mono30, #6970a0);
  margin: -8px 0 20px;
  font-weight: 500;
  line-height: 1.45;
  text-align: left;
}

.settingsTogglesGrid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

@media (max-width: 640px) {
  .settingsTogglesGrid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}

.settingsGroup {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.groupTitle {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 750;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-mono30, #6970a0);
  border-bottom: 1px solid rgba(79, 110, 247, 0.12);
  padding-bottom: 4px;
}

.groupToggles {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.toggleRow {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(79, 110, 247, 0.08);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.toggleRow:hover {
  background: #ffffff;
  border-color: rgba(79, 110, 247, 0.2);
  box-shadow: 0 4px 10px rgba(79, 110, 247, 0.03);
}

.toggleLabel {
  display: flex;
  flex-direction: column;
  text-align: left;
}

.toggleLabel strong {
  font-size: 0.88rem;
  color: var(--color-mono10, #1e2240);
  font-weight: 650;
}

/* Custom Switch Toggle styling on the checkboxes */
.toggleCheckbox {
  appearance: none;
  -webkit-appearance: none;
  width: 36px;
  height: 20px;
  border-radius: 20px;
  background: rgba(79, 110, 247, 0.15);
  position: relative;
  outline: none;
  cursor: pointer;
  transition: background 0.25s, border-color 0.25s;
  flex-shrink: 0;
  border: 1px solid rgba(79, 110, 247, 0.1);
}

.toggleCheckbox:checked {
  background: #4f6ef7;
  border-color: #4f6ef7;
}

.toggleCheckbox::before {
  content: '';
  position: absolute;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  top: 2px;
  left: 2px;
  background: #fff;
  transition: transform 0.25s;
  box-shadow: 0 1px 3px rgba(30, 34, 64, 0.15);
}

.toggleCheckbox:checked::before {
  transform: translateX(16px);
}

/* Styling for generalSettingsSection and generalSettingsCard */
.generalSettingsSection {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  text-align: left;
}

.generalSettingsCard {
  padding: 20px 24px;
}

.generalSettingsCard .settingsTogglesGrid {
  gap: 16px;
}

.generalSettingsCard .groupTitle {
  font-size: 0.8rem;
  padding-bottom: 4px;
  margin-bottom: 10px;
}

.generalSettingsCard .groupToggles {
  gap: 8px;
}

.generalSettingsCard .toggleRow {
  padding: 8px 12px;
  border-radius: 10px;
}

.generalSettingsCard .toggleLabel strong {
  font-size: 0.82rem;
}

.dashboardColumn:hover {
  transform: translateY(-4px);
  border-color: rgba(79, 110, 247, 0.25);
  box-shadow: 0 30px 60px -20px rgba(79, 110, 247, 0.12), 0 1px 4px rgba(79, 110, 247, 0.02);
}
 
.mainActions {
  justify-content: flex-start;
  height: fit-content;
}
 
.title {
  margin: 0 0 12px;
  font-size: 2.85rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.1;
  background: linear-gradient(135deg, #1e2240 20%, #4f6ef7 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
 
.sub {
  font-weight: 500;
  font-size: 1.15rem;
  margin: 0 0 20px;
  color: var(--color-mono30, #3b4068);
  line-height: 1.5;
}
 
.alert {
  position: fixed;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 12000;
  padding: 12px 24px;
  border-radius: 12px;
  font-size: var(--fs-small, 14px);
  font-weight: 600;
  box-shadow: 0 10px 30px -5px rgba(30, 34, 64, 0.2);
  animation: alertFadeIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes alertFadeIn {
  from { opacity: 0; transform: translate(-50%, -15px) scale(0.95); }
  to { opacity: 1; transform: translate(-50%, 0) scale(1); }
}
 
.alert.error {
  background: #fff5f5;
  border: 1px solid #ffc9c9;
  color: #fa5252;
}
 
.alert.info {
  background: #f0f4ff;
  border: 1px solid #d0ebff;
  color: #228be6;
}
 
.authDashboard {
  margin-top: 8px;
}
 
.actionsRow {
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
}
 
.newMenuWrapper {
  position: relative;
}
 
.newMeetBtn {
  background: linear-gradient(135deg, #4f6ef7 0%, #3e5cd9 100%);
  color: #fff;
  border: none;
  height: 50px;
  padding: 0 24px;
  font-size: var(--fs-body, 15px);
  font-weight: 600;
  border-radius: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 8px 16px -4px rgba(79, 110, 247, 0.3);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
}
 
.newMeetBtn:hover {
  transform: translateY(-2px) scale(1.01);
  box-shadow: 0 12px 24px -4px rgba(79, 110, 247, 0.4);
  background: linear-gradient(135deg, #5b79ff 0%, #4562df 100%);
}

.newMeetBtn:active {
  transform: translateY(0) scale(0.98);
}
 
.dropdownMenu {
  position: absolute;
  top: 58px;
  left: 0;
  background: #fff;
  border: 1px solid rgba(79, 110, 247, 0.15);
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 10px 10px -5px rgba(0, 0, 0, 0.03);
  width: 230px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  padding: 8px 0;
  animation: dropdownEnter 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes dropdownEnter {
  from { transform: translateY(8px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
 
.menuItem {
  background: transparent;
  border: none;
  padding: 11px 18px;
  text-align: left;
  font-size: var(--fs-small, 14px);
  color: var(--color-mono10, #1e2240);
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: all 0.15s;
}
 
.menuItem:hover {
  background: #f0f4ff;
  color: #4f6ef7;
}

.menuItem svg {
  flex-shrink: 0;
}
 
.joinInputGroup {
  display: flex;
  flex: 1;
  min-width: 240px;
  border: 2px solid rgba(79, 110, 247, 0.15);
  border-radius: 12px;
  overflow: hidden;
  height: 50px;
  background: #fff;
  transition: all 0.25s;
}
 
.joinInputGroup:focus-within {
  border-color: #4f6ef7;
  box-shadow: 0 0 0 4px rgba(79, 110, 247, 0.15);
}
 
.joinInput {
  flex: 1;
  border: none;
  outline: none;
  padding: 0 18px;
  font-size: var(--fs-body, 15px);
  font-family: inherit;
  font-weight: 500;
}
 
.joinBtn {
  background: transparent;
  border: none;
  color: #4f6ef7;
  font-weight: 600;
  font-size: var(--fs-body, 15px);
  padding: 0 24px;
  cursor: pointer;
  transition: all 0.2s;
}
 
.joinBtn:hover:not(:disabled) {
  background: #f0f4ff;
  color: #3e5cd9;
}
 
.joinBtn:disabled {
  color: #a5b4fc;
  cursor: not-allowed;
}
 
/* Upcoming Section Styling */
.upcomingSection {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.upcomingHeader {
  margin-bottom: 20px;
}

.upcomingTitleRow {
  display: flex;
  align-items: center;
  gap: 10px;
}

.upcomingTitleRow h3 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 750;
  color: var(--color-mono10, #1e2240);
  letter-spacing: -0.01em;
}

.headerIcon {
  color: #4f6ef7;
  flex-shrink: 0;
}

.meetingCountBadge {
  background: linear-gradient(135deg, rgba(79, 110, 247, 0.1) 0%, rgba(79, 110, 247, 0.2) 100%);
  color: #4f6ef7;
  font-size: 0.78rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 20px;
  border: 1px solid rgba(79, 110, 247, 0.15);
}
 
.unauthPlaceholder,
.emptyPlaceholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--color-mono30, #6970a0);
  font-size: var(--fs-small, 14px);
  padding: 32px 24px;
  border: 2px dashed rgba(79, 110, 247, 0.2);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.4);
}

.meetingsList {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  padding: 4px;
  box-sizing: border-box;
  scrollbar-width: thin;
  scrollbar-color: rgba(79, 110, 247, 0.15) transparent;
}

.meetingsList::-webkit-scrollbar {
  width: 6px;
}

.meetingsList::-webkit-scrollbar-track {
  background: transparent;
}

.meetingsList::-webkit-scrollbar-thumb {
  background: rgba(79, 110, 247, 0.15);
  border-radius: 10px;
}

.meetingsList::-webkit-scrollbar-thumb:hover {
  background: rgba(79, 110, 247, 0.3);
}

.meetingCard {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid rgba(79, 110, 247, 0.08);
  border-left: 4px solid rgba(79, 110, 247, 0.35); /* default role border */
  border-radius: 12px;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 12px rgba(30, 34, 64, 0.02);
  gap: 12px;
}

.meetingCard.host-role {
  border-left-color: #4f6ef7; /* blue host border */
}

.meetingCard.moderator-role {
  border-left-color: #9333ea; /* purple moderator border */
}

.meetingCard:hover {
  transform: translateY(-1px);
  border-color: rgba(79, 110, 247, 0.2);
  background: #ffffff;
  box-shadow: 0 8px 20px rgba(79, 110, 247, 0.08);
}

.cardMainContent {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  text-align: left;
}

.titleRow {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.meetTitle {
  font-weight: 700;
  font-size: 0.92rem;
  color: var(--color-mono10, #1e2240);
  letter-spacing: -0.01em;
}

.roleBadge {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 20px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  letter-spacing: 0.02em;
  line-height: 1;
}

.roleBadge::before {
  content: '';
  width: 4px;
  height: 4px;
  border-radius: 50%;
  display: inline-block;
}

.roleBadge.host {
  background: rgba(79, 110, 247, 0.08);
  color: #4f6ef7;
  border: 1px solid rgba(79, 110, 247, 0.15);
}

.roleBadge.host::before {
  background-color: #4f6ef7;
}

.roleBadge.moderator {
  background: rgba(147, 51, 234, 0.08);
  color: #9333ea;
  border: 1px solid rgba(147, 51, 234, 0.15);
}

.roleBadge.moderator::before {
  background-color: #9333ea;
}

.recurrenceBadge {
  background: #eef2ff;
  color: #4f6ef7;
  font-size: 8px;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.timeRow {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.78rem;
  color: var(--color-mono30, #6970a0);
  font-weight: 500;
}

.timeText {
  white-space: nowrap;
}

.timeIcon, .guestIcon {
  color: var(--color-mono30, #8fa0dd);
  flex-shrink: 0;
}

.cardGuestCount {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  background: rgba(79, 110, 247, 0.05);
  color: #4f6ef7;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 1px 4px;
  border-radius: 4px;
  margin-left: 6px;
}

.cardActions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.actionBtn {
  background: #fff;
  border: 1px solid rgba(79, 110, 247, 0.18);
  height: 28px;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-mono30, #3b4068);
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.actionBtn:hover {
  background: #f0f4ff;
  border-color: #4f6ef7;
  color: #4f6ef7;
}

.actionBtn.copy {
  padding: 0 10px;
}

.actionBtn.join.primary {
  background: #4f6ef7;
  color: #fff;
  border-color: #4f6ef7;
  padding: 0 10px;
}

.actionBtn.join.primary:hover {
  background: #3b5bdb;
  border-color: #3b5bdb;
  color: #fff;
}

.actionBtn.edit, .actionBtn.cancel {
  padding: 0;
  width: 28px;
}

.actionBtn.cancel {
  border-color: #ffc9c9;
  color: #fa5252;
}

.actionBtn.cancel:hover {
  background: #fff5f5;
  border-color: #fa5252;
  color: #fa5252;
}

.btnIcon {
  flex-shrink: 0;
  color: currentColor;
}


/* Loading Dashboard State */
.loadingDashboard {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 16px;
  gap: 16px;
  color: var(--color-mono30, #6970a0);
  font-weight: 500;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(79, 110, 247, 0.1);
  border-left-color: #4f6ef7;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Section Title */
.sectionTitle {
  margin: 0 0 16px;
  font-size: 1.25rem;
  font-weight: 750;
  color: var(--color-mono10, #1e2240);
  letter-spacing: -0.01em;
}

/* Action Cards Grid */
.actionCardsGrid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
  margin-top: 8px;
}

@media (max-width: 980px) {
  .actionCardsGrid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}

.actionCard {
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(79, 110, 247, 0.12);
  border-radius: 16px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 12px rgba(30, 34, 64, 0.02);
}

.actionCard:hover {
  transform: translateY(-2px);
  border-color: rgba(79, 110, 247, 0.3);
  background: #ffffff;
  box-shadow: 0 12px 24px rgba(79, 110, 247, 0.08);
}

.cardIcon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
}

.cardIcon.green {
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
}

.cardIcon.blue {
  background: rgba(79, 110, 247, 0.1);
  color: #4f6ef7;
}

.cardIcon.orange {
  background: rgba(249, 115, 22, 0.1);
  color: #ea580c;
}

.actionCard h3 {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--color-mono10, #1e2240);
}

.actionCard p {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.45;
  color: var(--color-mono30, #6970a0);
  font-weight: 500;
  flex-grow: 1; /* Pushes button to bottom */
}

.cardBtn {
  width: 100%;
  height: 42px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cardBtn.primary {
  background: linear-gradient(135deg, #4f6ef7 0%, #3e5cd9 100%);
  color: #fff;
  border: none;
  box-shadow: 0 4px 10px rgba(79, 110, 247, 0.2);
}

.cardBtn.primary:hover {
  background: linear-gradient(135deg, #5b79ff 0%, #4562df 100%);
  transform: translateY(-1px);
}

.cardBtn.secondary {
  background: #ffffff;
  color: #4f6ef7;
  border: 1.5px solid rgba(79, 110, 247, 0.25);
}

.cardBtn.secondary:hover {
  background: #f0f4ff;
  border-color: #4f6ef7;
  transform: translateY(-1px);
}

/* Card Input Group (Join Room Card) */
.cardInputGroup {
  display: flex;
  border: 1.5px solid rgba(79, 110, 247, 0.2);
  border-radius: 10px;
  overflow: hidden;
  height: 42px;
  background: #fff;
  transition: all 0.2s;
}

.cardInputGroup:focus-within {
  border-color: #4f6ef7;
  box-shadow: 0 0 0 3px rgba(79, 110, 247, 0.12);
}

.cardJoinInput {
  flex: 1;
  border: none;
  outline: none;
  padding: 0 10px;
  font-size: 14px;
  font-family: inherit;
  font-weight: 500;
  width: 100%;
}

.cardJoinBtn {
  background: transparent;
  border: none;
  color: #4f6ef7;
  font-weight: 700;
  font-size: 14px;
  padding: 0 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.cardJoinBtn:hover:not(:disabled) {
  background: #f0f4ff;
}

.cardJoinBtn:disabled {
  color: #a5b4fc;
  cursor: not-allowed;
}

/* Guest Auth CTA Banner */
.authCtaBanner {
  margin-top: 32px;
  background: rgba(79, 110, 247, 0.05);
  border: 1px solid rgba(79, 110, 247, 0.15);
  border-radius: 16px;
  padding: 20px;
  display: flex;
  gap: 16px;
  align-items: flex-start;
  text-align: left;
  animation: bannerFadeIn 0.3s ease-out;
}

@keyframes bannerFadeIn {
  from { opacity: 0; transform: translateY(-10px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.ctaIcon {
  color: #4f6ef7;
  flex-shrink: 0;
  margin-top: 2px;
}

.ctaContent {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ctaContent h4 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-mono10, #1e2240);
}

.ctaContent p {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.5;
  color: var(--color-mono30, #6970a0);
  font-weight: 500;
}

.ctaLinkBtn {
  align-self: flex-start;
  background: transparent;
  border: none;
  color: #4f6ef7;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  padding: 4px 0;
  margin-top: 4px;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
}

.ctaLinkBtn:hover {
  color: #3e5cd9;
  transform: translateX(3px);
}

.cardGuestCount {
  color: #4f6ef7;
  font-weight: 600;
  margin-left: 4px;
}

/* Features Section Styling */
.featuresSection {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.featuresTitle {
  font-size: 1.4rem;
  font-weight: 800;
  color: var(--color-mono10, #1e2240);
  letter-spacing: -0.02em;
  text-align: center;
  margin: 0;
}

.featuresGrid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

@media (max-width: 1024px) {
  .featuresGrid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .featuresGrid {
    grid-template-columns: 1fr;
  }
}

.featureCard {
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 18px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 10px 20px -10px rgba(30, 34, 64, 0.03);
}

.featureCard:hover {
  transform: translateY(-4px);
  background: rgba(255, 255, 255, 0.85);
  border-color: rgba(79, 110, 247, 0.25);
  box-shadow: 0 20px 30px -10px rgba(79, 110, 247, 0.1);
}

.featureIcon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.featureIcon.blue {
  background: rgba(79, 110, 247, 0.1);
  color: #4f6ef7;
}

.featureIcon.green {
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
}

.featureIcon.orange {
  background: rgba(249, 115, 22, 0.1);
  color: #ea580c;
}

.featureIcon.red {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.featureIcon.purple {
  background: rgba(168, 85, 247, 0.1);
  color: #a855f7;
}

.featureIcon.teal {
  background: rgba(20, 184, 166, 0.1);
  color: #0d9488;
}

.featureCard h4 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-mono10, #1e2240);
}

.featureCard p {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.5;
  color: var(--color-mono30, #6970a0);
  font-weight: 500;
}
</style>
