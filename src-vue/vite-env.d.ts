/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Browser-reachable Jitsi web URL (e.g. http://localhost:8000) when using docker-jitsi-meet.
   * Use with VITE_XMPP_DOMAIN (usually meet.jitsi).
   */
  readonly VITE_JITSI_PUBLIC_URL?: string;
  readonly VITE_XMPP_DOMAIN?: string;
  readonly VITE_XMPP_MUC_DOMAIN?: string;
  /** Own Jitsi host when XMPP domain equals hostname (omit VITE_JITSI_PUBLIC_URL). */
  readonly VITE_SERVICE_URL?: string;
  readonly VITE_USE_WEBSOCKET?: string;
  readonly VITE_SESSION_PREFIX?: string;
  /** Set to e.g. https://api.eventyay.com to load optional room wallpapers. */
  readonly VITE_EVENTYAY_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
