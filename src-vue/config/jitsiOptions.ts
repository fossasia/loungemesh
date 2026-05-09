export const conferenceNameDefault = 'flowspace';

export const conferenceOptions = {
  /**
   * Bridge/datachannel to JVB. Keep false unless production has:
   * - DOCKER_HOST_ADDRESS = public Elastic IP (not 172.18.x.x)
   * - ENABLE_COLIBRI_WEBSOCKET=1 and Caddy proxying /colibri-ws
   */
  openBridgeChannel: false,
  /** Always use JVB — P2P breaks replaceTrack / remote media in Flowspace. */
  p2p: { enabled: false },
  channelLastN: 16,
  enableLayerSuspension: false,
};
