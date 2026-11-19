import type { Page } from '@playwright/test';

export const MOCK_JITSI_SCRIPT = `
(function() {
  function EventEmitter() {
    this._events = {};
  }
  EventEmitter.prototype.on = function(evt, handler) {
    (this._events[evt] = this._events[evt] || []).push(handler);
    return this;
  };
  EventEmitter.prototype.addEventListener = EventEmitter.prototype.on;
  EventEmitter.prototype.removeEventListener = function(evt, handler) {
    if (!this._events[evt]) return;
    this._events[evt] = this._events[evt].filter(function(h) { return h !== handler; });
  };
  EventEmitter.prototype.emit = function(evt) {
    var args = Array.prototype.slice.call(arguments, 1);
    var list = (this._events[evt] || []).slice();
    for (var i = 0; i < list.length; i++) list[i].apply(this, args);
  };

  function MockTrack(type) {
    this._type = type || 'audio';
    this._muted = false;
  }
  MockTrack.prototype.getType = function() { return this._type; };
  MockTrack.prototype.videoType = 'camera';
  MockTrack.prototype.isLocal = function() { return true; };
  MockTrack.prototype.isMuted = function() { return this._muted; };
  MockTrack.prototype.mute = function() { this._muted = true; return Promise.resolve(); };
  MockTrack.prototype.unmute = function() { this._muted = false; return Promise.resolve(); };
  MockTrack.prototype.attach = function(el) {};
  MockTrack.prototype.detach = function(el) {};
  MockTrack.prototype.dispose = function() { return Promise.resolve(); };
  MockTrack.prototype.addEventListener = function() {};
  MockTrack.prototype.removeEventListener = function() {};
  MockTrack.prototype.getId = function() { return 'mock-track-' + this._type; };

  function MockConference() {
    EventEmitter.call(this);
    this._participants = [];
  }
  MockConference.prototype = Object.create(EventEmitter.prototype);
  MockConference.prototype.join = function() {
    var self = this;
    setTimeout(function() {
      self.emit('conference.conferenceJoined');
    }, 20);
  };
  MockConference.prototype.leave = function() { return Promise.resolve(); };
  MockConference.prototype.myUserId = function() { return 'local-user'; };
  MockConference.prototype.getParticipants = function() { return this._participants; };
  MockConference.prototype.setDisplayName = function(name) {};
  MockConference.prototype.sendTextMessage = function() {};
  MockConference.prototype.sendMessage = function() {};
  MockConference.prototype.sendCommand = function() {};
  MockConference.prototype.removeCommand = function() {};
  MockConference.prototype.addCommandListener = function() {};
  MockConference.prototype.addTrack = function() { return Promise.resolve(); };
  MockConference.prototype.removeTrack = function() { return Promise.resolve(); };
  MockConference.prototype.replaceTrack = function() { return Promise.resolve(); };
  MockConference.prototype.setLocalParticipantProperty = function() {};
  MockConference.prototype.setReceiverConstraints = function() {};
  MockConference.prototype.getLocalVideoTrack = function() { return null; };

  function MockConnection() {
    EventEmitter.call(this);
    this.xmpp = { lastErrorMsg: '', connection: { jingle: { getStunAndTurnCredentials: function() {} } } };
    this.jingle = { getStunAndTurnCredentials: function() {} };
  }
  MockConnection.prototype = Object.create(EventEmitter.prototype);
  MockConnection.prototype.connect = function() {
    var self = this;
    setTimeout(function() {
      self.emit('connection.connectionEstablished');
    }, 20);
  };
  MockConnection.prototype.disconnect = function() { return Promise.resolve(); };
  MockConnection.prototype.initJitsiConference = function(name, options) {
    return new MockConference();
  };

  window.JitsiMeetJS = {
    setLogLevel: function() {},
    logLevels: { ERROR: 'error', OFF: 'off' },
    init: function() {},
    events: {
      connection: {
        CONNECTION_ESTABLISHED: 'connection.connectionEstablished',
        CONNECTION_FAILED: 'connection.connectionFailed',
        CONNECTION_DISCONNECTED: 'connection.connectionDisconnected',
      },
      conference: {
        USER_JOINED: 'conference.userJoined',
        USER_LEFT: 'conference.userLeft',
        CONFERENCE_JOINED: 'conference.conferenceJoined',
        CONFERENCE_FAILED: 'conference.conferenceFailed',
        CONFERENCE_ERROR: 'conference.conferenceError',
        TRACK_ADDED: 'conference.trackAdded',
        TRACK_MUTE_CHANGED: 'conference.trackMuteChanged',
        TRACK_REMOVED: 'conference.trackRemoved',
        MESSAGE_RECEIVED: 'conference.messageReceived',
        PARTICIPANT_PROPERTY_CHANGED: 'conference.participantPropertyChanged',
        DISPLAY_NAME_CHANGED: 'conference.displayNameChanged',
      },
    },
    JitsiConnection: MockConnection,
    createLocalTracks: function(options) {
      var devs = (options && options.devices) || ['audio', 'video'];
      return Promise.resolve(devs.map(function(d) { return new MockTrack(d); }));
    },
  };
})();
`;

export async function setupE2EMocks(page: Page) {
  await page.route('**/libs/lib-jitsi-meet.min.js', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: MOCK_JITSI_SCRIPT,
    });
  });

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Unauthorized' }),
    });
  });
}
