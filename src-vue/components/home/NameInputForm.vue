<script setup lang="ts">
import { ref } from 'vue';
import { conferenceNameDefault } from '@/config/jitsiOptions';
import { playUiSound } from '@/utils/uiSounds';

const username = ref('');
const sessionName = ref('');

const emit = defineEmits<{
  submit: [payload: { displayName: string; sessionName: string }];
}>();

function onSubmit(e: Event) {
  e.preventDefault();
  const user = username.value.trim();
  const room = (sessionName.value || conferenceNameDefault).trim();
  if (room.length > 0) {
    playUiSound('success');
    emit('submit', { displayName: user, sessionName: room });
  }
}
</script>

<template>
  <form class="form" @submit="onSubmit">
    <label class="label" for="username">Your name</label>
    <input
      id="username"
      v-model="username"
      class="input full"
      type="text"
      name="username"
      placeholder="e.g. Alex"
      autocomplete="nickname"
    />

    <label class="label roomLabel" for="sessionName">Session name</label>
    <fieldset class="fieldset">
      <input
        id="sessionName"
        v-model="sessionName"
        class="input"
        type="text"
        name="sessionName"
        :placeholder="conferenceNameDefault"
      />
      <input class="join" name="joinButton" type="submit" value="Join" />
    </fieldset>
  </form>
</template>

<style scoped>
.form {
  width: 340px;
  margin: auto;
  text-align: left;
}
.label {
  font-size: var(--fs-small);
  color: var(--color-text-default);
}
.roomLabel {
  display: block;
  margin-top: 16px;
}
.fieldset {
  border: none;
  padding: 0;
  margin: 10px 0 0;
  display: flex;
  flex-direction: row;
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
</style>
