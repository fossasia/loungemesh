import { describe, expect, it, vi } from 'vitest';
import { bindKeyboardInset, keyboardInsetPx } from './chatKeyboardInset';

describe('chatKeyboardInset', () => {
  it('returns zero when there is no visual viewport', () => {
    expect(keyboardInsetPx(null, 800)).toBe(0);
  });

  it('returns the covered height and ignores a negative inset', () => {
    expect(keyboardInsetPx({ height: 500, offsetTop: 0 }, 800)).toBe(300);
    expect(keyboardInsetPx({ height: 900, offsetTop: 0 }, 800)).toBe(0);
  });

  it('writes the inset and listens while a visual viewport exists', () => {
    const target = document.createElement('div');
    const listeners = new Map<string, EventListener>();
    const viewport = {
      height: 500,
      offsetTop: 20,
      addEventListener: (name: string, fn: EventListener) => listeners.set(name, fn),
      removeEventListener: vi.fn(),
    };
    const win = {
      innerHeight: 800,
      visualViewport: viewport,
    } as unknown as Window;
    const stop = bindKeyboardInset(target, win);
    expect(target.style.getPropertyValue('--lm-keyboard-inset')).toBe('280px');
    viewport.height = 400;
    listeners.get('resize')?.(new Event('resize'));
    expect(target.style.getPropertyValue('--lm-keyboard-inset')).toBe('380px');
    listeners.get('scroll')?.(new Event('scroll'));
    stop();
    expect(viewport.removeEventListener).toHaveBeenCalledTimes(2);
  });

  it('still applies an inset when the window has no visual viewport', () => {
    const target = document.createElement('div');
    const stop = bindKeyboardInset(target, { innerHeight: 700, visualViewport: null } as unknown as Window);
    expect(target.style.getPropertyValue('--lm-keyboard-inset')).toBe('0px');
    stop();
  });
});
