export type PanelLayoutStyle = {
  right: string;
  bottom: string;
  height: string;
  notesWidth: string;
  pollWidth?: string;
};

/** Fixed panel position; notes and poll panels also set width and height. */
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
  if (panel === 'poll') {
    return {
      ...base,
      width: layout.pollWidth ?? '',
      maxHeight: layout.height,
    };
  }
  return base;
}

/** Whether a remote notes update should replace the local draft. */
export function shouldApplyRemoteNotesDraft(hasLocalEdits: boolean): boolean {
  return !hasLocalEdits;
}

/** Merge a remote notes payload into the open-panel draft. */
export function nextNotesDraft(
  hasLocalEdits: boolean,
  remoteText: string,
  currentDraft: string,
): string {
  return shouldApplyRemoteNotesDraft(hasLocalEdits) ? remoteText : currentDraft;
}

/** Skip publishing when the draft matches what is already shared. */
export function shouldPublishNotesDraft(draft: string, sharedNotes: string): boolean {
  return draft !== sharedNotes;
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
): { push: () => void; flush: () => void; cancel: () => void; dispose: () => void } {
  let timer: number | undefined;
  const runPublish = () => {
    if (!canPublishSharedNotes(canUseNotes())) return;
    publish(getDraft());
  };
  const push = () => {
    if (!canPublishSharedNotes(canUseNotes())) return;
    if (!timer) {
      timer = window.setTimeout(() => {
        timer = undefined;
        runPublish();
      }, delayMs);
    }
  };
  const flush = () => {
    window.clearTimeout(timer);
    timer = undefined;
    runPublish();
  };
  const cancel = () => {
    window.clearTimeout(timer);
    timer = undefined;
  };
  const dispose = () => {
    cancel();
  };
  return { push, flush, cancel, dispose };
}
