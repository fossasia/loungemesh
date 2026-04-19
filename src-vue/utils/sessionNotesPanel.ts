export type PanelLayoutStyle = {
  right: string;
  bottom: string;
  height: string;
  notesWidth: string;
};

/** Fixed panel position; notes panel also sets width and height. */
export function featureCardStyleForPanel(
  panel: string,
  layout: PanelLayoutStyle,
): Record<string, string> {
  const base = { right: layout.right, bottom: layout.bottom };
  if (panel === 'notes') {
    return {
      ...base,
      width: layout.notesWidth,
      height: layout.height,
      maxHeight: layout.height,
    };
  }
  return base;
}

/** Whether a remote notes update should replace the local draft. */
export function shouldApplyRemoteNotesDraft(panel: string): boolean {
  return panel !== 'notes';
}

/** Merge a remote notes payload into the open-panel draft. */
export function nextNotesDraft(panel: string, remoteText: string, currentDraft: string): string {
  return shouldApplyRemoteNotesDraft(panel) ? remoteText : currentDraft;
}

/** Whether the current user may edit and publish shared notes. */
export function canPublishSharedNotes(canUseNotes: boolean): boolean {
  return canUseNotes;
}

/** Debounced notes publish — no-ops when the user cannot edit. */
export function createNotesPushScheduler(
  canUseNotes: () => boolean,
  getDraft: () => string,
  publish: (text: string) => void,
  delayMs = 400,
): { push: () => void; dispose: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const push = () => {
    if (!canPublishSharedNotes(canUseNotes())) return;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      publish(getDraft());
    }, delayMs);
  };
  const dispose = () => {
    window.clearTimeout(timer);
  };
  return { push, dispose };
}
