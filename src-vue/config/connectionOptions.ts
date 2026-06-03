/**
 * Browser XMPP/WebSocket endpoints and Prosody domain (`hosts.*`) differ for
 * docker-jitsi-meet: websocket hits the **public** HTTP(S) URL, while `domain`
 * / `muc` are the internal XMPP names (usually `meet.jitsi`).
 */
export function getConnectionOptions(): Record<string, unknown> {
  const publicUrl = import.meta.env.VITE_JITSI_PUBLIC_URL?.trim?.();
  const xmppDomain = import.meta.env.VITE_XMPP_DOMAIN?.trim?.();
  const xmppMuc = import.meta.env.VITE_XMPP_MUC_DOMAIN?.trim?.();
  const serviceUrl = import.meta.env.VITE_SERVICE_URL?.trim?.();
  const useWebSocket = import.meta.env.VITE_USE_WEBSOCKET === 'true';

  if (publicUrl && xmppDomain) {
    const base = publicUrl.replace(/\/$/, '');
    const wsBase = /^https:/i.test(base) ? base.replace(/^https:/i, 'wss:') : base.replace(/^http:/i, 'ws:');
    const bosh = `${base}/http-bind`;
    const ws = `${wsBase}/xmpp-websocket`;
    const muc = xmppMuc || `muc.${xmppDomain}`;
    return {
      hosts: {
        domain: xmppDomain,
        muc,
        focus: `focus.${xmppDomain}`,
      },
      serviceUrl: ws,
      websocket: ws,
      bosh,
      clientNode: 'http://jitsi.org/jitsimeet',
    };
  }

  if (!serviceUrl) {
    /* Public meet.jit.si */
    return {
      hosts: {
        domain: 'meet.jit.si',
        muc: 'conference.meet.jit.si',
      },
      serviceUrl: 'wss://meet.jit.si/xmpp-websocket',
      websocket: 'wss://meet.jit.si/xmpp-websocket',
      bosh: 'https://meet.jit.si/http-bind',
      clientNode: 'http://jitsi.org/jitsimeet',
    };
  }

  /* Legacy single-host Jitsi (hostname equals XMPP domain) */
  return {
    serviceUrl: useWebSocket ? `wss://${serviceUrl}/xmpp-websocket` : `//${serviceUrl}/http-bind`,
    hosts: {
      domain: serviceUrl,
      muc: `conference.${serviceUrl}`,
      focus: `focus.${serviceUrl}`,
    },
    externalConnectUrl: `https://${serviceUrl}/http-pre-bind`,
    bosh: `//${serviceUrl}/http-bind`,
    websocket: `wss://${serviceUrl}/xmpp-websocket`,
    clientNode: 'http://jitsi.org/jitsimeet',
  };
}
