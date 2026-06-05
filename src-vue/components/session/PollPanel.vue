<script setup lang="ts">
import { computed } from 'vue';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { useSessionPollControls } from '@/composables/useSessionPollControls';
import AppIcon from '@/components/ui/AppIcon.vue';
import {
  canVote,
  pollOptionPercent,
  pollTotalVotes,
} from '@/utils/sessionPoll';

const features = useSessionFeaturesStore();
const {
  pollQuestion,
  pollOptionDrafts,
  createReady,
  addPollOption,
  removePollOption,
  createPoll,
  vote,
  closePoll,
} = useSessionPollControls();

const activePoll = computed(() => features.activePoll);
const totalVotes = computed(() => pollTotalVotes(activePoll.value));
const votingOpen = computed(() => canVote(features.myPollVote, activePoll.value));
const votedOptionId = computed(() => features.myPollVote);
const showCreateForm = computed(() => features.isHost && !activePoll.value);
const showVoteUi = computed(
  () => !!activePoll.value && (features.canUsePoll || features.isHost),
);
const showReadOnlyPoll = computed(
  () => !!activePoll.value && !features.canUsePoll && !features.isHost,
);
const showWaiting = computed(
  () => !activePoll.value && features.canUsePoll && !features.isHost,
);
const showNoAccess = computed(() => !activePoll.value && !features.canUsePoll && !features.isHost);

function optionPercent(votes: number): number {
  return pollOptionPercent(votes, totalVotes.value);
}
</script>

<template>
  <div class="pollPanel">
    <template v-if="showCreateForm">
      <p class="lead">Ask the room a question and collect votes in real time.</p>

      <div class="pollQuestionGroup">
        <label class="fieldLabel questionLabel" for="poll-question">Question</label>
        <input
          id="poll-question"
          v-model="pollQuestion"
          class="field"
          type="text"
          placeholder="What should we do next?"
          maxlength="200"
        />
      </div>

      <div class="optionsHead">
        <span class="fieldLabel">Options</span>
        <button type="button" class="textBtn" @click="addPollOption">
          <AppIcon name="plus" :size="16" />
          Add option
        </button>
      </div>

      <div class="optionDrafts">
        <div v-for="(_, index) in pollOptionDrafts" :key="index" class="optionDraftRow">
          <span class="optionIndex" aria-hidden="true">{{ index + 1 }}</span>
          <input
            v-model="pollOptionDrafts[index]"
            class="field optionField"
            type="text"
            :placeholder="`Option ${index + 1}`"
            maxlength="120"
          />
          <button
            type="button"
            class="iconBtn"
            :disabled="pollOptionDrafts.length <= 2"
            :title="pollOptionDrafts.length <= 2 ? 'At least two options are required' : 'Remove option'"
            :aria-label="`Remove option ${index + 1}`"
            @click="removePollOption(index)"
          >
            <AppIcon name="minus" :size="16" />
          </button>
        </div>
      </div>

      <p v-if="!createReady" class="hint">Enter a question and at least two options.</p>
      <button type="button" class="primaryBtn" :disabled="!createReady" @click="createPoll">
        Start poll
      </button>
    </template>

    <template v-else-if="(showVoteUi || showReadOnlyPoll) && activePoll">
      <div class="livePoll">
        <p class="voteCount">
          {{ totalVotes }} {{ totalVotes === 1 ? 'vote' : 'votes' }}
        </p>

        <h3 class="question">{{ activePoll.question }}</h3>

        <p v-if="showReadOnlyPoll" class="hint">The host has not granted poll access for you.</p>
        <p v-else-if="votedOptionId" class="votedHint">You voted — results update as others respond.</p>
        <p v-else-if="votingOpen" class="hint">Choose an option below.</p>

        <div class="results" role="list">
          <template v-if="showVoteUi">
            <button
              v-for="opt in activePoll.options"
              :key="opt.id"
              type="button"
              class="resultRow"
              :class="{
                selected: votedOptionId === opt.id,
                readonly: !votingOpen,
              }"
              :disabled="!votingOpen"
              role="listitem"
              @click="vote(opt.id)"
            >
              <span
                class="resultRadio"
                :class="{ checked: votedOptionId === opt.id }"
                aria-hidden="true"
              />
              <span class="resultBody">
                <span class="resultTop">
                  <span class="resultLabel">{{ opt.label }}</span>
                  <span class="resultStats">
                    <span class="resultVotes">{{ opt.votes }}</span>
                    <span class="resultPct">{{ optionPercent(opt.votes) }}%</span>
                  </span>
                </span>
                <span class="resultTrack" aria-hidden="true">
                  <span class="resultFill" :style="{ width: `${optionPercent(opt.votes)}%` }" />
                </span>
              </span>
            </button>
          </template>
          <template v-else>
            <div
              v-for="opt in activePoll.options"
              :key="opt.id"
              class="resultRow readonly"
              role="listitem"
            >
              <span class="resultRadio" aria-hidden="true" />
              <span class="resultBody">
                <span class="resultTop">
                  <span class="resultLabel">{{ opt.label }}</span>
                  <span class="resultStats">
                    <span class="resultVotes">{{ opt.votes }}</span>
                    <span class="resultPct">{{ optionPercent(opt.votes) }}%</span>
                  </span>
                </span>
                <span class="resultTrack" aria-hidden="true">
                  <span class="resultFill" :style="{ width: `${optionPercent(opt.votes)}%` }" />
                </span>
              </span>
            </div>
          </template>
        </div>

        <button v-if="features.isHost && showVoteUi" type="button" class="secondaryBtn" @click="closePoll">
          End poll &amp; share results
        </button>
      </div>
    </template>

    <div v-else-if="showWaiting" class="emptyState">
      <AppIcon name="bar-chart" :size="36" class="emptyIcon" />
      <p class="emptyTitle">No active poll</p>
      <p class="hint">Waiting for the host to start a poll.</p>
    </div>

    <div v-else-if="showNoAccess" class="emptyState">
      <AppIcon name="bar-chart" :size="36" class="emptyIcon" />
      <p class="emptyTitle">Poll access needed</p>
      <p class="hint">Ask the host for poll access.</p>
    </div>
  </div>
