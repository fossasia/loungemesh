export const conferenceNameDefault = 'flowspace';

export const jitsiInitOptions = {
  disableAudioLevels: true,
  enableWindowOnErrorHandler: false,
};

export const conferenceOptions = {
  /**
   * Bridge channel to JVB. REQUIRED for the bridge to forward remote video:
   * the client signals receiver constraints (which sources it wants) over this
   * channel, otherwise modern JVB forwards audio only and remote tiles stay black.
   *
   * 'datachannel' runs the channel over the existing WebRTC SCTP connection, so
   * it needs no colibri-websocket, no Caddy proxy, and no public IP — it works
   * identically in local dev and production.
   */
  openBridgeChannel: 'datachannel' as const,
  /** Always use JVB — P2P breaks replaceTrack / remote media in Flowspace. */
  p2p: { enabled: false },
  /**
   * Single video encoding per sender. Simpler and reliable for Flowspace tiles;
   * avoids simulcast setParameters edge cases across Chrome/Firefox.
   */
  disableSimulcast: true,
  channelLastN: 16,
  enableLayerSuspension: false,
};
