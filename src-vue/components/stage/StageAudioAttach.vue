<script setup lang="ts">
/**
 * StageAudioAttach — wires a Jitsi audio track into the Web Audio API
 * using a GainNode for smooth, click-free volume changes.
 *
 * The stage view shows a single "on-stage" speaker at full volume;
 * this component replaces the old HTMLAudioElement.volume approach.
 */
import { onBeforeUnmount, onMounted, watch } from 'vue';
import type { JitsiTrackLike } from '@/types/jitsi';

const props = defineProps<{
  track?: JitsiTrackLike;
  volume: number;
}>();

let ctx: AudioContext | undefined;
let source: MediaStreamAudioSourceNode | undefined;
let gain: GainNode | undefined;

function ensureCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function teardown(): void {
  try {
    source?.disconnect();
    gain?.disconnect();
  } catch {
    /* already disconnected */
  }
  source = undefined;
  gain = undefined;
}

function setup(): void {
  teardown();
  const track = props.track as { getOriginalStream?: () => MediaStream } | undefined;
  const stream = track?.getOriginalStream?.();
  if (!stream) return;

  const audioCtx = ensureCtx();
  source = audioCtx.createMediaStreamSource(stream);
  gain = audioCtx.createGain();
  gain.gain.value = Math.max(0, Math.min(1, props.volume));
  source.connect(gain);
  gain.connect(audioCtx.destination);
}

onMounted(setup);
watch(() => props.track, () => { setup(); });

watch(
  () => props.volume,
  (v) => {
    if (!gain || !ctx) return;
    const clamped = Math.max(0, Math.min(1, v));
    gain.gain.setTargetAtTime(clamped, ctx.currentTime, 0.015);
  },
);

onBeforeUnmount(() => {
  teardown();
  void ctx?.close();
  ctx = undefined;
});
</script>

<template>
  <!-- No visible element — audio is handled entirely by Web Audio API -->
  <span aria-hidden="true" style="display:none" />
</template>
