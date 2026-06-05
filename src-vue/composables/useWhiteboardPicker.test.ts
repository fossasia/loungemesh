import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { useWhiteboardPicker } from './useWhiteboardPicker';

function wheelRect() {
  return { left: 0, top: 0, width: 132, height: 132, right: 132, bottom: 132 } as DOMRect;
}

function boxRect() {
  return { left: 0, top: 0, width: 188, height: 96, right: 188, bottom: 96 } as DOMRect;
}

function pointer(
  type: string,
  target: HTMLElement,
  clientX: number,
  clientY: number,
  button = 0,
) {
  const event = new PointerEvent(type, { button, clientX, clientY, bubbles: true });
  Object.defineProperty(event, 'currentTarget', { value: target });
  return event;
}

describe('useWhiteboardPicker', () => {
  it('syncs hex input and applies wheel and box picks', () => {
    const penColor = ref('#1e3a8a');
    const picker = useWhiteboardPicker(penColor);
    const wheel = document.createElement('div');
    const box = document.createElement('div');
    wheel.setPointerCapture = vi.fn();
    box.setPointerCapture = vi.fn();
    wheel.releasePointerCapture = vi.fn(() => {
      throw new Error('no capture');
    });
    vi.spyOn(wheel, 'getBoundingClientRect').mockReturnValue(wheelRect());
    vi.spyOn(box, 'getBoundingClientRect').mockReturnValue(boxRect());

    picker.onWheelDown(pointer('pointerdown', wheel, 66, 12));
    picker.onWheelMove(pointer('pointermove', wheel, 120, 66));
    expect(penColor.value).not.toBe('#1e3a8a');

    picker.onBoxDown(pointer('pointerdown', box, 160, 20));
    picker.onBoxMove(pointer('pointermove', box, 40, 80));
    picker.endPick(pointer('pointerup', box, 40, 80));

    picker.selectPreset('#dc2626');
    expect(picker.hexInput.value).toBe('dc2626');
  });

  it('rejects invalid hex values and ignores guarded pointer events', () => {
    const penColor = ref('#1e3a8a');
    const picker = useWhiteboardPicker(penColor);
    const wheel = document.createElement('div');
    vi.spyOn(wheel, 'getBoundingClientRect').mockReturnValue(wheelRect());

    picker.hexInput.value = 'zzzzzz';
    picker.commitHex();
    expect(picker.hexInput.value).toBe('1e3a8a');

    picker.onWheelDown(pointer('pointerdown', wheel, 66, 66));
    expect(penColor.value).toBe('#1e3a8a');
    picker.onWheelDown(pointer('pointerdown', wheel, 66, 12, 2));
    picker.onWheelMove(pointer('pointermove', wheel, 120, 66));
    const box = document.createElement('div');
    picker.onBoxDown(pointer('pointerdown', box, 10, 10, 2));
    picker.onBoxMove(pointer('pointermove', box, 10, 10));
    picker.endPick(pointer('pointerup', wheel, 120, 66));
  });

  it('ignores invalid synced colors and idle pointer moves', () => {
    const penColor = ref('not-a-color');
    const picker = useWhiteboardPicker(penColor);
    const wheel = document.createElement('div');
    picker.onWheelMove(pointer('pointermove', wheel, 10, 10));
    picker.onBoxMove(pointer('pointermove', wheel, 10, 10));
    expect(picker.hexInput.value).toBe('not-a-color');
  });
});
