// Read Me:
// These are Example Server Connection Options for the Jitsi library
// Best is to Keep them here as a reference;
// Just edit serverConfig.ts to your likings - we're using environment variables for setup and suggest you should do that too, but you can also hardcode your own values in serverConfig.js if you prefer

// if you are unsure about your settings you can derive the following options by looking at the /index.html file of your own jitsi-meet-web instance if you installed one (i.e. the server, where you can create new sessions)
export const connectionOptions = {
  hosts: {
    // curl -s https://$JITSI_MEET_WEB_DOMAIN/index.html | grep config.hosts.domain
    domain: 'meet.jit.si',
    // curl -s https://$JITSI_MEET_WEB_DOMAIN/index.html | grep config.hosts.muc
    muc: 'conference.meet.jit.si',
    // (optional) specify the focus component to use (part of the XMPP stuff). defaults to the value of hosts.domain if not set.
    focus: 'focus.meet.jit.si',
  }, 
  // probably https://$JITSI_MEET_WEB_DOMAIN/http-pre-bind
  externalConnectUrl: 'https://meet.jit.si/http-pre-bind', 

  // (optional) bosh can be set to the url of the Prosody XMPP server to be contacted via BOSH.
  // if you don't set this, it will default to /http-bind
  bosh: `https://meet.jit.si/http-bind?room=chatmosphere1234`, // ! if you make your own please omit the "?room=chatmosphere1234" part
  // serviceUrl: `//server.com/http-bind`,
  // websocket: 'wss://meet.jit.si/xmpp-websocket', 

  // leave this as is
  clientNode: 'http://jitsi.org/jitsimeet', 
}