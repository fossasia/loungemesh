/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

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
  /** Set to `false` only when Prosody is configured with a real TURN service. */
  readonly VITE_DISABLE_STUN_TURN_DISCOVERY?: string;
  /** Set to e.g. https://api.eventyay.com to load optional room wallpapers. */
  readonly VITE_EVENTYAY_API_BASE?: string;
  /**
   * URL of the eventyay-flowspace plugin token exchange endpoint.
   * Example: https://eventyay.com/api/v1/flowspace/token/
   * When set, /join/:id requires a valid opaque token in the URL query.
   */
  readonly VITE_EVENTYAY_JWT_ENDPOINT?: string;
  /**
   * Comma-separated list of origins allowed to embed Flowspace in an iframe.
   * Baked into the build; controls the Content-Security-Policy frame-ancestors.
   * Example: https://eventyay.com,https://video.eventyay.com
   * Leave unset to deny all framing (default).
   */
  readonly VITE_ALLOW_IFRAME_FROM?: string;
  /** Set to `true` to log video/audio pipeline events (filter console by flowspace:media). */
  readonly VITE_MEDIA_DEBUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
