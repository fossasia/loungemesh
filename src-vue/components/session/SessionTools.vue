<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { useSessionPollControls } from '@/composables/useSessionPollControls';
import PollPanel from '@/components/session/PollPanel.vue';
import IconButton from '@/components/ui/IconButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import { loadEmojiPickerPanel } from '@/components/ui/loadEmojiPickerPanel';

const EmojiPickerPanel = defineAsyncComponent(loadEmojiPickerPanel);
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
        <EmojiPickerPanel layout="popover" @select="sendReaction" />
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
  bottom: calc(100% + 8px);
  transform: translateX(-50%);
  z-index: 10002;
  padding: 12px;
  border-radius: var(--radius-sm);
  background: #fff;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  pointer-events: auto;
}
.reactionsPop {
  width: min(352px, calc(100vw - 24px));
  padding: 10px 12px 12px;
  overflow: visible;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 8px;
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
  margin: 0;
  flex-shrink: 0;
  font-size: var(--fs-small);
  font-weight: var(--fw-medium);
  color: var(--color-mono30);
  text-align: center;
}
</style>
