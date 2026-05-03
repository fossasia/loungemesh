<script setup lang="ts">
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { useSessionPollControls } from '@/composables/useSessionPollControls';
import IconButton from '@/components/ui/IconButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import { REACTION_EMOJIS } from '@/constants/sessionEmojis';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import { useMediaEngine } from '@/composables/useMediaEngine';
import { sendSessionReaction } from '@/utils/sessionReactions';

const features = useSessionFeaturesStore();
const conference = useConferenceStore();
const local = useLocalStore();
const { engine } = useMediaEngine();
const {
  pollQuestion,
  pollOptions,
  createPoll,
  vote,
  closePoll,
  togglePollPanel,
} = useSessionPollControls();

function toggleHand() {
  features.handRaised = !features.handRaised;
  engine.setLocalParticipantProperty('handRaised', features.handRaised);
  const id = engine.getLocalUserId();
  if (id && conference.users[id]) {
    conference.patchUser(id, {
      properties: {
        ...conference.users[id].properties,
        handRaised: features.handRaised,
      },
    });
  }
}

function toggleReactions() {
  const next = features.panel === 'reactions' ? '' : 'reactions';
  features.panel = next;
}

function sendReaction(emoji: string) {
  sendSessionReaction(
    local.id,
    engine.getLocalUserId(),
    emoji,
    (id, e) => features.setReaction(id, e),
    (cmd, json) => engine.sendCommand(cmd, json),
    () => {
      features.panel = '';
    },
  );
}

function openPanel(name: 'notes' | 'whiteboard') {
  features.togglePanel(name);
}
</script>

<template>
  <div class="sessionTools">
    <div class="toolWrap">
      <IconButton
        label="Reactions"
        :highlight="features.panel === 'reactions'"
        @click="toggleReactions"
      >
        <template #icon><AppIcon name="smile" /></template>
      </IconButton>
      <div v-if="features.panel === 'reactions'" class="toolPop reactionsPop" @pointerdown.stop>
        <p class="popTitle">Pick a reaction</p>
        <div class="emojiGrid">
          <button
            v-for="emoji in REACTION_EMOJIS"
            :key="emoji"
            type="button"
            class="emojiBtn"
            :title="`React with ${emoji}`"
            @click="sendReaction(emoji)"
          >
            {{ emoji }}
          </button>
        </div>
      </div>
    </div>
    <IconButton label="Raise hand" :highlight="features.handRaised" @click="toggleHand">
      <template #icon><AppIcon name="hand" /></template>
    </IconButton>
    <div class="toolWrap">
      <IconButton label="Poll" :active="features.panel === 'poll'" @click="togglePollPanel">
        <template #icon><AppIcon name="bar-chart" /></template>
      </IconButton>
      <div v-if="features.panel === 'poll'" class="toolPop pollPop" @pointerdown.stop>
        <p class="popTitle">Poll</p>
        <template v-if="features.isHost && !features.activePoll">
          <input v-model="pollQuestion" class="field" placeholder="Poll question" />
          <textarea v-model="pollOptions" class="ta" rows="3" placeholder="Options (one per line)" />
          <button type="button" class="action" @click="createPoll">Start poll</button>
        </template>
        <template v-else-if="features.activePoll">
          <p class="q">{{ features.activePoll.question }}</p>
          <template v-if="features.canUsePoll || features.isHost">
            <button
              v-for="opt in features.activePoll.options"
              :key="opt.id"
              type="button"
              class="opt"
              @click="vote(opt.id)"
            >
              {{ opt.label }} ({{ opt.votes }})
            </button>
          </template>
          <p v-else class="hint">The host has not granted poll access for you.</p>
          <button v-if="features.isHost" type="button" class="action subtle" @click="closePoll">
            End poll
          </button>
        </template>
        <p v-else-if="features.canUsePoll" class="hint">Waiting for the host to start a poll.</p>
        <p v-else class="hint">Ask the host for poll access.</p>
      </div>
    </div>
    <IconButton
      label="Shared notes"
      :active="features.panel === 'notes'"
      :title="features.canUseNotes ? 'Shared notes' : 'Notes — ask host for access'"
      @click="openPanel('notes')"
    >
      <template #icon><AppIcon name="file-text" /></template>
    </IconButton>
    <IconButton
      label="Whiteboard"
      :active="features.panel === 'whiteboard'"
      :title="features.canUseWhiteboard ? 'Whiteboard' : 'Whiteboard — ask host for access'"
      @click="openPanel('whiteboard')"
    >
      <template #icon><AppIcon name="pencil" /></template>
    </IconButton>
  </div>
</template>

<style scoped>
.sessionTools {
  position: relative;
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  overflow: visible;
}
.toolWrap {
  position: relative;
  display: inline-flex;
  overflow: visible;
}
.toolPop {
  position: absolute;
  left: 50%;
  bottom: 100%;
  transform: translate(-50%, -12px);
  z-index: 10002;
  padding: 12px;
  border-radius: var(--radius-sm);
  background: #fff;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  pointer-events: auto;
}
.reactionsPop {
  min-width: 220px;
  max-width: min(320px, calc(100vw - 32px));
}
.pollPop {
  width: min(320px, calc(100vw - 32px));
  max-height: min(420px, 55vh);
  overflow: auto;
}
.popTitle {
  margin: 0 0 8px;
  font-size: var(--fs-small);
  font-weight: var(--fw-medium);
  color: var(--color-mono30);
  text-align: center;
}
.emojiGrid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  justify-items: center;
}
.emojiBtn {
  font-size: 1.35rem;
  border: none;
  background: var(--color-mono95);
  border-radius: 8px;
  padding: 10px 12px;
  cursor: pointer;
  line-height: 1;
}
.emojiBtn:hover {
  background: var(--btn-default-bg-hover);
}
.field,
.ta {
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 8px;
  font-family: var(--font-body);
  border: 1px solid var(--line-dark);
  border-radius: var(--radius-sm);
  padding: 8px;
}
.action {
  display: inline-block;
  margin-top: 6px;
  padding: 8px 12px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--btn-primary-bg);
  color: var(--btn-primary-fg);
  cursor: pointer;
  font-family: var(--font-body);
}
.action.subtle {
  background: var(--btn-default-bg);
  color: var(--color-text-default);
}
.hint {
  font-size: var(--fs-small);
  color: var(--color-mono30);
  margin: 8px 0 0;
}
.q {
  font-weight: var(--fw-medium);
  margin: 0 0 8px;
}
.opt {
  display: block;
  width: 100%;
  margin: 6px 0;
  padding: 10px;
  text-align: left;
  border: 1px solid var(--line-light);
  border-radius: var(--radius-sm);
  background: #fff;
  cursor: pointer;
}
</style>
