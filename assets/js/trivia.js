/* Passle — Trivia mode.
   Multiple-choice trivia built entirely from facts already in games.json
   (developer, publisher, year, genre, ESRB, critic score, Game Pass tier),
   plus derived series/franchise grouping and a small curated character map.

   Two ways to play (mirrors the app's global Daily/Endless idea):
     - Daily   : 7 fixed, deterministic questions per date, no lives, shareable
                 emoji grid. Same challenge for everyone (difficulty-independent).
     - Endless : questions keep coming until you run out of lives. Difficulty
                 sets BOTH the pool of question types AND how many lives you get.

   Four difficulty tiers (names are themed via GTPEngine.diffLabel):
     easy      5 lives  — basic game facts
     medium    4 lives  — + ESRB, Game Pass tier, series
     hard      3 lives  — + critic-score range, EA Play
     legendary 1 life   — + "which game is this character from"

   Public API:  GTPTrivia.init()  (call after GTP.load()).
*/
(function () {
  'use strict';

  var MODE = 'trivia';
  var DAILY_COUNT = 7;

  // Difficulty -> lives + which generators are in play (endless only).
  var DIFF = {
    easy:      { lives: 5, types: ['developer', 'publisher', 'year', 'genre'] },
    medium:    { lives: 4, types: ['developer', 'publisher', 'year', 'genre', 'esrb', 'tier', 'series'] },
    hard:      { lives: 3, types: ['year', 'genre', 'esrb', 'tier', 'series', 'score', 'eaplay'] },
    legendary: { lives: 1, types: ['esrb', 'tier', 'series', 'score', 'eaplay', 'character', 'year'] }
  };
  // Daily is the same for everyone, so it draws from a fixed balanced set.
  var DAILY_TYPES = ['developer', 'publisher', 'year', 'genre', 'esrb', 'tier', 'series', 'character', 'score'];

  var ESRB_ALL = ['EVERYONE', 'EVERYONE 10+', 'TEEN', 'MATURE 17+'];
  var SCORE_BUCKETS = ['Below 60', '60\u201369', '70\u201379', '80\u201389', '90+'];

  // Iconic characters -> a franchise token to match against game titles. Only
  // entries whose franchise is actually present in the pool are used, so this
  // degrades gracefully as the catalog changes.
  var CHARACTERS = [
    ['Master Chief', 'halo'], ['Marcus Fenix', 'gears'], ['the Doom Slayer', 'doom'],
    ['B.J. Blazkowicz', 'wolfenstein'], ['Corvo Attano', 'dishonored'], ['Commander Shepard', 'mass effect'],
    ['the Dragonborn', 'skyrim'], ['Lara Croft', 'tomb raider'], ['Senua', 'hellblade'],
    ['Cal Kestis', 'jedi'], ['Kazuma Kiryu', 'like a dragon'], ['Kazuma Kiryu', 'yakuza'],
    ['Ryu Hayabusa', 'ninja gaiden'], ['Karl Fairburne', 'sniper elite'], ['Joker', 'persona 5'],
    ['Ori', 'ori'], ['Steve', 'minecraft'], ['Arthur Morgan', 'red dead'],
    ['Raz', 'psychonauts'], ['Sam Fisher', 'splinter cell'], ['Geralt of Rivia', 'witcher'],
    ['Nathan Drake', 'uncharted'], ['Aloy', 'horizon'], ['Agent 47', 'hitman'],
    ['Banjo', 'banjo'], ['Crash Bandicoot', 'crash'], ['Spyro', 'spyro']
  ];

  // ---- small helpers ------------------------------------------------------
  function shuffle(arr, rnd) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function sample(arr, n, rnd, exclude) {
    var ex = exclude || function () { return false; };
    var pool = arr.filter(function (x) { return !ex(x); });
    return shuffle(pool, rnd).slice(0, n);
  }
  function norm(s) { return (s || '').toString().trim(); }
  function esc(s) { return (window.GTPEngine ? GTPEngine.escapeHtml(s) : ('' + s)); }
  function scoreBucket(s) {
    if (s < 60) return SCORE_BUCKETS[0];
    if (s < 70) return SCORE_BUCKETS[1];
    if (s < 80) return SCORE_BUCKETS[2];
    if (s < 90) return SCORE_BUCKETS[3];
    return SCORE_BUCKETS[4];
  }

  // ---- data indexes (built once) -----------------------------------------
  var IX = null;
  function buildIndex(pool) {
    var developers = {}, publishers = {}, categories = {}, years = {};
    pool.forEach(function (g) {
      if (g.developer) developers[g.developer] = 1;
      if (g.publisher) publishers[g.publisher] = 1;
      if (g.category) categories[g.category] = 1;
      if (typeof g.year === 'number') years[g.year] = 1;
    });
    var yrs = Object.keys(years).map(Number);
    // Franchise groups: key on the first significant title word (minus a
    // leading article), keep groups of 3+, display the longest shared word run.
    var STOP = { the: 1, a: 1, an: 1 };
    var groups = {};
    pool.forEach(function (g) {
      var words = norm(g.title).replace(/[:\-\u2013].*$/, '').split(/\s+/).filter(Boolean);
      if (words.length && STOP[words[0].toLowerCase()]) words.shift();
      if (!words.length) return;
      var key = words[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      if (key.length < 3) return;
      (groups[key] = groups[key] || []).push(g);
    });
    var series = [];
    Object.keys(groups).forEach(function (k) {
      var members = groups[k];
      if (members.length < 3) return;
      // Longest common leading word sequence across the group's titles.
      var split = members.map(function (m) { return norm(m.title).split(/\s+/); });
      var name = [];
      for (var i = 0; ; i++) {
        var w = split[0][i];
        if (w === undefined) break;
        var all = split.every(function (s) { return (s[i] || '').toLowerCase() === w.toLowerCase(); });
        if (!all) break;
        name.push(w);
      }
      var display = name.join(' ').replace(/[:\-\u2013]$/, '').trim();
      // Reject junk franchise names: too short, or a lone common word that
      // would make a nonsense "Which is an <X> game?" prompt.
      var REJECT = { the: 1, an: 1, and: 1, of: 1, new: 1, super: 1, my: 1, one: 1, two: 1, big: 1, little: 1, dead: 1 };
      var lc = display.toLowerCase();
      if (display.length < 4 || REJECT[lc]) return;
      series.push({ name: display, members: members, ids: members.reduce(function (o, m) { o[m.id] = 1; return o; }, {}) });
    });
    var eaplay = pool.filter(function (g) {
      var t = g.tiers || {}, s = g.services || {};
      return t.eaplay || s.eaplay;
    });
    var eaplayIds = eaplay.reduce(function (o, g) { o[g.id] = 1; return o; }, {});
    var chars = CHARACTERS.filter(function (c) {
      return pool.some(function (g) { return norm(g.title).toLowerCase().indexOf(c[1]) >= 0; });
    });
    IX = {
      pool: pool,
      developers: Object.keys(developers), publishers: Object.keys(publishers),
      categories: Object.keys(categories), years: yrs,
      yearMin: Math.min.apply(null, yrs), yearMax: Math.max.apply(null, yrs),
      series: series, eaplay: eaplay, eaplayIds: eaplayIds, chars: chars,
      scored: pool.filter(function (g) { return typeof g.criticScore === 'number' && g.criticScore > 0; })
    };
    return IX;
  }

  // ---- question generators (each returns a question object or null) -------
  // question: { type, prompt, choices:[str x4], correct:int, game }
  function q(type, prompt, choices, correctVal, game, rnd) {
    var opts = shuffle(choices, rnd);
    return { type: type, prompt: prompt, choices: opts, correct: opts.indexOf(correctVal), game: game };
  }

  var GEN = {
    developer: function (rnd, used) {
      var g = pickGame(rnd, used, function (x) { return !!x.developer; });
      if (!g) return null;
      var others = sample(IX.developers, 3, rnd, function (d) { return d === g.developer; });
      if (others.length < 3) return null;
      return q('developer', 'Who developed <b>' + esc(g.title) + '</b>?', [g.developer].concat(others), g.developer, g, rnd);
    },
    publisher: function (rnd, used) {
      var g = pickGame(rnd, used, function (x) { return !!x.publisher; });
      if (!g) return null;
      var others = sample(IX.publishers, 3, rnd, function (d) { return d === g.publisher; });
      if (others.length < 3) return null;
      return q('publisher', 'Who published <b>' + esc(g.title) + '</b>?', [g.publisher].concat(others), g.publisher, g, rnd);
    },
    year: function (rnd, used) {
      var g = pickGame(rnd, used, function (x) { return typeof x.year === 'number'; });
      if (!g) return null;
      var set = {}; set[g.year] = 1; var opts = [g.year];
      var guard = 0;
      while (opts.length < 4 && guard++ < 60) {
        var delta = (Math.floor(rnd() * 5) + 1) * (rnd() < 0.5 ? -1 : 1);
        var y = g.year + delta;
        if (y < IX.yearMin) y = IX.yearMin; if (y > IX.yearMax) y = IX.yearMax;
        if (!set[y]) { set[y] = 1; opts.push(y); }
      }
      if (opts.length < 4) return null;
      return q('year', 'What year did <b>' + esc(g.title) + '</b> release?',
        opts.map(String), String(g.year), g, rnd);
    },
    genre: function (rnd, used) {
      var g = pickGame(rnd, used, function (x) { return !!x.category; });
      if (!g) return null;
      var others = sample(IX.categories, 3, rnd, function (c) { return c === g.category; });
      if (others.length < 3) return null;
      return q('genre', 'Which genre best fits <b>' + esc(g.title) + '</b>?', [g.category].concat(others), g.category, g, rnd);
    },
    esrb: function (rnd, used) {
      var g = pickGame(rnd, used, function (x) { return !!x.esrb; });
      if (!g || ESRB_ALL.indexOf(g.esrb) < 0) return null;
      return q('esrb', 'What is the ESRB rating of <b>' + esc(g.title) + '</b>?', ESRB_ALL.slice(), g.esrb, g, rnd);
    },
    score: function (rnd, used) {
      var g = pickGame(rnd, used, function (x) { return typeof x.criticScore === 'number' && x.criticScore > 0; });
      if (!g) return null;
      var b = scoreBucket(g.criticScore);
      var others = sample(SCORE_BUCKETS, 3, rnd, function (x) { return x === b; });
      return q('score', 'Roughly what critic score did <b>' + esc(g.title) + '</b> get?', [b].concat(others), b, g, rnd);
    },
    tier: function (rnd, used) {
      var g = pickGame(rnd, used, function (x) {
        var t = x.tiers || {}; return t.essential || t.premium || t.ultimate;
      });
      if (!g) return null;
      var t = g.tiers || {};
      var entry = t.essential ? 'Essential' : t.premium ? 'Premium' : 'Ultimate';
      return q('tier', 'What is the lowest Game Pass tier that includes <b>' + esc(g.title) + '</b>?',
        ['Essential', 'Premium', 'Ultimate', 'EA Play'], entry, g, rnd);
    },
    series: function (rnd, used) {
      if (!IX.series.length) return null;
      var s = IX.series[Math.floor(rnd() * IX.series.length)];
      var member = s.members[Math.floor(rnd() * s.members.length)];
      var distract = distractorTitles(rnd, s.ids, member.title, 3);
      if (distract.length < 3) return null;
      return q('series', 'Which of these is a <b>' + esc(s.name) + '</b> game?',
        [member.title].concat(distract), member.title, member, rnd);
    },
    eaplay: function (rnd, used) {
      if (IX.eaplay.length < 1) return null;
      var g = IX.eaplay[Math.floor(rnd() * IX.eaplay.length)];
      var distract = distractorTitles(rnd, IX.eaplayIds, g.title, 3);
      if (distract.length < 3) return null;
      return q('eaplay', 'Which of these is included with <b>EA Play</b>?',
        [g.title].concat(distract), g.title, g, rnd);
    },
    character: function (rnd, used) {
      if (!IX.chars.length) return null;
      var c = IX.chars[Math.floor(rnd() * IX.chars.length)];
      var matches = IX.pool.filter(function (g) { return norm(g.title).toLowerCase().indexOf(c[1]) >= 0; });
      if (!matches.length) return null;
      var member = matches[Math.floor(rnd() * matches.length)];
      var matchIds = matches.reduce(function (o, m) { o[m.id] = 1; return o; }, {});
      var distract = distractorTitles(rnd, matchIds, member.title, 3);
      if (distract.length < 3) return null;
      return q('character', 'Which game features <b>' + esc(c[0]) + '</b>?',
        [member.title].concat(distract), member.title, member, rnd);
    }
  };

  // Distractor game titles: unique by title, excluding a correct title and any
  // ids in excludeIds. Prevents duplicate options when the catalog has two
  // games with the same title (editions) or the answer title recurs.
  function distractorTitles(rnd, excludeIds, correctTitle, n) {
    var seen = {}; if (correctTitle) seen[correctTitle.toLowerCase()] = 1;
    var out = [], shuffled = shuffle(IX.pool, rnd);
    for (var i = 0; i < shuffled.length && out.length < n; i++) {
      var g = shuffled[i];
      if (excludeIds && excludeIds[g.id]) continue;
      var key = norm(g.title).toLowerCase();
      if (!key || seen[key]) continue;
      seen[key] = 1; out.push(g.title);
    }
    return out;
  }

  function pickGame(rnd, used, ok) {
    var p = IX.pool, tries = 0;
    while (tries++ < 80) {
      var g = p[Math.floor(rnd() * p.length)];
      if ((!used || !used[g.id]) && (!ok || ok(g))) { if (used) used[g.id] = 1; return g; }
    }
    // fall back: first matching unused
    for (var i = 0; i < p.length; i++) {
      var g2 = p[i];
      if ((!used || !used[g2.id]) && (!ok || ok(g2))) { if (used) used[g2.id] = 1; return g2; }
    }
    return null;
  }

  function makeQuestion(types, rnd, used) {
    var order = shuffle(types, rnd);
    for (var i = 0; i < order.length; i++) {
      var gen = GEN[order[i]];
      if (!gen) continue;
      var res = gen(rnd, used);
      if (res && res.correct >= 0) return res;
    }
    // last resort: try every generator
    var all = Object.keys(GEN);
    for (var j = 0; j < all.length; j++) {
      var r = GEN[all[j]](rnd, used);
      if (r && r.correct >= 0) return r;
    }
    return null;
  }

  // ---- rng ----------------------------------------------------------------
  function dailyRnd() {
    var s = MODE + '|' + GTP.todayKey(), h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return GTP.mulberry32(h >>> 0);
  }
  function randomRnd() { return GTP.mulberry32(GTP.randSeed()); }

  // ---- game flow ----------------------------------------------------------
  var els = {}, S, DIFFKEY, MODEKEY;

  function init() {
    S = GTPEngine.getSettings();
    GTPEngine.applyTheme(S);
    els.setup = document.getElementById('setup');
    els.hud = document.getElementById('hud');
    els.board = document.getElementById('board');
    els.result = document.getElementById('result');

    // Respect the OG toggle: in OG mode trivia must only ever reference original
    // XBOX games, so it draws from the OG library and never falls back to the
    // Game Pass catalog.
    var pool = GTP.pool(S).filter(function (g) { return g && g.title; });
    if (pool.length < 8 && !S.og) pool = GTP.filter('current', null).filter(function (g) { return g && g.title; });
    if (pool.length < 8) {
      els.board.innerHTML = '<div class="panel center">Not enough games loaded to build trivia yet.</div>';
      return;
    }
    buildIndex(pool);

    // Daily Gauntlet: skip the setup UI and ask exactly one question, then report.
    if (window.GTPGauntlet && GTPGauntlet.active()) {
      if (els.setup) els.setup.style.display = 'none';
      DIFFKEY = DIFF[S.difficulty] ? S.difficulty : 'medium';
      startGauntlet();
      return;
    }

    MODEKEY = S.daily ? 'daily' : 'endless';
    DIFFKEY = DIFF[S.difficulty] ? S.difficulty : 'medium';
    renderSetup();
    start();
  }

  function renderSetup() {
    var diffChips = Object.keys(DIFF).map(function (k) {
      return '<button class="chip diffchip' + (k === DIFFKEY ? ' on' : '') + '" data-diff="' + k + '">' +
        esc(GTPEngine.diffLabel(k, S)) + ' <span class="lifepip">\u2665' + DIFF[k].lives + '</span></button>';
    }).join('');
    els.setup.innerHTML =
      '<div class="tvseg" role="tablist">' +
      '<button class="tvseg-btn' + (MODEKEY === 'daily' ? ' on' : '') + '" data-mode="daily">\uD83D\uDCC5 Daily</button>' +
      '<button class="tvseg-btn' + (MODEKEY === 'endless' ? ' on' : '') + '" data-mode="endless">\u267E\uFE0F Endless</button>' +
      '</div>' +
      '<div class="diffrow' + (MODEKEY === 'daily' ? ' dimmed' : '') + '">' + diffChips + '</div>' +
      '<div class="small center diffnote">' + (MODEKEY === 'daily'
        ? '7 questions \u2022 same for everyone today'
        : GTPEngine.diffLabel(DIFFKEY, S) + ' \u2022 ' + DIFF[DIFFKEY].lives + ' lives \u2022 endless') + '</div>';

    Array.prototype.forEach.call(els.setup.querySelectorAll('.tvseg-btn'), function (b) {
      b.onclick = function () { MODEKEY = b.getAttribute('data-mode'); renderSetup(); start(); };
    });
    Array.prototype.forEach.call(els.setup.querySelectorAll('.diffchip'), function (b) {
      b.onclick = function () {
        if (MODEKEY === 'daily') { GTPEngine.toast('Difficulty applies to Endless'); return; }
        DIFFKEY = b.getAttribute('data-diff'); renderSetup(); start();
      };
    });
  }

  var run = null;
  function start() {
    els.result.classList.add('hidden'); els.result.innerHTML = '';
    if (MODEKEY === 'daily') startDaily(); else startEndless();
  }

  // ---------- DAILY ----------
  function startDaily() {
    var rnd = dailyRnd(), used = {}, questions = [];
    for (var i = 0; i < DAILY_COUNT; i++) {
      var qq = makeQuestion(DAILY_TYPES, rnd, used);
      if (qq) questions.push(qq);
    }
    var dayKey = GTP.todayKey();
    var saved = GTP.daily && GTP.daily.load ? GTP.daily.load(MODE, dayKey) : null;
    run = { kind: 'daily', questions: questions, idx: 0, marks: [], dayKey: dayKey };
    if (saved && saved.done && Array.isArray(saved.marks) && saved.marks.length === questions.length) {
      run.marks = saved.marks; finishDaily(true); return;
    }
    renderQuestion();
  }

  function finishDaily(restored) {
    var correct = run.marks.filter(Boolean).length, total = run.questions.length;
    if (!restored && GTP.daily && GTP.daily.save) {
      GTP.daily.save(MODE, run.dayKey, { done: true, marks: run.marks });
      GTP.stats && GTP.stats.record && GTP.stats.record(MODE, correct === total, correct);
    }
    var grid = run.marks.map(function (m) { return m ? '\uD83D\uDFE9' : '\uD83D\uDFE5'; }).join('');
    els.hud.innerHTML = '';
    var win = correct === total;
    els.result.innerHTML =
      '<div class="result"><h2>' + (win ? '\uD83C\uDFC6 Perfect!' : '\uD83E\uDDE0 Daily done') + '</h2>' +
      '<div class="ans">' + correct + ' / ' + total + ' correct</div>' +
      '<div class="tvgrid">' + grid + '</div>' +
      '<div class="btnrow" style="margin-top:14px">' +
      '<button class="btn" id="shareBtn">\uD83D\uDCE4 Share</button>' +
      '<button class="btn" id="endlessBtn">\u267E\uFE0F Play Endless</button>' +
      '<a class="btn primary" href="index.html">\uD83C\uDFE0 More modes</a></div></div>';
    els.result.classList.remove('hidden');
    if (win && window.GTP && GTP.confetti) GTP.confetti();
    document.getElementById('endlessBtn').onclick = function () { MODEKEY = 'endless'; renderSetup(); start(); };
    document.getElementById('shareBtn').onclick = function () {
      var who = (window.GTPProfile && GTPProfile.name()) ? '  (' + GTPProfile.name() + ')' : '';
      var txt = 'Passle Trivia \u2014 Daily #' + GTP.dayNumber() + who + '\n' + grid + '  ' + correct + '/' + total +
        '\n' + location.href.split('?')[0];
      if (navigator.share) navigator.share({ text: txt }).catch(function () { copy(txt); }); else copy(txt);
    };
  }

  // ---------- ENDLESS ----------
  function startEndless() {
    run = { kind: 'endless', score: 0, lives: DIFF[DIFFKEY].lives, rnd: randomRnd(), used: {}, done: false };
    nextEndless();
  }
  // ---------- GAUNTLET (single question) ----------
  function startGauntlet() {
    run = { kind: 'gauntlet', rnd: randomRnd(), used: {}, done: false };
    var qq = makeQuestion(DIFF[DIFFKEY].types, run.rnd, run.used) || makeQuestion(DAILY_TYPES, run.rnd, run.used);
    if (!qq) { if (window.GTPGauntlet) GTPGauntlet.onResult({ mode: 'trivia', solved: false, score: 0 }); return; }
    run.current = qq;
    renderQuestion();
  }
  function nextEndless() {
    var qq = makeQuestion(DIFF[DIFFKEY].types, run.rnd, run.used);
    if (!qq) { endEndless(); return; }
    if (Object.keys(run.used).length > IX.pool.length - 6) run.used = {}; // recycle when nearly exhausted
    run.current = qq;
    renderQuestion();
  }
  function endEndless() {
    run.done = true;
    GTP.stats && GTP.stats.record && GTP.stats.record(MODE, run.score > 0, run.score);
    GTP.streak && GTP.streak.recordBest && GTP.streak.recordBest(MODE, run.score);
    var best = GTP.streak && GTP.streak.best ? GTP.streak.best(MODE) : run.score;
    els.hud.innerHTML = '';
    els.result.innerHTML =
      '<div class="result"><h2>\uD83D\uDCA5 Out of lives</h2>' +
      '<div class="ans">You answered ' + run.score + ' correct</div>' +
      '<div class="meta">Best: ' + best + ' \u2022 ' + esc(GTPEngine.diffLabel(DIFFKEY, S)) + '</div>' +
      '<div class="btnrow" style="margin-top:14px">' +
      '<button class="btn" id="shareBtn">\uD83D\uDCE4 Share</button>' +
      '<button class="btn primary" id="againBtn">\uD83D\uDD04 Again</button>' +
      '<a class="btn" href="index.html">\uD83C\uDFE0 More modes</a></div></div>';
    els.result.classList.remove('hidden');
    document.getElementById('againBtn').onclick = function () { start(); };
    document.getElementById('shareBtn').onclick = function () {
      var who = (window.GTPProfile && GTPProfile.name()) ? '  (' + GTPProfile.name() + ')' : '';
      var txt = 'Passle Trivia \u2014 Endless (' + GTPEngine.diffLabel(DIFFKEY, S) + ')' + who +
        '\n\uD83C\uDFAF Score: ' + run.score + '\n' + location.href.split('?')[0];
      if (navigator.share) navigator.share({ text: txt }).catch(function () { copy(txt); }); else copy(txt);
    };
  }

  // ---------- shared question rendering ----------
  function currentQ() { return run.kind === 'daily' ? run.questions[run.idx] : run.current; }

  function renderHud() {
    if (run.kind === 'gauntlet') {
      els.hud.innerHTML = '<span class="tvq">\uD83C\uDFAF Gauntlet \u2014 one question</span>';
      return;
    }
    if (run.kind === 'daily') {
      els.hud.innerHTML = '<span class="tvq">Question <b>' + (run.idx + 1) + '</b> / ' + run.questions.length + '</span>' +
        '<span class="tvscore">Score <b>' + run.marks.filter(Boolean).length + '</b></span>';
    } else {
      var hearts = '';
      for (var i = 0; i < DIFF[DIFFKEY].lives; i++) hearts += (i < run.lives ? '\u2665' : '\u2661');
      els.hud.innerHTML = '<span class="tvscore">Score <b>' + run.score + '</b></span>' +
        '<span class="tvlives" title="Lives">' + hearts + '</span>';
    }
  }

  function renderQuestion() {
    var qq = currentQ();
    if (!qq) { (run.kind === 'daily' ? finishDaily : endEndless)(); return; }
    renderHud();
    var btns = qq.choices.map(function (c, i) {
      return '<button class="btn tvchoice" data-i="' + i + '">' +
        '<span class="tvkey">' + (i + 1) + '</span>' + esc(c) + '</button>';
    }).join('');
    els.board.innerHTML =
      '<div class="tvcard">' +
      '<div class="tvtype">' + typeLabel(qq.type) + '</div>' +
      '<div class="tvprompt">' + qq.prompt + '</div>' +
      '<div class="tvchoices">' + btns + '</div>' +
      '</div>';
    var choiceEls = els.board.querySelectorAll('.tvchoice');
    Array.prototype.forEach.call(choiceEls, function (b) {
      b.onclick = function () { answer(parseInt(b.getAttribute('data-i'), 10)); };
    });
    if (choiceEls[0]) { try { choiceEls[0].focus(); } catch (e) {} }
  }

  var answered = false;
  function answer(i) {
    if (answered) return;
    answered = true;
    var qq = currentQ();
    var correct = i === qq.correct;
    var choiceEls = els.board.querySelectorAll('.tvchoice');
    Array.prototype.forEach.call(choiceEls, function (b) {
      b.disabled = true;
      var bi = parseInt(b.getAttribute('data-i'), 10);
      if (bi === qq.correct) b.classList.add('right');
      else if (bi === i) b.classList.add('wrong');
    });
    try { if (window.GTPSfx) (correct ? GTPSfx.pop : GTPSfx.click)(); } catch (e) {}

    if (run.kind === 'daily') {
      run.marks.push(correct);
    } else if (run.kind === 'gauntlet') {
      // no streak/lives bookkeeping — reported below
    } else {
      if (correct) { run.score++; GTP.streak && GTP.streak.win && GTP.streak.win(MODE); }
      else { run.lives--; GTP.streak && GTP.streak.reset && GTP.streak.reset(MODE); }
    }
    renderHud();

    setTimeout(function () {
      answered = false;
      if (run.kind === 'daily') {
        run.idx++;
        if (run.idx >= run.questions.length) finishDaily();
        else renderQuestion();
      } else if (run.kind === 'gauntlet') {
        run.done = true;
        GTP.stats && GTP.stats.record && GTP.stats.record(MODE, correct, correct ? 1 : 0);
        els.hud.innerHTML = '';
        els.result.innerHTML = '<div class="result"><h2>' + (correct ? '\u2705 Correct' : '\u274C Missed') + '</h2>' +
          '<div class="btnrow" style="margin-top:14px"></div></div>';
        els.result.classList.remove('hidden');
        if (window.GTPGauntlet) GTPGauntlet.onResult({ mode: 'trivia', solved: correct, score: correct ? 100 : 0 });
      } else {
        if (run.lives <= 0) endEndless();
        else nextEndless();
      }
    }, correct ? 750 : 1150);
  }

  function typeLabel(t) {
    return ({
      developer: 'Developer', publisher: 'Publisher', year: 'Release year', genre: 'Genre',
      esrb: 'ESRB rating', score: 'Critic score', tier: 'Game Pass tier',
      series: 'Series', eaplay: 'EA Play', character: 'Character'
    })[t] || 'Trivia';
  }

  function copy(t) {
    try { navigator.clipboard.writeText(t).then(function () { GTPEngine.toast('Copied!'); }, function () { GTPEngine.toast(t); }); }
    catch (e) { GTPEngine.toast(t); }
  }

  // number-key answering (1-4)
  document.addEventListener('keydown', function (e) {
    if (!run || answered) return;
    if (e.key >= '1' && e.key <= '4') {
      var b = els.board.querySelector('.tvchoice[data-i="' + (parseInt(e.key, 10) - 1) + '"]');
      if (b && !b.disabled) b.click();
    }
  });

  window.GTPTrivia = { init: init, _buildIndex: buildIndex, _makeQuestion: makeQuestion, _GEN: GEN };
})();
