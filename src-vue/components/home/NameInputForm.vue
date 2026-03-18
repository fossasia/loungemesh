<script setup lang="ts">
import { ref } from 'vue';
import { conferenceNameDefault } from '@/config/jitsiOptions';

const sessionName = ref('');

const emit = defineEmits<{
  submit: [name: string];
}>();

function onSubmit(e: Event) {
  e.preventDefault();
  const name = (sessionName.value || conferenceNameDefault).trim();
  if (name.length > 0) emit('submit', name);
}
</script>

<template>
  <form class="form" @submit="onSubmit">
    <label class="label" for="sessionName">Set Session Name</label>
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
/* Legacy `NameInputForm` from src/pages/Home/elements/NameInputForm.tsx */
.form {
  width: 340px;
  margin: auto;
  text-align: left;
}
.label {
  font-size: var(--fs-small);
  color: var(--color-text-default);
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
.input:hover {
  border: 1px solid var(--color-blue100);
}
.input:hover::placeholder {
  color: var(--color-blue100);
}
.input:focus {
  outline: none;
  font-size: var(--fs-body);
}
.input::placeholder {
  font-size: var(--fs-body);
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
