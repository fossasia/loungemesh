/**
 * Runs before lib-jitsi-meet. Suppresses lib-jitsi console noise unless media debug is on.
 * Debug: localStorage.setItem('loungemesh:media-debug', '1') then reload.
 */
(function installLoungeMeshJitsiBootstrap() {
  var FILTER_VERSION = 3;

  function isMediaDebug() {
    try {
      return localStorage.getItem('loungemesh:media-debug') === '1';
    } catch {
      return false;
    }
  }

  var jitsiPatterns = [
    /^\d{4}-\d{2}-\d{2}T[\d:.]+Z \[(INFO|DEBUG|TRACE|WARN|ERROR)\] \[/,
    /\[(xmpp|rtc|core|stats|qc|misc|videosipgw):[^\]]+\]/i,
    /websocket closed unexce?ctedly/i,
    /strophe:.*websocket closed/i,
    /\[rtc:BridgeChannel\]/i,
    /channel closed:/i,
    /AudioContext was prevented from starting automatically/i,
    /Analytics disabled, disposing/i,
    /Connecting audio context/i,
    /^Strophe \d+/i,
  ];

  function argText(args) {
    return Array.prototype.map
      .call(args, function (arg) {
        if (typeof arg === 'string') return arg;
        if (arg instanceof Error) return arg.message;
        try {
          return JSON.stringify(arg);
        } catch (_e) {
          return String(arg);
        }
      })
      .join(' ');
  }

  function isLoungeMeshLog(text) {
    return text.indexOf('[loungemesh:media]') !== -1;
  }

  function shouldFilter(args) {
    if (isMediaDebug()) return false;
    var text = argText(args);
    if (isLoungeMeshLog(text)) return false;
    for (var i = 0; i < jitsiPatterns.length; i++) {
      if (jitsiPatterns[i].test(text)) return true;
    }
    return false;
  }

  function installConsoleFilter() {
    if (isMediaDebug()) return;
    if (window.__loungemeshJitsiConsoleFilterVersion === FILTER_VERSION) return;

    if (!window.__loungemeshConsoleOriginals) {
      window.__loungemeshConsoleOriginals = {
        log: console.log.bind(console),
        info: console.info.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console),
        debug: console.debug.bind(console),
        trace: console.trace.bind(console),
      };
    }

    var originals = window.__loungemeshConsoleOriginals;
    ['log', 'info', 'warn', 'error', 'debug'].forEach(function (level) {
      console[level] = function () {
        if (shouldFilter(arguments)) return;
        originals[level].apply(console, arguments);
      };
    });
    console.trace = function () {
      if (shouldFilter(arguments)) return;
      originals.trace.apply(console, arguments);
    };

    window.__loungemeshJitsiConsoleFilter = true;
    window.__loungemeshJitsiConsoleFilterVersion = FILTER_VERSION;
  }

  installConsoleFilter();

  window.__loungemeshSilenceJitsiLogs = function silenceJitsiLogs() {
    if (isMediaDebug()) return;
    var js = window.JitsiMeetJS;
    if (js && js.logLevels && js.setLogLevel) {
      js.setLogLevel(js.logLevels.OFF);
    }
  };
})();
