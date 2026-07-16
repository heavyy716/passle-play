/* Passle — anonymous usage beacon.
   Fire-and-forget: on each page load, POST a tiny anonymous ping so the person
   hosting Passle can tell how many people are playing. No PII: just a random
   per-device id (generated once, stored locally) + the page name. If Passle is
   opened as a bare static file (no server) the POST simply fails silently. */
(function () {
  var ANON_KEY = 'gtp_anon';

  // A stable, random, non-identifying id for this browser/device.
  function anonId() {
    var id = null;
    try { id = localStorage.getItem(ANON_KEY); } catch (e) {}
    if (!id) {
      try {
        if (window.crypto && crypto.getRandomValues) {
          var a = new Uint32Array(2); crypto.getRandomValues(a);
          id = a[0].toString(36) + a[1].toString(36);
        }
      } catch (e) {}
      if (!id) id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      try { localStorage.setItem(ANON_KEY, id); } catch (e) {}
    }
    return id;
  }
  window.GTPAnonId = anonId;

  function page() {
    var p = (location.pathname.split('/').pop() || 'index.html');
    return p || 'index.html';
  }

  function ping() {
    try {
      fetch('/api/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anon: anonId(), page: page() }),
        keepalive: true,
      }).catch(function () {});
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ping);
  } else {
    ping();
  }
})();
