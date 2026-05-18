/** Throttle with trailing edge — last call within the window runs after waitMs. */
export function throttle<A extends unknown[]>(
  fn: (...args: A) => void,
  waitMs: number,
): (...args: A) => void {
  let last = 0;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let pendingArgs: A | undefined;

  const run = () => {
    last = Date.now();
    timeout = undefined;
    if (pendingArgs === undefined) return;
    const args = pendingArgs;
    pendingArgs = undefined;
    fn(...args);
  };

  return (...args: A) => {
    const now = Date.now();
    const remaining = waitMs - (now - last);
    if (remaining <= 0) {
      pendingArgs = args;
      run();
      return;
    }
    pendingArgs = args;
    if (timeout) return;
    timeout = setTimeout(run, remaining);
  };
}
