import { JitsiAdapter } from './JitsiAdapter';
import type { MediaService } from './MediaService';

let engineInstance: MediaService | null = null;

export function getMediaEngineInstance(): MediaService {
  if (!engineInstance) {
    engineInstance = new JitsiAdapter();
  }
  return engineInstance;
}

export function resetMediaEngineInstance(): void {
  engineInstance?.dispose();
  engineInstance = null;
}
