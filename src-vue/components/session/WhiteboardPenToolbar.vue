<script setup lang="ts">
import { computed, ref } from 'vue';
import { WHITEBOARD_PEN_COLORS, WHITEBOARD_PEN_WIDTHS } from '@/constants/whiteboardPens';
import { useWhiteboardPicker } from '@/composables/useWhiteboardPicker';

const penColor = defineModel<string>('penColor', { required: true });
const penWidth = defineModel<number>('penWidth', { required: true });

const colorOpen = ref(false);
const penOpen = ref(false);

const activePenLabel = computed(
  () => WHITEBOARD_PEN_WIDTHS.find((w) => w.value === penWidth.value)?.label ?? 'Pen',
);

const {
  hexInput,
  slBoxStyle,
  hueMarkerStyle,
  wheelRingStyle,
  svMarkerStyle,
  selectPreset,
  commitHex,
  onWheelDown,
  onWheelMove,
  onBoxDown,
  onBoxMove,
  endPick,
} = useWhiteboardPicker(penColor);

function toggleColor() {
  colorOpen.value = !colorOpen.value;
  if (colorOpen.value) penOpen.value = false;
}

function togglePen() {
  penOpen.value = !penOpen.value;
  if (penOpen.value) colorOpen.value = false;
}

function selectPen(value: number) {
  penWidth.value = value;
  penOpen.value = false;
}
</script>

