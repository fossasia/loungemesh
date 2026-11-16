import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import { makeTrack } from '@/test/makeTrack';
import ExpandedScreenshare from './ExpandedScreenshare.vue';

describe('ExpandedScreenshare', () => {
  const track = makeTrack('desktop');
  let originalInnerWidth: number;
  let originalInnerHeight: number;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();

    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;

    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 768,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: originalInnerHeight,
    });
    vi.restoreAllMocks();
  });

  it('renders title, minimize button and ScreenshareVideo component', () => {
    const wrapper = mount(ExpandedScreenshare, {
      props: {
        id: 'user1',
        name: 'Bob',
        track,
        index: 0,
      },
    });

    expect(wrapper.text()).toContain("Bob's Screen");
    expect(wrapper.find('.minimizeButton').exists()).toBe(true);
    expect(wrapper.find('.expandedScreenshareWindow').exists()).toBe(true);
    wrapper.unmount();
  });

  it('renders "Your Screen" for local screenshare', () => {
    const wrapper = mount(ExpandedScreenshare, {
      props: {
        id: 'local',
        name: 'You',
        track,
        index: 0,
      },
    });

    expect(wrapper.text()).toContain('Your Screen');
    expect(wrapper.text()).not.toContain("You's Screen");
    wrapper.unmount();
  });

  it('emits minimize event on click of minimize button', async () => {
    const wrapper = mount(ExpandedScreenshare, {
      props: {
        id: 'user1',
        name: 'Bob',
        track,
        index: 0,
      },
    });

    await wrapper.find('.minimizeButton').trigger('click');
    expect(wrapper.emitted('minimize')).toBeTruthy();
    wrapper.unmount();
  });

  it('handles dragging with primary mouse button and clamps within boundaries', async () => {
    const wrapper = mount(ExpandedScreenshare, {
      props: {
        id: 'user1',
        name: 'Bob',
        track,
        index: 0,
      },
    });

    const header = wrapper.find('.windowHeader');

    // Right-click or middle click should be ignored
    const dragEventMiddle = new PointerEvent('pointerdown', {
      bubbles: true,
    });
    Object.defineProperty(dragEventMiddle, 'button', { value: 1 });
    header.element.dispatchEvent(dragEventMiddle);
    expect(HTMLElement.prototype.setPointerCapture).not.toHaveBeenCalled();

    // Clicking minimize button inside header should not initiate drag
    const minimizeBtn = wrapper.find('.minimizeButton');
    const mockPointerEventOnMin = new PointerEvent('pointerdown', {
      button: 0,
      bubbles: true,
    });
    Object.defineProperty(mockPointerEventOnMin, 'target', { value: minimizeBtn.element, enumerable: true });
    header.element.dispatchEvent(mockPointerEventOnMin);
    expect(HTMLElement.prototype.setPointerCapture).not.toHaveBeenCalled();

    // Drag start
    const dragEvent = new PointerEvent('pointerdown', {
      button: 0,
      clientX: 100,
      clientY: 100,
      bubbles: true,
    });
    header.element.dispatchEvent(dragEvent);
    expect(HTMLElement.prototype.setPointerCapture).toHaveBeenCalled();

    // Drag move to right/down within bounds
    const moveEvent = new PointerEvent('pointermove', {
      clientX: 200,
      clientY: 200,
      bubbles: true,
    });
    header.element.dispatchEvent(moveEvent);
    await nextTick();

    const element = wrapper.find('.expandedScreenshareWindow').element as HTMLElement;
    // initial top: 120 + 0 * 20 = 120, deltaY = 100 -> top should be 220
    // initial left: 350 + 0 * 20 = 350, deltaX = 100 -> left should be 450
    expect(element.style.left).toBe('450px');
    expect(element.style.top).toBe('220px');

    // Drag out of bounds (should clamp to innerWidth - width, innerHeight - height - headerHeight)
    // Width = 480, height = 270, headerHeight = 37
    // Max left: 1024 - 480 = 544
    // Max top: 768 - 270 - 37 = 461
    const moveOutOfBoundsEvent = new PointerEvent('pointermove', {
      clientX: 500, // deltaX = 400
      clientY: 500, // deltaY = 400
      bubbles: true,
    });
    header.element.dispatchEvent(moveOutOfBoundsEvent);
    await nextTick();
    expect(element.style.left).toBe('544px');
    expect(element.style.top).toBe('461px');

    // Drag end
    const upEvent = new PointerEvent('pointerup', { bubbles: true });
    header.element.dispatchEvent(upEvent);
    expect(HTMLElement.prototype.releasePointerCapture).toHaveBeenCalled();

    wrapper.unmount();
  });

  it('handles resizing with pointer events and clamps aspect ratio 16:9', async () => {
    const wrapper = mount(ExpandedScreenshare, {
      props: {
        id: 'user1',
        name: 'Bob',
        track,
        index: 0,
      },
    });

    const resizeHandle = wrapper.find('.resizeHandle');

    // Drag with other mouse buttons should be ignored
    const resizeDownRight = new PointerEvent('pointerdown', {
      bubbles: true,
    });
    Object.defineProperty(resizeDownRight, 'button', { value: 2 });
    resizeHandle.element.dispatchEvent(resizeDownRight);
    expect(HTMLElement.prototype.setPointerCapture).not.toHaveBeenCalled();

    // Start resize
    const resizeDown = new PointerEvent('pointerdown', {
      button: 0,
      clientX: 830,
      bubbles: true,
    });
    resizeHandle.element.dispatchEvent(resizeDown);
    expect(HTMLElement.prototype.setPointerCapture).toHaveBeenCalled();

    // Move to expand size (deltaX = 100)
    const resizeMove = new PointerEvent('pointermove', {
      clientX: 930,
      bubbles: true,
    });
    resizeHandle.element.dispatchEvent(resizeMove);
    await nextTick();

    const element = wrapper.find('.expandedScreenshareWindow').element as HTMLElement;
    const content = wrapper.find('.windowContent').element as HTMLElement;
    // initial width = 480, deltaX = 100 -> width = 580.
    // height = 580 * 9 / 16 = 326.25 -> rounded to 326.
    expect(element.style.width).toBe('580px');
    expect(content.style.height).toBe('326px');

    // Move to shrink below minimum size (320px)
    const resizeMoveSmall = new PointerEvent('pointermove', {
      clientX: 600, // deltaX = -230 -> width = 250, clamped to 320
      bubbles: true,
    });
    resizeHandle.element.dispatchEvent(resizeMoveSmall);
    await nextTick();
    expect(element.style.width).toBe('320px');
    expect(content.style.height).toBe('180px');

    // Finish resize
    const resizeUp = new PointerEvent('pointerup', { bubbles: true });
    resizeHandle.element.dispatchEvent(resizeUp);
    expect(HTMLElement.prototype.releasePointerCapture).toHaveBeenCalled();

    wrapper.unmount();
  });

  it('clamps coordinates and width when window is resized', async () => {
    const wrapper = mount(ExpandedScreenshare, {
      props: {
        id: 'user1',
        name: 'Bob',
        track,
        index: 0,
      },
    });

    const element = wrapper.find('.expandedScreenshareWindow').element as HTMLElement;

    // Initial positioning: left=350, top=120, width=480, height=270, headerHeight=37
    expect(element.style.left).toBe('350px');
    expect(element.style.top).toBe('120px');

    // Resize window to smaller dimensions than window width (e.g. 400x300)
    window.innerWidth = 400;
    window.innerHeight = 300;

    // Trigger window resize event
    window.dispatchEvent(new Event('resize'));
    await nextTick();

    // Width should shrink to fit window.innerWidth: Math.max(320, 400) -> 400px
    // Left clamps to innerWidth - width = 400 - 400 = 0px
    // Height is 400 * 9 / 16 = 225px
    // Top clamps to innerHeight - height - headerHeight = 300 - 225 - 37 = 38px
    expect(element.style.width).toBe('400px');
    expect(element.style.left).toBe('0px');
    expect(element.style.top).toBe('38px');

    // Resize window to even smaller size (e.g. 250x200)
    window.innerWidth = 250;
    window.innerHeight = 200;
    window.dispatchEvent(new Event('resize'));
    await nextTick();

    // Width clamps to absolute min 320px
    expect(element.style.width).toBe('320px');

    wrapper.unmount();
  });
});
