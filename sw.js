/* Passle service worker — offline shell + smart caching.
   Bump CACHE when you want every client to drop old cached assets. */
const CACHE = 'passle-v68';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/style.css',
  './assets/js/gate.js?v=68',
  './assets/js/feedback.js?v=68',
  './assets/img/icons/icon-192.png?v=68',
  './assets/img/icons/icon-512.png?v=68',
  './assets/img/icons/apple-touch-icon.png',
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // Cache core items individually so one 404 can't fail the whole install.
      return Promise.all(CORE.map(function (u) {
        return c.add(u).catch(function () {});
      }));
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function putCopy(req, res) {
  if (res && res.ok) {
    var copy = res.clone();
    caches.open(CACHE).then(function (c) { c.put(req, copy); });
  }
  return res;
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  var sameOrigin = url.origin === self.location.origin;

  // Live API (leaderboard, daily board, personal stats): NEVER cache — always
  // hit the network so scores are real-time. Let the request pass straight
  // through so a failed fetch surfaces to the client's own .catch().
  if (sameOrigin && url.pathname.indexOf('/api/') === 0) {
    return;
  }

  // App navigations: network-first, fall back to cache, then the cached shell.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (r) { return putCopy(req, r); }).catch(function () {
        return caches.match(req).then(function (m) {
          return m || caches.match('./index.html');
        });
      })
    );
    return;
  }

  // Catalog data: network-first so players get the freshest games, cache fallback offline.
  if (sameOrigin && /\/data\/.*\.json$/.test(url.pathname)) {
    e.respondWith(
      fetch(req).then(function (r) { return putCopy(req, r); })
        .catch(function () { return caches.match(req); })
    );
    return;
  }

  // Everything else (CSS/JS/img/fonts/store images): stale-while-revalidate.
  e.respondWith(
    caches.match(req).then(function (cached) {
      var net = fetch(req).then(function (r) { return putCopy(req, r); })
        .catch(function () { return cached; });
      return cached || net;
    })
  );
});
