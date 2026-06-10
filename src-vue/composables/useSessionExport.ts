import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import {
  canvasToPngBlob,
  downloadBlob,
  exportFileName,
  notesToMarkdown,
  renderWhiteboardToCanvas,
} from '@/utils/sessionExport';

/** Download helpers for the host's end-of-session exports (notes, whiteboard, recording). */
export function useSessionExport(getSessionId: () => string) {
  const features = useSessionFeaturesStore();

  function exportNotes(): void {
    const markdown = notesToMarkdown(features.sharedNotes, getSessionId());
    downloadBlob(new Blob([markdown], { type: 'text/markdown' }), exportFileName('notes', getSessionId()));
  }

  async function exportWhiteboard(): Promise<void> {
    const canvas = renderWhiteboardToCanvas(features.whiteboardStrokes);
    const blob = await canvasToPngBlob(canvas);
    if (blob) downloadBlob(blob, exportFileName('whiteboard', getSessionId()));
  }

  function exportRecording(blob: Blob): void {
    downloadBlob(blob, exportFileName('recording', getSessionId(), new Date(), 'mp4'));
  }

  return { exportNotes, exportWhiteboard, exportRecording };
}
