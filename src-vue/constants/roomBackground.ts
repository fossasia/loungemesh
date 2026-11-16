export const GRID_BACKGROUND_REQUIREMENTS = {
  /** Longest edge on first encode pass (busy images are downscaled further if needed). */
  maxDimension: 2048,
  /** Smallest longest edge tried before giving up. */
  minSyncDimension: 320,
  /** Raw upload limit before resizing. */
  maxFileBytes: 2 * 1024 * 1024,
  /** Target max data-url length for conference command sync (includes base64 overhead). */
  maxSyncBytes: 400_000,
  /** JPEG quality steps, tried from highest to lowest at each size. */
  syncQualitySteps: [0.85, 0.75, 0.65, 0.55, 0.45, 0.35, 0.25] as const,
  /** Factor applied between size passes when the image is still too large. */
  syncDimensionScale: 0.75,
  formats: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'] as const,
  extensions: ['.png', '.jpg', '.jpeg', '.webp'] as const,
  formatLabels: 'PNG, JPEG, JPG, or WebP',
} as const;

export const NOTES_TEMPLATE_REQUIREMENTS = {
  maxFileBytes: 256 * 1024,
  extensions: ['.md', '.markdown', '.txt'] as const,
} as const;
