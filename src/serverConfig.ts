import {connectionOptions as defaultOptions} from './serverConfig-example';

const customConnectionOptions = {

  //# if you configured your jitsi installation to use websockets, else using bosh for connection 
  serviceUrl: process.env.REACT_APP_USE_WEBSOCKET==="true" ? `wss://${process.env.REACT_APP_SERVICE_URL}/xmpp-websocket` : `//${process.env.REACT_APP_SERVICE_URL}/http-bind`,
  hosts: {
    domain: `${process.env.REACT_APP_SERVICE_URL}`,
    muc: `conference.${process.env.REACT_APP_SERVICE_URL}`,
    //# (optional) specify the focus component to use (part of the XMPP stuff). defaults to the value of hosts.domain if not set.
    focus: `focus.${process.env.REACT_APP_SERVICE_URL}`,
  },

  //# External Connect Urlcan speed up connection if you're using bosh; probably https://$JITSI_MEET_WEB_DOMAIN/http-pre-bind
  //# You need to define this url ( ‘//mydomain/http-pre-bind’) in the nginx config the same way the ‘http-bind’ is defined and write a module that listens on some port and establishes a bosh connection and returns the sid of the bosh session to the client
  //# read about it here: https://community.jitsi.org/t/how-to-enable-externalconnecturl-in-config-jitsi-meet/14440
  externalConnectUrl: `https://${process.env.REACT_APP_SERVICE_URL}/http-pre-bind`,

  //# (Deprecated - now set in serviceUrl on top - only use if you try with meet.jit.si and uncomment serviceUrl on top)) 
  //# bosh can be set to the url of the Prosody XMPP server to be contacted via BOSH.
  //# if you don't set this, it will default to /http-bind
  // bosh: `https://${process.env.REACT_APP_SERVICE_URL}/http-bind?room=chatmosphere1234`, // ! if you make your own please omit the "?room=chatmosphere1234" part
  bosh: `//${process.env.REACT_APP_SERVICE_URL}/http-bind`, // ! if you make your own please omit the "?room=chatmosphere1234" part
  websocket: `wss://${process.env.REACT_APP_SERVICE_URL}/xmpp-websocket`,

  // !! leave this exactly as is !!
  clientNode: 'http://jitsi.org/jitsimeet'
}

export const connectionOptions = process.env.REACT_APP_SERVICE_URL ? customConnectionOptions : defaultOptions;