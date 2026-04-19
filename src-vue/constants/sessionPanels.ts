/** Shared layout for chat and notes panels above the footer. */
export const sessionPanelLayout = {
  bottom: '88px',
  right: '16px',
  height: 'min(720px, calc(100vh - 100px))',
} as const;

export const chatPanelWidth = 'min(400px, calc(100vw - 32px))';
export const notesPanelWidth = 'min(560px, calc(100vw - 32px))';
