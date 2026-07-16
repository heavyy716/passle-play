/* Passle — daily leaderboard + personal track (Teams-ready).
   ------------------------------------------------------------------
   Upgrades the single 🏆 board into three tabs without touching the menu
   wiring: it wraps GTPLeaderboard.open() (from leaderboard.js).

     • Today    -> GET /api/daily        — who's leading today's Gauntlet
     • All-time -> GET /api/leaderboard   — cumulative gamerscore (existing board)
     • You      -> GET /api/me            — your history, best, streak

   Identity comes from identity.js (Teams AAD id, else anon device id), so in
   Teams the board is naturally per-person and shows real names. With no server
   the tabs degrade gracefully to a friendly "hosted only" message. */
(function () {
  'use strict';

  function pid() {
    try { if (window.GTPIdentity) return GTPIdentity.pid(); } catch (e) {}
    try { if (window.GTPAnonId) return GTPAnonId(); } catch (e) {}
    return '';
  }
  function today() { try { return (window.GTP && GTP.todayKey) ? GTP.todayKey() : ''; } catch (e) { return ''; } }
  function esc(s) {
    return (s == null ? '' : String(s)).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function medal(rank) {
    return rank === 1 ? '\uD83E\uDD47' : rank === 2 ? '\uD83E\uDD48' : rank === 3 ? '\uD83E\uDD49' : '';
  }
  function row(rank, name, score, mine, sub) {
    var m = medal(rank);
    return '<div class="lb-row' + (mine ? ' me' : '') + '">' +
      '<span class="lb-rank">' + (m || ('#' + rank)) + '</span>' +
      '<span class="lb-name">' + esc(name || 'Anonymous') + (mine ? ' <em>(you)</em>' : '') +
      (sub ? ' <span class="small" style="opacity:.6">' + esc(sub) + '</span>' : '') + '</span>' +
      '<span class="lb-score">' + score + '</span></div>';
  }

  function fetchJSON(url) {
    return fetch(url, { headers: { 'Accept': 'application/json' } }).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status); return r.json();
    });
  }

  var hostedMsg = '<p class="small" style="margin-top:12px">The leaderboard is live only ' +
    'while Passle is being hosted (server running). Your progress is still saved on this device.</p>';

  function renderToday(box) {
    box.innerHTML = '<p class="small">Loading today\u2019s board\u2026</p>';
    fetchJSON('/api/daily?date=' + encodeURIComponent(today()) + '&anon=' + encodeURIComponent(pid()))
      .then(function (d) {
        var e = (d && d.entries) || [];
        var meta = '<div class="lb-meta">Daily Gauntlet \u2014 ' + esc(d.date || today()) +
          ' \u00b7 ' + e.length + ' player' + (e.length === 1 ? '' : 's') + '</div>';
        if (!e.length) {
          box.innerHTML = meta + '<p class="small" style="margin-top:12px">No scores yet today. ' +
            'Play the <b>Daily Gauntlet</b> to claim the top spot!</p>';
          return;
        }
        box.innerHTML = meta + '<div class="lb-list">' + e.map(function (x) {
          return row(x.rank, x.tag, x.score, x.me, x.solved + '/' + x.total);
        }).join('') + '</div>';
      })
      .catch(function () { box.innerHTML = hostedMsg; });
  }

  function renderAllTime(box) {
    box.innerHTML = '<p class="small">Loading\u2026</p>';
    var me = pid();
    fetchJSON('/api/leaderboard?pid=' + encodeURIComponent(me))
      .then(function (d) {
        var e = (d && d.entries) || [];
        var meta = '<div class="lb-meta">Gamerscore \u2014 10 pts per win \u00b7 ' +
          (d.players || e.length) + ' on the board</div>';
        if (!e.length) { box.innerHTML = meta + '<p class="small" style="margin-top:12px">No scores yet. Win a few rounds!</p>'; return; }
        box.innerHTML = meta + '<div class="lb-list">' + e.map(function (x) {
          return row(x.rank, x.tag, x.score, x.anon && x.anon === me);
        }).join('') + '</div>';
      })
      .catch(function () { box.innerHTML = hostedMsg; });
  }

  function renderYou(box) {
    box.innerHTML = '<p class="small">Loading your stats\u2026</p>';
    fetchJSON('/api/me?anon=' + encodeURIComponent(pid()))
      .then(function (d) {
        if (!d || !d.ok) { box.innerHTML = hostedMsg; return; }
        var stat = function (label, val) {
          return '<div class="you-stat"><b>' + val + '</b><span>' + label + '</span></div>';
        };
        var head = '<div class="you-stats">' +
          stat('Day streak', d.streak || 0) +
          stat('Best daily', d.best || 0) +
          stat('Days played', d.played || 0) +
          stat('Gamerscore', (d.gamerscore || 0).toLocaleString()) +
          '</div>';
        var days = (d.days || []);
        var list = days.length
          ? '<div class="lb-list" style="margin-top:12px">' + days.map(function (x) {
              return '<div class="lb-row"><span class="lb-rank">\uD83D\uDCC5</span>' +
                '<span class="lb-name">' + esc(x.date) + ' <span class="small" style="opacity:.6">' +
                x.solved + '/' + x.total + ' solved</span></span>' +
                '<span class="lb-score">' + x.score + '</span></div>';
            }).join('') + '</div>'
          : '<p class="small" style="margin-top:12px">No Daily Gauntlet runs yet. Play one to start your streak!</p>';
        var who = (window.GTPIdentity && GTPIdentity.inTeams()) ? d.name : '';
        box.innerHTML = (who ? '<div class="lb-meta">Signed in as ' + esc(who) + '</div>' : '') + head + list;
      })
      .catch(function () { box.innerHTML = hostedMsg; });
  }

  var TABS = [
    { id: 'today', label: '\uD83D\uDCC5 Today', render: renderToday },
    { id: 'all', label: '\uD83C\uDFC6 All-time', render: renderAllTime },
    { id: 'you', label: '\uD83D\uDC64 You', render: renderYou },
  ];

  function open(startTab) {
    // Push our latest cumulative score first (keeps the old behavior).
    try { if (window.GTPLeaderboard && GTPLeaderboard._submit) GTPLeaderboard._submit(true); } catch (e) {}

    var ov = document.getElementById('lbOverlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'lbOverlay';
      ov.className = 'overlay';
      ov.innerHTML =
        '<div class="modal">' +
        '<h2>\uD83C\uDFC6 Leaderboard</h2>' +
        '<div class="lb-tabs" id="lbTabs"></div>' +
        '<div id="lbBody"><p class="small">Loading\u2026</p></div>' +
        '<div class="btnrow" style="margin-top:18px"><button class="btn" id="lbClose">Close</button></div>' +
        '</div>';
      document.body.appendChild(ov);
      ov.addEventListener('click', function (e) { if (e.target === ov) ov.classList.remove('show'); });
      ov.querySelector('#lbClose').onclick = function () { ov.classList.remove('show'); };
    }
    var tabsEl = ov.querySelector('#lbTabs');
    var body = ov.querySelector('#lbBody');
    var cur = startTab || 'today';
    function draw() {
      tabsEl.innerHTML = TABS.map(function (t) {
        return '<button class="btn lb-tab' + (t.id === cur ? ' primary' : '') + '" data-tab="' + t.id + '">' + t.label + '</button>';
      }).join('');
      tabsEl.querySelectorAll('.lb-tab').forEach(function (b) {
        b.onclick = function () { cur = b.dataset.tab; draw(); };
      });
      var t = TABS.filter(function (x) { return x.id === cur; })[0] || TABS[0];
      t.render(body);
    }
    ov.classList.add('show');
    draw();
  }

  // Wrap the existing leaderboard so the menu's 🏆 button opens the tabbed board,
  // while preserving submit()/myScore() for the win beacon.
  function install() {
    var L = window.GTPLeaderboard || {};
    if (L._submit) return;                // already wrapped
    L._submit = L.submit || function () {};
    L.open = open;
    L.openDaily = function () { open('today'); };
    window.GTPLeaderboard = L;
    window.GTPDaily = { open: open };
  }
  if (window.GTPLeaderboard) install();
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
