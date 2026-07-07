<script setup lang="ts">
import { ref } from 'vue';
import { playUiSound } from '@/utils/uiSounds';

const username = ref('');
const sessionName = ref('');
const nameError = ref(false);
const sessionError = ref(false);

const emit = defineEmits<{
  submit: [payload: { displayName: string; sessionName: string }];
}>();

function onSubmit(e: Event) {
  e.preventDefault();
  const user = username.value.trim();
  const room = sessionName.value.trim();

  nameError.value = user.length === 0;
  sessionError.value = room.length === 0;

  if (!nameError.value && !sessionError.value) {
    playUiSound('success');
    emit('submit', { displayName: user, sessionName: room });
  }
}
</script>

<template>
  <form class="form" novalidate @submit="onSubmit">
    <div class="field-container">
      <label class="label" for="username">
        Your name<span class="required-marker">*</span>
      </label>
      <div class="input-wrapper">
        <input
          id="username"
          v-model="username"
          class="input full"
          :class="{ 'input-error': nameError }"
          type="text"
          name="username"
          placeholder="e.g. Alex"
          autocomplete="nickname"
          @input="nameError = false"
        />
        <Transition name="tooltip-fade">
          <div v-if="nameError" class="custom-tooltip">Name is required</div>
        </Transition>
      </div>
    </div>

    <div class="field-container">
      <label class="label roomLabel" for="sessionName">
        Session name<span class="required-marker">*</span>
      </label>
      <div class="input-wrapper">
        <fieldset class="fieldset">
          <input
            id="sessionName"
            v-model="sessionName"
            class="input"
            :class="{ 'input-error': sessionError }"
            type="text"
            name="sessionName"
            placeholder="e.g. meet-lounge"
            @input="sessionError = false"
          />
          <input class="join" name="joinButton" type="submit" value="Join" />
        </fieldset>
        <Transition name="tooltip-fade">
          <div v-if="sessionError" class="custom-tooltip">Session name is required</div>
        </Transition>
      </div>
    </div>
  </form>
</template>

<style scoped>
.form {
  width: 340px;
  margin: auto;
  text-align: left;
}
.field-container {
  margin-bottom: 24px;
}
.label {
  font-size: var(--fs-small);
  color: var(--color-text-default);
  font-weight: 600;
  display: inline-flex;
  align-items: center;
}
.required-marker {
  color: #fa5252;
  margin-left: 3px;
  font-weight: bold;
}
.roomLabel {
  display: block;
}
.fieldset {
  border: none;
  padding: 0;
  margin: 10px 0 0;
  display: flex;
  flex-direction: row;
}
.input-wrapper {
  position: relative;
}
.input {
  height: 50px;
  flex: 1;
  background: var(--input-bg);
  color: var(--color-text-default);
  border: 1px solid var(--line-dark);
  font-size: var(--fs-body);
  box-sizing: border-box;
  border-radius: var(--radius-sm) 0 0 var(--radius-sm);
  padding-left: 20px;
  font-family: var(--font-body);
  transition: border-color 0.2s, box-shadow 0.2s;
}
.input.full {
  width: 100%;
  margin-top: 8px;
  border-radius: var(--radius-sm);
}
.input:hover {
  border: 1px solid var(--color-blue100);
}
.input:focus {
  outline: none;
  border-color: #4f6ef7;
  box-shadow: 0 0 0 3px rgba(79, 110, 247, 0.12);
}
.input.input-error {
  border-color: #fa5252 !important;
  background-color: #fff5f5;
}
.input.input-error:focus {
  box-shadow: 0 0 0 3px rgba(250, 82, 82, 0.15);
}
.join {
  height: 50px;
  background: var(--btn-primary-bg);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  width: 111px;
  color: var(--btn-primary-fg);
  font-size: var(--fs-body);
  border: none;
  cursor: pointer;
  font-family: var(--font-body);
}
.join:hover {
  background-color: var(--color-mono95);
  color: var(--btn-default-fg);
}
.custom-tooltip {
  position: absolute;
  left: 0;
  bottom: -28px;
  background: #fa5252;
  color: #fff;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: var(--radius-sm, 6px);
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
