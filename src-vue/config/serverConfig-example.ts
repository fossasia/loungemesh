// Example Jitsi connection options (reference). Prefer env-based `getConnectionOptions()` in `connectionOptions.ts`.

export const connectionOptions = {
  hosts: {
    domain: 'meet.jit.si',
    muc: 'conference.meet.jit.si',
    focus: 'focus.meet.jit.si',
  },
  externalConnectUrl: 'https://meet.jit.si/http-pre-bind',
  bosh: `https://meet.jit.si/http-bind?room=chatmosphere1234`,
  clientNode: 'http://jitsi.org/jitsimeet',
};
