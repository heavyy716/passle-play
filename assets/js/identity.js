/* Passle — identity resolver (Teams-aware).
   ------------------------------------------------------------------
   Goal: give every player a STABLE person id ("pid") so the shared
   leaderboard and daily board can attribute scores.

   Two worlds, one contract:
     • Inside Microsoft Teams  -> pid = "aad:<user object id>" (real per-person
       identity from the Teams SDK context), display name = their AAD name.
       This is what makes the board "tied to everyone's Teams account."
     • Anywhere else (browser / installed PWA) -> pid = the existing anonymous
       device id from usage.js (GTPAnonId). Optional gamertag as today.

   We resolve Teams asynchronously, but the existing usage.js / leaderboard.js
   fire on load. So we:
     1. Apply any *cached* identity synchronously (returning players in Teams
        get their aad id immediately).
     2. If we look like a Teams tab, load the Teams SDK, read the context, cache
        it, seed the profile (name + share), then RE-FIRE the beacons so the
        first-ever Teams session still lands on the board.

   Nothing here is trusted for anything destructive — for a real account wipe
   we'll validate a Teams SSO token server-side first. This is the agile MVP. */
(function () {
  'use strict';

  var IDENT_KEY = 'gtp_ident';       // {pid, name, source}
  var PROFILE_KEY = 'gtp_profile';   // shared with profile.js
  var TEAMS_SDK = 'https://res.cdn.office.net/teams-js/2.24.0/js/MicrosoftTeams.min.js';

  var state = { pid: '', name: '', source: 'web', inTeams: false, ready: false };
  var readyCbs = [];

  function cache() { try { return JSON.parse(localStorage.getItem(IDENT_KEY)) || null; } catch (e) { return null; } }
  function saveCache() {
    try { localStorage.setItem(IDENT_KEY, JSON.stringify({ pid: state.pid, name: state.name, source: state.source })); } catch (e) {}
  }

  function anonId() {
    // Reuse usage.js's stable device id if present; otherwise mint one.
    try { if (window.GTPAnonId) return GTPAnonId(); } catch (e) {}
    var k = 'gtp_anon', id = null;
    try { id = localStorage.getItem(k); } catch (e) {}
    if (!id) {
      id = (Date.now().toString(36) + Math.random().toString(36).slice(2));
      try { localStorage.setItem(k, id); } catch (e) {}
    }
    return id;
  }

  // Make the *existing* leaderboard/usage code key by our resolved pid by
  // overriding the global id accessor they both call.
  function applyOverride() {
    var pid = state.pid || anonId();
    state.pid = pid;
    window.GTPAnonId = function () { return pid; };
  }

  function looksLikeTeams() {
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('src') === 'teams') return true;
      if (window.name && window.name.indexOf('embedded-page-container') !== -1) return true;
      var ref = document.referrer || '';
      if (/teams\.microsoft\.com|teams\.cloud\.microsoft|teams\.live\.com/i.test(ref)) return true;
      // Teams desktop/web host frames the tab; a bare top-level window is not Teams.
      if (window.parent !== window && /msteams|teams/i.test(navigator.userAgent)) return true;
    } catch (e) {}
    return false;
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // In Teams, default the local profile to the person's real name + sharing on
  // so they show up on the board by name — without clobbering later edits.
  function seedProfile(name) {
    try {
      var p = JSON.parse(localStorage.getItem(PROFILE_KEY)) || {};
      var changed = false;
      if (!p._teamsSeeded) {
        if (name && (!p.name || p.name === 'Player')) { p.name = name.slice(0, 20); changed = true; }
        if (p.share === undefined) { p.share = true; changed = true; }
        p._teamsSeeded = true; changed = true;
      }
      if (changed) {
        localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
        try { document.dispatchEvent(new Event('gtp:profilechange')); } catch (e) {}
      }
    } catch (e) {}
  }

  function finishReady() {
    state.ready = true;
    applyOverride();
    saveCache();
    var cbs = readyCbs.slice(); readyCbs = [];
    cbs.forEach(function (cb) { try { cb(publicState()); } catch (e) {} });
  }

  function publicState() {
    return { pid: state.pid, name: state.name, source: state.source, inTeams: state.inTeams, ready: state.ready };
  }

  function refireBeacons() {
    // Now that we hold the real pid, re-post so this session lands on the board.
    try { if (window.GTPLeaderboard) GTPLeaderboard.submit(true); } catch (e) {}
    try {
      fetch('/api/ping', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anon: state.pid, page: (location.pathname.split('/').pop() || 'index.html'), source: state.source }),
        keepalive: true,
      }).catch(function () {});
    } catch (e) {}
  }

  function resolveTeams() {
    return loadScript(TEAMS_SDK).then(function () {
      var T = window.microsoftTeams;
      if (!T || !T.app) throw new Error('no teams sdk');
      return T.app.initialize().then(function () { return T.app.getContext(); });
    }).then(function (ctx) {
      var u = (ctx && ctx.user) || {};
      var oid = u.id || u.aadObjectId || '';
      if (!oid) throw new Error('no user id');
      state.pid = 'aad:' + oid;
      state.name = u.displayName || u.userPrincipalName || '';
      state.source = 'teams';
      state.inTeams = true;
      seedProfile(state.name);
      applyOverride();
      saveCache();
      finishReady();
      refireBeacons();
      try { window.microsoftTeams.app.notifySuccess(); } catch (e) {}
      return publicState();
    });
  }

  // ---- boot ---------------------------------------------------------------
  // 1) Apply cached identity synchronously (fast path for returning players).
  var c = cache();
  if (c && c.pid) {
    state.pid = c.pid; state.name = c.name || ''; state.source = c.source || 'web';
    state.inTeams = state.source === 'teams';
  } else {
    state.pid = anonId();
  }
  applyOverride();

  // 2) If this looks like a Teams tab, resolve the real identity async.
  if (looksLikeTeams()) {
    resolveTeams().catch(function () { finishReady(); });
  } else {
    finishReady();
  }

  // ---- public API ---------------------------------------------------------
  window.GTPIdentity = {
    get: publicState,
    pid: function () { return state.pid || anonId(); },
    inTeams: function () { return state.inTeams; },
    ready: function (cb) {
      if (typeof cb !== 'function') return;
      if (state.ready) cb(publicState()); else readyCbs.push(cb);
    },
    // Post a daily gauntlet result to the shared daily leaderboard.
    submitDaily: function (r) {
      r = r || {};
      var p = {};
      try { p = (window.GTPProfile && GTPProfile.current()) || {}; } catch (e) {}
      var body = {
        anon: state.pid || anonId(),
        tag: p.share ? (p.name || state.name || '') : '',
        share: !!p.share,
        source: state.source,
        date: r.date || (window.GTP && GTP.todayKey ? GTP.todayKey() : ''),
        score: Math.round(r.score || 0),
        solved: r.solved || 0,
        total: r.total || 0,
      };
      try {
        return fetch('/api/daily', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body), keepalive: true,
        }).then(function (x) { return x.json(); }).catch(function () { return null; });
      } catch (e) { return Promise.resolve(null); }
    },
  };
})();
