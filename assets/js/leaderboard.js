/* Passle — lightweight shared leaderboard (opt-in).
   Your "score" is the sum of your best Endless streaks across every game. It is
   posted to the host's server (the same one serving this page) so everyone who
   plays the same hosted Passle shares one board. Your name only appears if
   you turned on sharing in your profile; otherwise you show up anonymously.
   With no server (bare static file) this all no-ops and the board is empty. */
(function () {
  var lastSent = 0;

  // Score = the same "gamerscore" shown on the dashboard player card: 10 points
  // per win across every game mode. Kept in sync with index.html's gamerscore().
  var MODES = ['boxart', 'screenshot', 'guessgame', 'riddle', 'tier', 'review', 'higherlower', 'score'];
  function myScore() {
    var wins = 0;
    try {
      for (var i = 0; i < MODES.length; i++) {
        var s = (window.GTP && GTP.stats) ? GTP.stats.get(MODES[i]) : null;
        if (s && s.wins) wins += s.wins;
      }
    } catch (e) {}
    return wins * 10;
  }

  function profile() {
    try { return (window.GTPProfile && GTPProfile.get()) || {}; } catch (e) { return {}; }
  }

  function submit(force) {
    var score = myScore();
    if (!score) return;
    var now = Date.now();
    if (!force && now - lastSent < 4000) return; // debounce bursts of wins
    lastSent = now;
    var p = profile();
    var share = !!p.share;
    var tag = share ? (p.name || '') : '';
    try {
      fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anon: (window.GTPAnonId ? GTPAnonId() : ''),
          tag: tag, share: share, score: score,
        }),
        keepalive: true,
      }).catch(function () {});
    } catch (e) {}
  }

  function esc(s) {
    return (s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function rowHtml(e, mine) {
    var name = e.tag ? esc(e.tag) : 'Anonymous';
    var medal = e.rank === 1 ? '\uD83E\uDD47' : e.rank === 2 ? '\uD83E\uDD48' : e.rank === 3 ? '\uD83E\uDD49' : '';
    return '<div class="lb-row' + (mine ? ' me' : '') + '">' +
      '<span class="lb-rank">' + (medal || ('#' + e.rank)) + '</span>' +
      '<span class="lb-name">' + name + (mine ? ' <em>(you)</em>' : '') + '</span>' +
      '<span class="lb-score">' + e.score + '</span></div>';
  }

  function render(box, data) {
    var mineId = (window.GTPAnonId ? GTPAnonId() : '');
    var entries = (data && data.entries) || [];
    var meta = '<div class="lb-meta">' +
      (data ? (data.visitors + ' visitor' + (data.visitors === 1 ? '' : 's') +
        ' \u00b7 ' + data.players + ' on the board') : '') + '</div>';
    if (!entries.length) {
      box.innerHTML = meta +
        '<p class="small" style="margin-top:12px">No scores yet. Win a few Endless rounds ' +
        'to post the first score! (The leaderboard is shared only when Passle is being hosted.)</p>';
      return;
    }
    var mineOnBoard = entries.some(function (e) { return e.anon && e.anon === mineId; });
    var html = entries.map(function (e) { return rowHtml(e, e.anon && e.anon === mineId); }).join('');
    var footer = '';
    if (!mineOnBoard) {
      var s = myScore();
      footer = '<div class="lb-row me"><span class="lb-rank">\u2013</span>' +
        '<span class="lb-name"><em>(you)</em></span><span class="lb-score">' + s + '</span></div>';
    }
    box.innerHTML = meta + '<div class="lb-list">' + html + footer + '</div>';
  }

  function open() {
    submit(true); // push our latest score before we read the board
    var ov = document.getElementById('lbOverlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'lbOverlay';
      ov.className = 'overlay';
      ov.innerHTML =
        '<div class="modal">' +
        '<h2>\uD83C\uDFC6 Leaderboard</h2>' +
        '<div class="small" style="margin-bottom:8px">Your gamerscore \u2014 10 points per win across every game.</div>' +
        '<div id="lbBody"><p class="small">Loading\u2026</p></div>' +
        '<div class="btnrow" style="margin-top:18px">' +
        '<button class="btn" id="lbClose">Close</button></div></div>';
      document.body.appendChild(ov);
      ov.addEventListener('click', function (e) { if (e.target === ov) ov.classList.remove('show'); });
      ov.querySelector('#lbClose').onclick = function () { ov.classList.remove('show'); };
    }
    ov.classList.add('show');
    var box = ov.querySelector('#lbBody');
    box.innerHTML = '<p class="small">Loading\u2026</p>';
    fetch('/api/leaderboard').then(function (r) { return r.json(); })
      .then(function (d) { render(box, d); })
      .catch(function () {
        box.innerHTML = '<p class="small">Leaderboard is only available while Passle is being hosted. ' +
          'Your best streaks are still saved on this device.</p>';
      });
  }

  window.GTPLeaderboard = { open: open, submit: submit, myScore: myScore };

  // Submit whenever a streak is set, and once on load.
  window.addEventListener('gtp:win', function () { submit(false); });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { submit(false); });
  } else {
    submit(false);
  }
})();
