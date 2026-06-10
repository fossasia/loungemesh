import { visibleViewport } from '@/constants/pan';
import { GRID_BACKGROUND_REQUIREMENTS } from '@/constants/roomBackground';

export class GridBackgroundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GridBackgroundError';
  }
}

function formatKb(bytes: number): string {
  return `${Math.round(bytes / 1024)} KB`;
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new GridBackgroundError('Could not read the image file.'));
    };
    img.src = url;
  });
}

function drawToCanvas(img: HTMLImageElement, maxDimension: number): HTMLCanvasElement {
  const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new GridBackgroundError('Could not process the image.');
  ctx.fillStyle = '#f2f2f2';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

function encodeCanvas(canvas: HTMLCanvasElement, quality: number): string | null {
  try {
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return null;
  }
}

function fitsSyncBudget(dataUrl: string | null, maxSyncBytes: number): dataUrl is string {
  return !!dataUrl && dataUrl.length <= maxSyncBytes;
}

/** Try progressively smaller sizes and lower JPEG quality until the payload fits. */
export function encodeGridBackgroundForSync(
  img: HTMLImageElement,
  limits: Pick<
    typeof GRID_BACKGROUND_REQUIREMENTS,
    'maxDimension' | 'minSyncDimension' | 'maxSyncBytes' | 'syncQualitySteps' | 'syncDimensionScale'
  > = GRID_BACKGROUND_REQUIREMENTS,
): string | null {
  const { maxDimension, minSyncDimension, maxSyncBytes, syncQualitySteps, syncDimensionScale } =
    limits;

  for (
    let maxDim: number = maxDimension;
    maxDim >= minSyncDimension;
    maxDim = Math.max(minSyncDimension, Math.round(maxDim * syncDimensionScale))
  ) {
    const canvas = drawToCanvas(img, maxDim);
    for (const quality of syncQualitySteps) {
      const dataUrl = encodeCanvas(canvas, quality);
      if (fitsSyncBudget(dataUrl, maxSyncBytes)) return dataUrl;
    }
    if (maxDim === minSyncDimension) break;
  }

  return null;
}

export function isAcceptedGridBackgroundFile(file: File): boolean {
  const { formats, extensions } = GRID_BACKGROUND_REQUIREMENTS;
  if (formats.includes(file.type as (typeof formats)[number])) return true;
  const lower = file.name.toLowerCase();
  return extensions.some((ext) => lower.endsWith(ext));
}

/** Resize and compress an uploaded grid background for conference sync. */
export async function processGridBackgroundFile(file: File): Promise<string> {
  const { formatLabels, maxFileBytes } = GRID_BACKGROUND_REQUIREMENTS;

  if (!isAcceptedGridBackgroundFile(file)) {
    throw new GridBackgroundError(`Use ${formatLabels}.`);
  }
  if (file.size > maxFileBytes) {
    throw new GridBackgroundError(`Image must be under ${formatKb(maxFileBytes)}.`);
  }

  const img = await loadImageFromFile(file);
  const dataUrl = encodeGridBackgroundForSync(img);
  if (dataUrl) return dataUrl;

  throw new GridBackgroundError(
    'Image is too detailed after processing — try a simpler or smaller file.',
  );
}

export function viewportBackgroundImageStyle(url: string): Record<string, string> {
  return {
    backgroundImage: `url("${url.replace(/"/g, '\\"')}")`,
  };
}

/** Image style for the fixed full-screen viewport layer (positioning is in CSS). */
export function viewportBackgroundStyle(url: string): Record<string, string> {
  return viewportBackgroundImageStyle(url);
}

export function gridBackgroundRequirementsHint(): string {
  const { formatLabels, maxFileBytes } = GRID_BACKGROUND_REQUIREMENTS;
  return `Any aspect ratio ${formatLabels} recommended (max ${formatKb(maxFileBytes)}). Images are optimized automatically for sharing. The wallpaper stays fixed, fills the screen, and is unaffected by pan or zoom.`;
}
