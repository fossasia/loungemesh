/** Whether a participant property marks them as on the stage strip. */
export function isOnStage(value: unknown): boolean {
  return value === true || value === 'true';
}
