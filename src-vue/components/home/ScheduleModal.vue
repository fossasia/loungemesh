<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuthStore } from '@/stores/authStore';
import NotesEditor from '@/components/session/NotesEditor.vue';

export interface ScheduledMeeting {
  id: string;
  title: string;
  roomName: string;
  startTime: string | null;
  endTime: string | null;
  recurrence: string | null;
  googleEventId?: string | null;
  guestEmails?: string[];
  hostId: string;
  configs?: {
    userGrants?: string | null;
  } | null;
  description?: string | null;
}

const props = defineProps<{
  meeting?: ScheduledMeeting | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'saved'): void;
}>();

const auth = useAuthStore();

const title = ref('');
const description = ref('');
const date = ref('');
const time = ref('');
const duration = ref(30); // default 30 mins
const recurrence = ref('NONE');
const syncGoogleCal = ref(true);
const errorMsg = ref('');
const loading = ref(false);

const titleError = ref(false);
const dateError = ref(false);
const timeError = ref(false);

const guestEmails = ref<string[]>([]);
const emailInput = ref('');
const emailError = ref('');

const moderatorEmails = ref<string[]>([]);
const modEmailInput = ref('');
const modEmailError = ref('');

function addGuestEmail() {
  const rawInput = emailInput.value;
  if (!rawInput) return;

  const parts = rawInput.split(/[,\s;]+/);
  let addedAny = false;
  let hasInvalid = false;
  const invalidParts: string[] = [];

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  for (const part of parts) {
    const email = part.trim().toLowerCase();
    if (!email) continue;

    if (!emailRegex.test(email)) {
      hasInvalid = true;
      invalidParts.push(part);
      continue;
    }

    if (!guestEmails.value.includes(email)) {
      guestEmails.value.push(email);
      addedAny = true;
    }
  }

  if (hasInvalid) {
    emailError.value = `Invalid email address(es): ${invalidParts.join(', ')}`;
    emailInput.value = invalidParts.join(', ');
  } else {
    emailError.value = '';
    emailInput.value = '';
  }
}

function removeGuestEmail(index: number) {
  guestEmails.value.splice(index, 1);
}

function handleEmailKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ',' || e.key === ' ' || e.key === 'Tab') {
    e.preventDefault();
    addGuestEmail();
  }
}

function addModEmail() {
  const rawInput = modEmailInput.value;
  if (!rawInput) return;

  const parts = rawInput.split(/[,\s;]+/);
  let addedAny = false;
  let hasInvalid = false;
  const invalidParts: string[] = [];

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  for (const part of parts) {
    const email = part.trim().toLowerCase();
    if (!email) continue;

    if (!emailRegex.test(email)) {
      hasInvalid = true;
      invalidParts.push(part);
      continue;
    }

    if (!moderatorEmails.value.includes(email)) {
      moderatorEmails.value.push(email);
      addedAny = true;
    }
  }

  if (hasInvalid) {
    modEmailError.value = `Invalid email address(es): ${invalidParts.join(', ')}`;
    modEmailInput.value = invalidParts.join(', ');
  } else {
    modEmailError.value = '';
    modEmailInput.value = '';
  }
}

function removeModEmail(index: number) {
  moderatorEmails.value.splice(index, 1);
}

function handleModEmailKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ',' || e.key === ' ' || e.key === 'Tab') {
    e.preventDefault();
    addModEmail();
  }
}

onMounted(() => {
  if (props.meeting) {
    title.value = props.meeting.title;
    description.value = props.meeting.description || '';
    recurrence.value = props.meeting.recurrence || 'NONE';
    syncGoogleCal.value = !!props.meeting.googleEventId;
    guestEmails.value = (props.meeting as any).guestEmails ? [...(props.meeting as any).guestEmails] : [];
    moderatorEmails.value = (props.meeting as any).moderatorEmails ? [...(props.meeting as any).moderatorEmails] : [];

    if (props.meeting.startTime) {
      const startDate = new Date(props.meeting.startTime);
      
      // Format to YYYY-MM-DD
      const year = startDate.getFullYear();
      const month = String(startDate.getMonth() + 1).padStart(2, '0');
      const day = String(startDate.getDate()).padStart(2, '0');
      date.value = `${year}-${month}-${day}`;
      
      // Format to HH:MM
      const hours = String(startDate.getHours()).padStart(2, '0');
      const minutes = String(startDate.getMinutes()).padStart(2, '0');
      time.value = `${hours}:${minutes}`;

      if (props.meeting.endTime) {
        const endDate = new Date(props.meeting.endTime);
        const diffMs = endDate.getTime() - startDate.getTime();
        duration.value = Math.max(15, Math.floor(diffMs / 60000));
      }
    }
  } else {
    // Default: Set date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const day = String(tomorrow.getDate()).padStart(2, '0');
    date.value = `${year}-${month}-${day}`;
    time.value = '12:00';
  }
});

