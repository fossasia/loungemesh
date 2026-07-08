import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import {
  canvasToPngBlob,
  downloadBlob,
  exportFileName,
  notesToMarkdown,
  renderWhiteboardToCanvas,
  markdownToRtf,
  safeSessionSlug,
} from '@/utils/sessionExport';

/** Download helpers for the host's end-of-session exports (notes, whiteboard, recording). */
export function useSessionExport(getSessionId: () => string) {
  const features = useSessionFeaturesStore();

  function exportNotes(): void {
    const markdown = notesToMarkdown(features.sharedNotes, getSessionId());
    downloadBlob(new Blob([markdown], { type: 'text/markdown' }), exportFileName('notes', getSessionId()));
  }

  function exportNotesRtf(): void {
    const titleText = `LoungeMesh public notes — ${safeSessionSlug(getSessionId())}`;
    const rtfContent = markdownToRtf(features.sharedNotes, titleText);
    downloadBlob(new Blob([rtfContent], { type: 'application/rtf' }), exportFileName('notes-rtf', getSessionId()));
  }

  async function exportWhiteboard(): Promise<void> {
    const canvas = renderWhiteboardToCanvas(features.whiteboardStrokes);
    const blob = await canvasToPngBlob(canvas);
    if (blob) downloadBlob(blob, exportFileName('whiteboard', getSessionId()));

    for (let i = 0; i < features.whiteboardSnapshots.length; i++) {
      const snapCanvas = renderWhiteboardToCanvas(features.whiteboardSnapshots[i]);
      const snapBlob = await canvasToPngBlob(snapCanvas);
      /* v8 ignore next 3 */
      if (snapBlob) {
        downloadBlob(snapBlob, exportFileName(`whiteboard-snapshot-${i + 1}`, getSessionId()));
      }
    }
  }

  function exportRecording(blob: Blob): void {
    downloadBlob(blob, exportFileName('recording', getSessionId(), new Date(), 'mp4'));
  }

  return { exportNotes, exportNotesRtf, exportWhiteboard, exportRecording };
}