</template>

<style scoped>
.pollPanel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.lead {
  margin: 0;
  font-size: var(--fs-body);
  color: var(--color-mono30);
  line-height: 1.5;
}

.fieldLabel {
  display: block;
  margin: 0 0 6px;
  font-size: var(--fs-small);
  font-weight: var(--fw-medium);
  color: var(--color-text-default);
}

.pollQuestionGroup {
  width: 100%;
  text-align: left;
}

.questionLabel {
  text-align: left;
}

.field {
  width: 100%;
  box-sizing: border-box;
  font-family: var(--font-body);
  font-size: var(--fs-body);
  border: 2px solid var(--line-dark);
  border-radius: var(--radius-sm);
  padding: 9px 11px;
  background: #fff;
  color: var(--color-text-default);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.field:hover {
  border-color: var(--color-mono60);
}

.field:focus,
.field:focus-visible {
  outline: none;
  border-color: var(--color-blue100);
  box-shadow: 0 0 0 3px rgba(79, 110, 247, 0.22);
}

.optionsHead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.textBtn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  padding: 4px 6px;
  font-family: var(--font-body);
  font-size: var(--fs-small);
  font-weight: var(--fw-medium);
  color: var(--color-blue100);
  cursor: pointer;
  border-radius: var(--radius-sm);
}

.textBtn:hover {
  background: var(--color-mono95);
}

.optionDrafts {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.optionDraftRow {
  display: flex;
  align-items: center;
  gap: 8px;
}

.optionIndex {
  flex: 0 0 24px;
  text-align: center;
  font-size: var(--fs-small);
  font-weight: var(--fw-medium);
  color: var(--color-mono40);
}

.optionField {
  flex: 1;
  min-width: 0;
}

.iconBtn {
  flex: 0 0 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--line-light);
  border-radius: var(--radius-sm);
  background: var(--color-bg-card);
  color: var(--color-mono30);
  cursor: pointer;
}

