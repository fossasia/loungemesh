/** Pixels the on-screen keyboard covers, from the visual viewport. */
export function keyboardInsetPx(
  viewport: { height: number; offsetTop: number } | null,
  innerHeight: number,
): number {
  if (!viewport) return 0;
  return Math.max(0, innerHeight - viewport.height - viewport.offsetTop);
}

/** Keep the chat sheet above the keyboard while it is open. */
export function bindKeyboardInset(target: HTMLElement, win: Window = window): () => void {
  const apply = () => {
    target.style.setProperty('--lm-keyboard-inset', `${keyboardInsetPx(win.visualViewport, win.innerHeight)}px`);
  };
  apply();
  const viewport = win.visualViewport;
  viewport?.addEventListener('resize', apply);
  viewport?.addEventListener('scroll', apply);
  return () => {
    viewport?.removeEventListener('resize', apply);
    viewport?.removeEventListener('scroll', apply);
  };
}
