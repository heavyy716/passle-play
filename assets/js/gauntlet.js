/* Passle Daily Gauntlet
   ---------------------
   Runs ONE round of each selected game, back to back, then shows a combined
   scorecard. State lives in sessionStorage so it survives the page-to-page
   navigations (each game is its own HTML page).

   Run shape (sessionStorage key 'gtp_gauntlet'):
     { active, difficulty, og, order:[mode...], idx, results:[{mode,solved,score}],
       startedAt, saved:{daily,difficulty,og} }

   Each game page calls GTPGauntlet.onResult({mode, solved, score}) from its
   end-of-round path; the runner records it, rewrites the result buttons into a
   single "Next Challenge" CTA, and advances on click. */
(function () {
  'use strict';
  var KEY = 'gtp_gauntlet';

  // Full roster in play order. ogOk = has data in Original XBOX mode.
  var MODES = [
    { mode: 'boxart',      href: 'boxart.html',      label: 'Box Art',      icon: '\uD83C\uDFAE', ogOk: true  },
    { mode: 'screenshot',  href: 'screenshot.html',  label: 'Screenshot',   icon: '\uD83D\uDCF8', ogOk: true  },
    { mode: 'guessgame',   href: 'guessgame.html',   label: 'Guess Game',   icon: '\uD83C\uDFC6', ogOk: true  },
    { mode: 'riddle',      href: 'riddle.html',      label: 'Riddle',       icon: '\uD83E\uDDE9', ogOk: true  },
    { mode: 'tier',        href: 'tier.html',        label: 'Tier',         icon: '\uD83C\uDF97\uFE0F', ogOk: false },
    { mode: 'review',      href: 'review.html',      label: 'Review',       icon: '\u2B50', ogOk: false },
    { mode: 'higherlower', href: 'higherlower.html', label: 'Higher/Lower', icon: '\u2696\uFE0F', ogOk: false },
    { mode: 'score',       href: 'score.html',       label: 'Score',        icon: '\uD83C\uDFAF', ogOk: false },
    { mode: 'trivia',      href: 'trivia.html',      label: 'Trivia',       icon: '\u2753', ogOk: true  }
  ];
  var BY = {};
  MODES.forEach(function (m) { BY[m.mode] = m; });

  function read() { try { return JSON.parse(sessionStorage.getItem(KEY)) || null; } catch (e) { return null; } }
  function write(r) { try { sessionStorage.setItem(KEY, JSON.stringify(r)); } catch (e) {} }
  function wipe() { try { sessionStorage.removeItem(KEY); } catch (e) {} }
  function active() { var r = read(); return !!(r && r.active); }

  function page() { return (location.pathname.split('/').pop() || 'index.html').toLowerCase(); }
  function isGamePage() { for (var i = 0; i < MODES.length; i++) if (MODES[i].href === page()) return true; return false; }

  // ---- settings backup / override so each round uses the chosen difficulty and
  // plays a fresh single round (not the persisted daily puzzle, which would auto
  // -complete and skip). Restored when the gauntlet finishes or is quit.
  function applyRunSettings(run) {
    if (!window.GTPEngine) return;
    var S = GTPEngine.getSettings();
    if (!run.saved) {
      run.saved = { daily: S.daily, difficulty: S.difficulty, og: !!S.og };
      write(run);
    }
    S.daily = false;
    S.difficulty = run.difficulty || S.difficulty;
    S.og = !!run.og;
    GTPEngine.saveSettings(S);
  }
  function restoreSettings(run) {
    if (!window.GTPEngine || !run || !run.saved) return;
    var S = GTPEngine.getSettings();
    S.daily = run.saved.daily;
    S.difficulty = run.saved.difficulty;
    S.og = run.saved.og;
    GTPEngine.saveSettings(S);
  }

  // ---- lifecycle ---------------------------------------------------------
  function start(modes, difficulty, og) {
    var order = MODES.filter(function (m) { return modes.indexOf(m.mode) >= 0; }).map(function (m) { return m.mode; });
    if (!order.length) return;
    var run = { active: true, difficulty: difficulty, og: !!og, order: order, idx: 0, results: [], startedAt: Date.now() };
    applyRunSettings(run);
    write(run);
    location.href = BY[order[0]].href;
  }

  function onResult(r) {
    var run = read();
    if (!run || !run.active) return;
    run.results[run.idx] = { mode: r.mode, solved: !!r.solved, score: Math.round(r.score || 0) };
    write(run);
    injectAdvance(run);
  }

  function advance() {
    var run = read();
    if (!run) { location.href = 'index.html'; return; }
    run.idx++;
    write(run);
    if (run.idx >= run.order.length) { location.href = 'gauntlet-summary.html'; return; }
    location.href = BY[run.order[run.idx]].href;
  }

  function quit() {
    var run = read();
    restoreSettings(run);
    wipe();
    location.href = 'index.html';
  }

  // Called by the summary page once results are shown.
  function finish() {
    var run = read();
    restoreSettings(run);
    wipe();
  }

  function totals(run) {
    var r = run || read(); if (!r) return { solved: 0, score: 0, total: 0 };
    var solved = 0, score = 0;
    (r.results || []).forEach(function (x) { if (x) { if (x.solved) solved++; score += x.score || 0; } });
    return { solved: solved, score: score, total: (r.order || []).length };
  }

  // ---- in-game UI: progress banner + Next Challenge button ---------------
  function injectBanner(run) {
    if (document.getElementById('gauntletBanner')) return;
    var t = totals(run);
    var m = BY[run.order[run.idx]] || {};
    var bar = document.createElement('div');
    bar.id = 'gauntletBanner';
    bar.className = 'gauntlet-banner';
    bar.innerHTML =
      '<span class="gb-tag">\uD83C\uDFAF GAUNTLET</span>' +
      '<span class="gb-step">' + (m.icon || '') + ' ' + esc(m.label || '') +
      ' \u2014 Game <b>' + (run.idx + 1) + '</b>/' + run.order.length + '</span>' +
      '<span class="gb-dots">' + run.order.map(function (mode, i) {
        var res = run.results[i];
        var cls = i === run.idx ? 'cur' : (res ? (res.solved ? 'won' : 'lost') : '');
        return '<i class="gb-dot ' + cls + '"></i>';
      }).join('') + '</span>' +
      '<span class="gb-score">\u2211 ' + t.score + '</span>' +
      '<button class="gb-quit" id="gauntletQuit" title="Quit gauntlet">\u2715</button>';
    document.body.insertBefore(bar, document.body.firstChild);
    document.body.classList.add('has-gauntlet-banner');
    var q = document.getElementById('gauntletQuit');
    if (q) q.onclick = function () { if (confirm('Quit the gauntlet? Your run so far will be discarded.')) quit(); };
  }

  function injectAdvance(run) {
    // Wait a tick for the game's result markup to render, then swap its button
    // row for a single Next Challenge / See Results CTA.
    setTimeout(function () {
      var res = document.getElementById('result');
      if (!res) return;
      var row = res.querySelector('.btnrow');
      if (!row) {
        row = document.createElement('div');
        row.className = 'btnrow';
        row.style.marginTop = '14px';
        (res.querySelector('.result') || res).appendChild(row);
      }
      var last = run.idx >= run.order.length - 1;
      var share = row.querySelector('#shareBtn');
      row.innerHTML = '';
      if (share) row.appendChild(share);
      var b = document.createElement('button');
      b.className = 'btn primary gauntlet-next';
      b.innerHTML = last ? 'See Results \u2192' : 'Next Challenge \u2192';
      b.onclick = advance;
      row.appendChild(b);
      // refresh the banner score
      var bs = document.querySelector('#gauntletBanner .gb-score');
      if (bs) bs.textContent = '\u2211 ' + totals(read()).score;
      try { b.focus(); } catch (e) {}
    }, 0);
  }

  function esc(s) { return window.GTPEngine ? GTPEngine.escapeHtml(s) : ('' + s); }

  // ---- boot --------------------------------------------------------------
  // On a game page mid-gauntlet: force the run's settings before the engine
  // reads them, then drop in the progress banner once the DOM is ready.
  if (active() && isGamePage()) {
    var run0 = read();
    applyRunSettings(run0);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { injectBanner(read()); });
    } else {
      injectBanner(read());
    }
  }

  window.GTPGauntlet = {
    MODES: MODES,
    active: active,
    state: read,
    start: start,
    onResult: onResult,
    advance: advance,
    quit: quit,
    finish: finish,
    totals: totals,
    modeInfo: function (m) { return BY[m]; }
  };
})();
