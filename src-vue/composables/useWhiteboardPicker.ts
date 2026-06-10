import { computed, ref, watch, type Ref } from 'vue';
import {
  WHITEBOARD_HUE_RING,
  hexToHsv,
  hsvToHex,
  hueFromWheelEvent,
  hueMarkerPosition,
  normalizeHex,
  svFromBoxEvent,
} from '@/utils/whiteboardColor';

export function stripWhiteboardHex(hex: string) {
  return hex.replace(/^#/, '').toLowerCase();
}

export function useWhiteboardPicker(penColor: Ref<string>) {
  const hexInput = ref(stripWhiteboardHex(penColor.value));
  const hue = ref(220);
  const boxSat = ref(80);
  const boxVal = ref(55);

  let pickingWheel = false;
  let pickingBox = false;

  const slBoxStyle = computed(() => ({
    background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hsvToHex(hue.value, 100, 100)})`,
  }));

  const hueMarkerStyle = computed(() => hueMarkerPosition(hue.value, WHITEBOARD_HUE_RING));

  const wheelRingStyle = computed(() => ({
    '--wb-ring-inner': `${WHITEBOARD_HUE_RING.inner * 100}%`,
  }));

  const svMarkerStyle = computed(() => ({
    left: `${boxSat.value}%`,
    top: `${100 - boxVal.value}%`,
  }));

  function syncFromColor(hex: string) {
    hexInput.value = stripWhiteboardHex(hex);
    const hsv = hexToHsv(hex);
    if (!hsv) return;
    hue.value = hsv.h;
    boxSat.value = hsv.s;
    boxVal.value = hsv.v;
  }

  function applyHsv() {
    const hex = hsvToHex(hue.value, boxSat.value, boxVal.value);
    penColor.value = hex;
    hexInput.value = stripWhiteboardHex(hex);
  }

  function selectPreset(value: string) {
    penColor.value = value;
    syncFromColor(value);
  }

  function commitHex() {
    const next = normalizeHex(hexInput.value);
    if (!next) {
      hexInput.value = stripWhiteboardHex(penColor.value);
      return;
    }
    penColor.value = next;
    syncFromColor(next);
  }

  function onWheelDown(e: PointerEvent) {
    if (e.button !== 0) return;
    pickingWheel = true;
    updateHue(e);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onWheelMove(e: PointerEvent) {
    if (!pickingWheel) return;
    updateHue(e);
  }

  function onBoxDown(e: PointerEvent) {
    if (e.button !== 0) return;
    pickingBox = true;
    updateSv(e);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onBoxMove(e: PointerEvent) {
    if (!pickingBox) return;
    updateSv(e);
  }

  function endPick(e: PointerEvent) {
    pickingWheel = false;
    pickingBox = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  function updateHue(e: PointerEvent) {
    const next = hueFromWheelEvent(
      (e.currentTarget as HTMLElement).getBoundingClientRect(),
      e.clientX,
      e.clientY,
      WHITEBOARD_HUE_RING,
    );
    if (next === null) return;
    hue.value = next;
    applyHsv();
  }

  function updateSv(e: PointerEvent) {
    const next = svFromBoxEvent(
      (e.currentTarget as HTMLElement).getBoundingClientRect(),
      e.clientX,
      e.clientY,
    );
    boxSat.value = next.s;
    boxVal.value = next.v;
    applyHsv();
  }

  watch(
    penColor,
    (hex) => {
      const fromPicker = hsvToHex(hue.value, boxSat.value, boxVal.value);
      hexInput.value = stripWhiteboardHex(hex);
      if (hex === fromPicker) return;
      syncFromColor(hex);
    },
    { immediate: true },
  );

  return {
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
  };
}
