/** Test-only reset for useMediaEngine singleton wiring (avoids importing useMediaEngine in vitest setup). */
let wired = false;

export function isMediaEngineWired(): boolean {
  return wired;
}

export function markMediaEngineWired(): void {
  wired = true;
}

export function resetMediaEngineWiringForTests(): void {
  wired = false;
}