async function handleSubmit() {
  const isTitleEmpty = !title.value.trim();
  const isDateEmpty = !date.value.trim();
  const isTimeEmpty = !time.value.trim();

  titleError.value = isTitleEmpty;
  dateError.value = isDateEmpty;
  timeError.value = isTimeEmpty;

  if (isTitleEmpty || isDateEmpty || isTimeEmpty) {
    errorMsg.value = 'Please enter a title, date, and time.';
    return;
  }

  errorMsg.value = '';
  loading.value = true;

  try {
    const startDateTime = new Date(`${date.value}T${time.value}`);
    const endDateTime = new Date(startDateTime.getTime() + duration.value * 60 * 1000);
    const roomName = props.meeting?.roomName || `meet-${Math.random().toString(36).substring(2, 9)}`;

    // Load meeting defaults from localStorage
    let lobbyEnabled = false;
    let stagePromotionEnabled = true;
    let allowParticipantRecording = false;
    let roomDefaults = {
      notes: false,
      whiteboard: false,
      poll: false,
      moderator: false,
    };

    const savedDefaults = localStorage.getItem('loungemesh:meeting_defaults');
    if (savedDefaults) {
      try {
        const parsed = JSON.parse(savedDefaults);
        lobbyEnabled = parsed.lobbyEnabled ?? false;
        stagePromotionEnabled = parsed.stagePromotionEnabled ?? true;
        allowParticipantRecording = parsed.allowParticipantRecording ?? false;
        if (parsed.roomDefaults) {
          roomDefaults = {
            notes: parsed.roomDefaults.notes ?? false,
            whiteboard: parsed.roomDefaults.whiteboard ?? false,
            poll: parsed.roomDefaults.poll ?? false,
            moderator: false,
          };
        }
      } catch (err) {
        console.error('Failed to parse meeting defaults in ScheduleModal:', err);
      }
    }

    const payload = {
      title: title.value.trim(),
      description: description.value.trim(),
      roomName,
      isScheduled: true,
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      recurrence: recurrence.value,
      syncGoogleCal: syncGoogleCal.value && auth.isGoogleLinked,
      guestEmails: guestEmails.value,
      moderatorEmails: moderatorEmails.value,
      lobbyEnabled,
      stagePromotionEnabled,
      allowParticipantRecording,
      roomDefaults,
    };

    if (props.meeting) {
      // Modify
      const response = await fetch(`/api/meetings/${props.meeting.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update meeting');
      }
    } else {
      // Create
      const response = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to schedule meeting');
      }
    }

    emit('saved');
    emit('close');
  } catch (err: any) {
    errorMsg.value = err.message || 'An error occurred. Please try again.';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="modalBackdrop" @click.self="emit('close')">
    <div class="modalCard">
      <div class="modalHeader">
        <h3>{{ props.meeting ? 'Modify Meeting' : 'Schedule Meeting' }}</h3>
        <button type="button" class="closeBtn" @click="emit('close')" aria-label="Close">
          &times;
        </button>
      </div>

      <p v-if="errorMsg" class="error" role="alert">{{ errorMsg }}</p>

      <form class="form" novalidate @submit.prevent="handleSubmit">
        <div class="inputGroup">
          <label for="meetTitle">
            Meeting Title<span class="required-marker">*</span>
          </label>
          <input
            id="meetTitle"
            v-model="title"
            :class="{ 'input-error': titleError }"
            type="text"
            placeholder="Weekly Synup, Design Sync..."
            @input="titleError = false; errorMsg = ''"
          />
          <Transition name="tooltip-fade">
            <div v-if="titleError" class="custom-tooltip">Title is required</div>
          </Transition>
        </div>

        <div class="inputGroup">
          <label>Description</label>
          <NotesEditor
            v-model="description"
            placeholder="Agenda, objectives, links..."
            class="descriptionEditor"
          />
        </div>

        <div class="row">
          <div class="inputGroup half">
            <label for="meetDate">
              Start Date<span class="required-marker">*</span>
            </label>
            <input
              id="meetDate"
              v-model="date"
              :class="{ 'input-error': dateError }"
              type="date"
              @input="dateError = false; errorMsg = ''"
            />
            <Transition name="tooltip-fade">
              <div v-if="dateError" class="custom-tooltip">Date is required</div>
            </Transition>
          </div>

          <div class="inputGroup half">
            <label for="meetTime">
              Start Time<span class="required-marker">*</span>
            </label>
            <input
              id="meetTime"
              v-model="time"
              :class="{ 'input-error': timeError }"
              type="time"
              @input="timeError = false; errorMsg = ''"
            />
            <Transition name="tooltip-fade">
              <div v-if="timeError" class="custom-tooltip">Time is required</div>
            </Transition>
          </div>
        </div>

        <div class="row">
          <div class="inputGroup half">
            <label for="meetDuration">Duration</label>
            <select id="meetDuration" v-model="duration">
              <option :value="15">15 Minutes</option>
              <option :value="30">30 Minutes</option>
              <option :value="45">45 Minutes</option>
              <option :value="60">1 Hour</option>
              <option :value="90">1.5 Hours</option>
              <option :value="120">2 Hours</option>
            </select>
          </div>

          <div class="inputGroup half">
            <label for="meetRecurrence">Recurrence</label>
            <select id="meetRecurrence" v-model="recurrence">
              <option value="NONE">Do not repeat</option>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </div>
        </div>

        <div class="checkboxGroup">
          <label class="checkboxLabel">
            <input
              type="checkbox"
              v-model="syncGoogleCal"
              :disabled="!auth.isGoogleLinked"
            />
            <span class="labelText">Sync to Google Calendar</span>
          </label>
          <span v-if="!auth.isGoogleLinked" class="linkPrompt">
            (Link Google Calendar in your profile settings first)
          </span>
        </div>

        <!-- Guest Emails Tags/Chips Input -->
        <div class="inputGroup">
          <label for="guestEmailInput">Invite Guests (by email)</label>
          <div class="chipsContainer">
            <div v-for="(email, idx) in guestEmails" :key="email" class="chip">
              <span class="chipText" :title="email">{{ email }}</span>
              <button type="button" class="removeChipBtn" @click="removeGuestEmail(idx)" aria-label="Remove guest">
                &times;
              </button>
            </div>
            <input
              id="guestEmailInput"
              v-model="emailInput"
              type="text"
              placeholder="Type email and press Enter, Comma, or Space"
              class="chipInput"
              @keydown="handleEmailKeydown"
              @blur="addGuestEmail"
            />
          </div>
          <span v-if="emailError" class="inputError" role="alert">{{ emailError }}</span>
        </div>

        <!-- Moderator Emails Tags/Chips Input -->
        <div class="inputGroup">
          <label for="modEmailInput">Invite Moderators (by email)</label>
          <div class="chipsContainer">
            <div v-for="(email, idx) in moderatorEmails" :key="email" class="chip">
              <span class="chipText" :title="email">{{ email }}</span>
              <button type="button" class="removeChipBtn" @click="removeModEmail(idx)" aria-label="Remove moderator">
                &times;
              </button>
            </div>
            <input
              id="modEmailInput"
              v-model="modEmailInput"
              type="text"
              placeholder="Type email and press Enter, Comma, or Space"
              class="chipInput"
              @keydown="handleModEmailKeydown"
              @blur="addModEmail"
            />
          </div>
          <span v-if="modEmailError" class="inputError" role="alert">{{ modEmailError }}</span>
        </div>

        <button type="submit" class="submitBtn" :disabled="loading">
          {{ loading ? 'Saving...' : (props.meeting ? 'Save Changes' : 'Schedule') }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.modalBackdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  z-index: 11000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
 
.modalCard {
  background: #ffffff;
  border: 1px solid rgba(79, 110, 247, 0.15);
  border-radius: 20px;
  box-shadow: 0 30px 60px -15px rgba(30, 34, 64, 0.15), 0 10px 20px -5px rgba(30, 34, 64, 0.05);
  width: 100%;
  max-width: 480px;
  padding: 24px;
  position: relative;
  display: flex;
  flex-direction: column;
  animation: modalEnter 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
 
@keyframes modalEnter {
  from {
    transform: scale(0.92) translateY(15px);
    opacity: 0;
  }
  to {
    transform: scale(1) translateY(0);
    opacity: 1;
  }
}
 
.modalHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
 
.modalHeader h3 {
  margin: 0;
  font-size: var(--fs-h2, 1.25rem);
  font-weight: 700;
  color: var(--color-mono10, #1e2240);
}
 
.closeBtn {
  background: transparent;
  border: none;
  font-size: 24px;
  color: var(--color-mono30, #6970a0);
  cursor: pointer;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
 
.closeBtn:hover {
  background-color: #f0f4ff;
  color: #4f6ef7;
}
 
.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 65vh;
  overflow-y: auto;
  padding-right: 6px;
}

.descriptionEditor {
  height: 140px;
  max-height: 140px;
}
 
.error {
  background: #fff5f5;
  border: 1px solid #ffc9c9;
  color: #fa5252;
  padding: 12px;
  border-radius: 10px;
  font-size: var(--fs-small, 14px);
  margin-bottom: 20px;
  font-weight: 500;
}
 
.inputGroup {
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
}
 
.inputGroup label {
  font-size: var(--fs-small, 14px);
  font-weight: 600;
  color: var(--color-mono10, #1e2240);
  display: inline-flex;
  align-items: center;
}
 
.inputGroup input,
.inputGroup select {
  padding: 11px 14px;
  border: 2px solid rgba(79, 110, 247, 0.15);
  border-radius: 10px;
  background: #fff;
  font-family: inherit;
  font-size: var(--fs-body, 15px);
  outline: none;
  box-sizing: border-box;
  transition: all 0.2s;
}
 
.inputGroup input:focus,
.inputGroup select:focus {
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

.required-marker {
  color: #fa5252;
  margin-left: 3px;
  font-weight: bold;
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
 
.row {
  display: flex;
  gap: 16px;
}
 
.half {
  flex: 1;
}
 
.checkboxGroup {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
  padding: 12px;
  background: #f8fafc;
  border: 1px solid rgba(79, 110, 247, 0.1);
  border-radius: 12px;
}
 
.checkboxLabel {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-size: var(--fs-small, 14px);
  font-weight: 600;
  color: var(--color-mono10, #1e2240);
}
 
.checkboxLabel input {
  cursor: pointer;
  width: 18px;
  height: 18px;
  border: 2px solid rgba(79, 110, 247, 0.3);
  border-radius: 4px;
  outline: none;
  accent-color: #4f6ef7;
}
 
.labelText {
  line-height: 1;
}
 
.linkPrompt {
  font-size: var(--fs-small, 12px);
  color: var(--color-mono30, #6970a0);
  padding-left: 28px;
  font-weight: 500;
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
  transform: none;
}

/* Guest Emails Chips Input Styles */
.chipsContainer {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 10px;
  border: 2px solid rgba(79, 110, 247, 0.15);
  border-radius: 10px;
  background: #fff;
  min-height: 42px;
  box-sizing: border-box;
  align-items: center;
  transition: all 0.2s;
}

.chipsContainer:focus-within {
  border-color: #4f6ef7;
  box-shadow: 0 0 0 4px rgba(79, 110, 247, 0.15);
}

.chip {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #f0f4ff;
  border: 1px solid rgba(79, 110, 247, 0.2);
  border-radius: 8px;
  padding: 4px 8px;
  font-size: 13px;
  color: #4f6ef7;
  font-weight: 600;
  max-width: 100%;
}

.chipText {
  user-select: none;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}

.removeChipBtn {
  background: transparent;
  border: none;
  font-size: 16px;
  line-height: 1;
  color: #6970a0;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  transition: all 0.15s;
  flex-shrink: 0;
}

.removeChipBtn:hover {
  background: rgba(250, 82, 82, 0.1);
  color: #fa5252;
}

.chipInput {
  flex: 1;
  border: none !important;
  outline: none !important;
  padding: 2px 0 !important;
  font-size: 14px !important;
  min-width: 150px;
  background: transparent !important;
  box-shadow: none !important;
}

.inputError {
  font-size: 12px;
  color: #fa5252;
  margin-top: 4px;
  font-weight: 500;
}
</style>