.iconBtn:hover:not(:disabled) {
  background: var(--btn-default-bg-hover);
  color: var(--color-text-default);
}

.iconBtn:disabled {
  opacity: 0.35;
  cursor: default;
}

.primaryBtn,
.secondaryBtn {
  width: 100%;
  margin-top: 4px;
  padding: 10px 14px;
  border: none;
  border-radius: var(--radius-sm);
  font-family: var(--font-body);
  font-size: var(--fs-body);
  font-weight: var(--fw-medium);
  cursor: pointer;
}

.primaryBtn {
  background: var(--btn-primary-bg);
  color: var(--btn-primary-fg);
}

.primaryBtn:hover:not(:disabled) {
  filter: brightness(1.05);
}

.primaryBtn:disabled {
  opacity: 0.45;
  cursor: default;
}

.secondaryBtn {
  background: var(--btn-default-bg);
  color: var(--color-text-default);
  border: 1px solid var(--line-light);
}

.secondaryBtn:hover {
  background: var(--btn-default-bg-hover);
}

.livePoll {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--line-light);
  border-radius: var(--radius-sm);
  background: var(--color-bg-card);
}

.voteCount {
  margin: 0;
  font-size: var(--fs-small);
  color: var(--color-mono30);
  text-align: left;
}

.question {
  display: block;
  width: 100%;
  margin: 0;
  font-size: 1.05rem;
  font-weight: var(--fw-medium);
  line-height: 1.35;
  color: var(--color-text-default);
  text-align: left;
  align-self: stretch;
}

.pollQuestionGroup .field {
  text-align: left;
}

.votedHint {
  margin: 0;
  font-size: var(--fs-body);
  color: var(--color-blue100);
  line-height: 1.5;
}

.hint {
  margin: 0;
  font-size: var(--fs-body);
  color: var(--color-mono30);
  line-height: 1.5;
}

.results {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.resultRow {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--line-light);
  border-radius: var(--radius-sm);
  background: #fff;
  text-align: left;
  cursor: pointer;
  font-family: var(--font-body);
  transition: border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
}

.resultRow:hover:not(:disabled) {
  border-color: var(--color-blue100);
  box-shadow: 0 2px 8px rgba(79, 110, 247, 0.08);
}

.resultRow.selected {
  border-color: var(--color-blue100);
  background: var(--color-mono95);
  box-shadow: inset 0 0 0 1px rgba(79, 110, 247, 0.12);
}

.resultRow.readonly,
.resultRow:disabled {
  cursor: default;
  box-shadow: none;
}

.resultRadio {
  flex: 0 0 18px;
  width: 18px;
  height: 18px;
  margin-top: 2px;
  border: 2px solid var(--color-mono60);
  border-radius: 50%;
  background: #fff;
}

.resultRadio.checked {
  border-color: var(--color-blue100);
  background: var(--color-blue100);
  box-shadow: inset 0 0 0 3px #fff;
}

.resultBody {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.resultTop {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.resultLabel {
  font-size: var(--fs-body);
  font-weight: var(--fw-medium);
  color: var(--color-text-default);
  line-height: 1.35;
}

.resultStats {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  flex-shrink: 0;
  font-size: var(--fs-small);
  color: var(--color-mono30);
}

.resultVotes {
  font-weight: var(--fw-medium);
  color: var(--color-text-default);
}

.resultPct {
  min-width: 2.5em;
  text-align: right;
}

.resultTrack {
  height: 6px;
  border-radius: var(--radius-round);
  background: var(--color-mono95);
  overflow: hidden;
}

.resultFill {
  height: 100%;
  border-radius: inherit;
  background: var(--color-blue100);
  transition: width 0.25s ease;
}

.emptyState {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 24px 12px 8px;
  gap: 6px;
}

.emptyIcon {
  color: var(--color-mono60);
  margin-bottom: 4px;
}

.emptyTitle {
  margin: 0;
  font-size: var(--fs-h2);
  font-weight: var(--fw-medium);
  line-height: 1.25;
  color: var(--color-text-default);
}
</style>
