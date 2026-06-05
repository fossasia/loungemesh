<script setup lang="ts">
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { useSessionPollControls } from '@/composables/useSessionPollControls';
import PollPanel from '@/components/session/PollPanel.vue';
import IconButton from '@/components/ui/IconButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import { REACTION_EMOJIS } from '@/constants/sessionEmojis';
import { useLocalStore } from '@/stores/localStore';
import { useMediaEngine } from '@/composables/useMediaEngine';
import { sendSessionReaction } from '@/utils/sessionReactions';
import { playUiSound } from '@/utils/uiSounds';
import { applyParticipantHandRaised } from '@/utils/sessionHandRaise';

const features = useSessionFeaturesStore();
const local = useLocalStore();
const { engine } = useMediaEngine();
const { togglePollPanel } = useSessionPollControls();
function toggleHand() {
  const id = local.id || engine.getLocalUserId();
  if (!id) return;
  const raised = !features.handRaised;
  features.handRaised = raised;
  engine.setLocalParticipantProperty('handRaised', raised);
  engine.sendCommand('hand', JSON.stringify({ id, raised }));
  applyParticipantHandRaised(id, raised);
}

function toggleReactions() {
  const next = features.panel === 'reactions' ? '' : 'reactions';
  features.panel = next;
}

function sendReaction(emoji: string) {
  playUiSound('reaction');
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
        sound="panel"
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
    <IconButton
      label="Raise hand"
      :highlight="features.handRaised"
      :sound="features.handRaised ? 'handLower' : 'handRaise'"
      @click="toggleHand"
    >
      <template #icon><AppIcon name="hand" /></template>
    </IconButton>
    <div class="toolWrap">
      <IconButton
        label="Poll"
        :active="features.panel === 'poll'"
        :activity-dot="features.hasUnreadPoll"
        sound="panel"
        :title="features.canUsePoll || features.isHost ? 'Poll' : 'Poll — ask host for access'"
        :aria-expanded="features.panel === 'poll'"
        @click="togglePollPanel"
      >
        <template #icon><AppIcon name="bar-chart" /></template>
      </IconButton>
      <div v-if="features.panel === 'poll'" class="toolPop pollPop" @pointerdown.stop>
        <h2 class="pollHeading">Poll</h2>
        <PollPanel />
      </div>
    </div>
    <IconButton
      label="Shared notes"
      :active="features.panel === 'notes'"
      :activity-dot="features.hasUnreadNotes"
      sound="panel"
      :title="features.canUseNotes ? 'Shared notes' : 'Notes — ask host for access'"
      @click="openPanel('notes')"
    >
      <template #icon><AppIcon name="file-text" /></template>
    </IconButton>
    <IconButton
      label="Whiteboard"
      :active="features.panel === 'whiteboard'"
      :activity-dot="features.hasUnreadWhiteboard"
      sound="panel"
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
  width: min(360px, calc(100vw - 32px));
  max-height: min(520px, 60vh);
  overflow-x: visible;
  overflow-y: auto;
  padding: 14px;
}
.pollHeading {
  margin: 0 0 10px;
  font-size: var(--fs-h2);
  font-weight: var(--fw-medium);
  line-height: 1.25;
  color: var(--color-text-default);
  text-align: center;
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
</style>