<template>
  <div class="wbFloatingTools" @pointerdown.stop>
    <div class="wbToolGroup">
      <button
        type="button"
        class="wbColorTrigger"
        :style="{ background: penColor }"
        aria-label="Choose pen color"
        :aria-expanded="colorOpen"
        title="Color"
        @click="toggleColor"
      />
      <div v-if="colorOpen" class="wbColorPanel">
        <div
          class="wbWheelWrap"
          :style="wheelRingStyle"
          @pointerdown="onWheelDown"
          @pointermove="onWheelMove"
          @pointerup="endPick"
          @pointercancel="endPick"
        >
          <div class="wbWheel" aria-hidden="true" />
          <span class="wbHueMarker" :style="hueMarkerStyle" aria-hidden="true" />
        </div>
        <div
          class="wbSlBox"
          :style="slBoxStyle"
          aria-label="Saturation and brightness"
          @pointerdown="onBoxDown"
          @pointermove="onBoxMove"
          @pointerup="endPick"
          @pointercancel="endPick"
        >
          <span class="wbSlMarker" :style="svMarkerStyle" aria-hidden="true" />
        </div>
        <label class="wbHexField">
          <span class="wbHexInputWrap">
            <span class="wbHexChip" :style="{ background: penColor }" aria-hidden="true" />
            <span class="wbHexPrefix" aria-hidden="true">#</span>
            <input
              v-model="hexInput"
              class="wbHexInput"
              type="text"
              spellcheck="false"
              maxlength="6"
              aria-label="Hex color code"
              @keydown.enter.prevent="commitHex"
              @blur="commitHex"
            />
          </span>
        </label>
        <div class="wbPresets" role="list" aria-label="Preset colors">
          <button
            v-for="color in WHITEBOARD_PEN_COLORS"
            :key="color.id"
            type="button"
            class="wbPreset"
            :class="{ active: penColor === color.value }"
            :style="{ background: color.value }"
            :title="color.label"
            :aria-label="color.label"
            @click="selectPreset(color.value)"
          />
        </div>
      </div>
    </div>

    <div class="wbToolGroup">
      <button
        type="button"
        class="wbPenTrigger"
        :aria-expanded="penOpen"
        aria-haspopup="listbox"
        @click="togglePen"
      >
        <span
          class="wbPenPreview"
          :style="{
            width: `${Math.min(penWidth * 1.2, 16)}px`,
            height: `${Math.min(penWidth * 1.2, 16)}px`,
            background: penColor,
          }"
        />
        <span class="wbPenLabel">{{ activePenLabel }}</span>
        <span class="wbCaret" :class="{ open: penOpen }" aria-hidden="true" />
      </button>
      <div v-if="penOpen" class="wbPenMenu" role="listbox" aria-label="Pen size">
        <button
          v-for="size in WHITEBOARD_PEN_WIDTHS"
          :key="size.value"
          type="button"
          class="wbPenOption"
          :class="{ active: penWidth === size.value }"
          role="option"
          :aria-selected="penWidth === size.value"
          @click="selectPen(size.value)"
        >
          <span
            class="wbPenOptionDot"
            :style="{
              width: `${Math.min(size.value * 1.2, 18)}px`,
              height: `${Math.min(size.value * 1.2, 18)}px`,
              background: penColor,
            }"
          />
          {{ size.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wbFloatingTools {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 3;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.wbToolGroup {
  position: relative;
}
.wbColorTrigger,
.wbPenTrigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--line-dark);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
  cursor: pointer;
  font-family: var(--font-body);
  color: var(--color-text-default);
}
.wbColorTrigger {
  width: 34px;
  height: 34px;
  padding: 3px;
  box-sizing: border-box;
  border-radius: 50%;
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.12),
    0 1px 4px rgba(0, 0, 0, 0.12);
}
.wbPenTrigger {
  min-height: 34px;
  padding: 6px 10px;
  font-size: var(--fs-small);
  font-weight: var(--fw-medium);
}
.wbPenPreview {
  display: block;
  border-radius: 50%;
  flex-shrink: 0;
}
.wbPenLabel {
  white-space: nowrap;
}
.wbCaret {
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 5px solid var(--color-mono40);
  transition: transform 120ms ease;
}
.wbCaret.open {
  transform: rotate(180deg);
}
.wbColorPanel,
.wbPenMenu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  width: 212px;
  padding: 12px;
  border: 1px solid var(--line-dark);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16);
}
.wbWheelWrap {
  position: relative;
  width: 132px;
  height: 132px;
  margin: 0 auto 12px;
  touch-action: none;
  cursor: crosshair;
}
.wbWheel {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: conic-gradient(
    from 0deg,
    #ff0000,
    #ffff00,
    #00ff00,
    #00ffff,
    #0000ff,
    #ff00ff,
    #ff0000
  );
  -webkit-mask: radial-gradient(
    closest-side circle,
    transparent calc(var(--wb-ring-inner) - 0.5%),
    #000 var(--wb-ring-inner),
    #000 100%
  );
  mask: radial-gradient(
    closest-side circle,
    transparent calc(var(--wb-ring-inner) - 0.5%),
    #000 var(--wb-ring-inner),
    #000 100%
  );
}
.wbHueMarker,
.wbSlMarker {
  position: absolute;
  width: 10px;
  height: 10px;
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.5);
  transform: translate(-50%, -50%);
  pointer-events: none;
}
.wbSlBox {
  position: relative;
  width: 100%;
  height: 96px;
  margin-bottom: 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--line-dark);
  touch-action: none;
  cursor: crosshair;
  overflow: hidden;
}
.wbHexField {
  display: block;
  margin-bottom: 12px;
}
.wbHexInputWrap {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 0 10px 0 8px;
  border: 1px solid var(--line-dark);
  border-radius: var(--radius-sm);
  background: var(--color-mono95);
}
.wbHexChip {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  border-radius: 4px;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.12);
}
.wbHexPrefix {
  font-family: ui-monospace, monospace;
  font-size: var(--fs-small);
  color: var(--color-mono30);
}
.wbHexInput {
  flex: 1;
  min-width: 0;
  border: none;
  padding: 8px 0;
  background: transparent;
  font-family: ui-monospace, monospace;
  font-size: var(--fs-small);
  text-transform: lowercase;
  color: var(--color-text-default);
}
.wbHexInput:focus {
  outline: none;
}
.wbHexInputWrap:focus-within {
  border-color: var(--color-text-default);
  background: #fff;
}
.wbPresets {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  justify-items: center;
}
.wbPreset {
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.14);
}
.wbPreset.active {
  box-shadow: 0 0 0 2px #fff, 0 0 0 3px var(--color-text-default);
}
.wbPenMenu {
  min-width: 140px;
  width: auto;
  padding: 6px;
}
.wbPenOption {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  border: none;
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  background: transparent;
  font-family: var(--font-body);
  font-size: var(--fs-small);
  text-align: left;
  cursor: pointer;
}
.wbPenOption:hover,
.wbPenOption.active {
  background: var(--color-mono95);
}
.wbPenOptionDot {
  display: block;
  border-radius: 50%;
  flex-shrink: 0;
}
</style>
