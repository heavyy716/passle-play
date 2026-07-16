/* Passle — shared game engine (guess-based modes) */
(function () {
  const ALL_PLANS = ['ultimate', 'premium', 'essential', 'pc'];
  const DEFAULT_SETTINGS = { scope: 'current', plans: ALL_PLANS.slice(), daily: true, og: false, theme: 'default', light: false, difficulty: 'medium', sports: false, sv: 2 };

  // Difficulty scales how many guesses and hints a player gets. The four tiers
  // are fixed; only their names/emblems change with the active theme.
  const DIFF_ORDER = ['easy', 'medium', 'hard', 'legendary'];
  const DIFFICULTY = {
    easy:      { key: 'easy',      guesses: 5, hints: 2 },
    medium:    { key: 'medium',    guesses: 5, hints: 1 },
    hard:      { key: 'hard',      guesses: 3, hints: 1 },
    legendary: { key: 'legendary', guesses: 1, hints: 0 },
  };
  // Per-theme difficulty names: Halo 3 for the default + OG Xbox game, Gears of
  // War for the Gears theme.
  const DIFF_NAMES = {
    halo:  { easy: 'Easy',   medium: 'Normal', hard: 'Heroic',   legendary: 'Legendary' },
    gears: { easy: 'Casual', medium: 'Normal', hard: 'Hardcore', legendary: 'Insane' },
  };
  // Difficulty-ladder colours (calm -> deadly) used to tint the emblem.
  const DIFF_COLORS = { easy: '#5ad15a', medium: '#37a0ff', hard: '#f5a623', legendary: '#e5484d' };
  // Halo skull emblem.
  const _SKULL =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path fill="currentColor" d="M12 3c-4.4 0-8 3.2-8 7.3 0 2.4 1.2 4.2 2.9 5.4.3.2.5.6.5 1v1.1c0 .7.6 1.3 1.3 1.3h.2l.4 1.1c.1.3.4.5.7.5h.4v-1.6h1.3v1.6h1.6v-1.6h1.3v1.6h.4c.3 0 .6-.2.7-.5l.4-1.1h.2c.7 0 1.3-.6 1.3-1.3v-1.1c0-.4.2-.8.5-1C18.8 14.5 20 12.7 20 10.3 20 6.2 16.4 3 12 3z"/>' +
    '<circle cx="9" cy="10.4" r="1.9" fill="#0b0b0b" opacity=".62"/>' +
    '<circle cx="15" cy="10.4" r="1.9" fill="#0b0b0b" opacity=".62"/>' +
    '<path fill="#0b0b0b" opacity=".5" d="M11.2 13.2h1.6l-.45 1.3h-.7z"/>' +
    '</svg>';
  // Gears "Crimson Omen" (skull inside a broken cog).
  const _OMEN =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path fill="currentColor" d="M12 1.6l1.6 1.2 1.9-.5.9 1.8 1.9.6.1 2 1.5 1.3-.5 1.9.9 1.7-1.3 1.5.1 2-1.9.6-.9 1.8-1.9-.5L12 22.4l-1.6-1.2-1.9.5-.9-1.8-1.9-.6-.1-2-1.5-1.3.5-1.9-.9-1.7 1.3-1.5-.1-2 1.9-.6.9-1.8 1.9.5z"/>' +
    '<circle cx="12" cy="12" r="6.2" fill="#0b0b0b" opacity=".9"/>' +
    '<path fill="currentColor" d="M12 6.6c-2.6 0-4.6 1.8-4.6 4.2 0 1.3.66 2.4 1.6 3 .2.1.3.4.3.6v.4c0 .4.3.75.75.75l.2.55c.1.2.2.3.4.3h.25v-1h.75v1h1v-1h.75v1h.25c.2 0 .3-.1.4-.3l.2-.55c.45 0 .75-.35.75-.75v-.4c0-.2.1-.5.3-.6.94-.6 1.6-1.7 1.6-3 0-2.4-2-4.2-4.6-4.2z"/>' +
    '<circle cx="10.4" cy="11" r="1" fill="#0b0b0b"/>' +
    '<circle cx="13.6" cy="11" r="1" fill="#0b0b0b"/>' +
    '</svg>';

  function difficulty(s) {
    const S = s || getSettings();
    return DIFFICULTY[S.difficulty] || DIFFICULTY.medium;
  }
  // Which visual theme is active: 'og' (OG Xbox) wins, else 'gears' or 'default'.
  function themeName(s) {
    const S = s || getSettings();
    if (S.og) return 'og';
    return S.theme === 'gears' ? 'gears' : 'default';
  }
  // Which difficulty naming set to use (Gears theme uses Gears names; everything
  // else — default + OG Xbox — uses Halo 3 names).
  function diffNaming(s) { return themeName(s) === 'gears' ? 'gears' : 'halo'; }
  function diffLabel(key, s) { return (DIFF_NAMES[diffNaming(s)] || DIFF_NAMES.halo)[key] || key; }
  function diffIcon(key, s) {
    const glyph = diffNaming(s) === 'gears' ? _OMEN : _SKULL;
    return '<span class="dico d-' + key + '" style="color:' + (DIFF_COLORS[key] || '#fff') + '">' + glyph + '</span>';
  }
  // Apply the active theme class to <body>. OG takes precedence over Gears.
  function applyTheme(s) {
    const S = s || getSettings();
    if (!document.body) return;
    document.body.classList.toggle('og-theme', !!S.og);
    document.body.classList.toggle('gears-theme', !S.og && S.theme === 'gears');
    // Light mode only applies to the regular pass — never over OG or Gears.
    document.body.classList.toggle('light-theme', !S.og && S.theme !== 'gears' && !!S.light);
  }

  function getSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem('gtp_settings')) || {};
      const s = Object.assign({}, DEFAULT_SETTINGS, saved);
      // Migrate pre-v2 settings, where an empty plans array meant "all games".
      // Now an empty array means "no subscription selected" (zero games), so a
      // legacy empty selection is upgraded to all plans to preserve behaviour.
      if (saved.sv !== 2) {
        if (!Array.isArray(saved.plans) || saved.plans.length === 0) s.plans = ALL_PLANS.slice();
        s.sv = 2;
        try { localStorage.setItem('gtp_settings', JSON.stringify(s)); } catch (e) {}
      }
      return s;
    } catch (e) { return Object.assign({}, DEFAULT_SETTINGS); }
  }
  function saveSettings(s) { localStorage.setItem('gtp_settings', JSON.stringify(s)); }

  // Shown when the active pool is empty (e.g. no subscription selected).
  function renderNoGames(el, S) {
    const noSel = GTP.noSelection(S);
    const msg = '<div class="panel center" style="padding:34px 20px">' +
      '<div style="font-size:42px;margin-bottom:8px">\uD83C\uDFAE</div>' +
      '<h2 style="margin:0 0 6px">' + (noSel ? 'No subscriptions selected' : 'No games to guess') + '</h2>' +
      '<p class="small" style="margin:0 0 16px">' +
      (noSel ? 'Pick at least one Game Pass plan to start playing.'
             : 'Nothing in the current selection has data for this mode.') +
      '</p><a class="btn primary" href="index.html">\u2699\uFE0F Open settings</a></div>';
    const msgEl = el.stage || el.clues;
    if (msgEl) msgEl.innerHTML = msg;
    // Hide the guessing UI (but not the element showing the message).
    [el.clues, el.input, el.ac, el.submit, el.skip, el.pips, el.guesses].forEach(x => {
      if (x && x !== msgEl) x.style.display = 'none';
    });
    const inputRow = el.input && el.input.closest ? el.input.closest('.guessrow, .inputrow, form') : null;
    if (inputRow) inputRow.style.display = 'none';
  }

  /* Generic guess controller.
     opts = {
       mode, maxGuesses, poolFilter(game)->bool,
       reveal(step, answer, stageEl, cluesEl, done),  // render clue state; step = 0..maxGuesses
       resultExtra(answer)->htmlString                 // optional extra result markup
     } */
  function createGame(opts) {
    const S = getSettings();
    try { applyTheme(S); } catch (e) {}
    const el = {
      stage: document.getElementById('stage'),
      clues: document.getElementById('clues'),
      input: document.getElementById('guessInput'),
      ac: document.getElementById('ac'),
      submit: document.getElementById('submitBtn'),
      skip: document.getElementById('skipBtn'),
      guesses: document.getElementById('guesses'),
      pips: document.getElementById('pips'),
      result: document.getElementById('result'),
      play: document.getElementById('play'),
    };
    const diff = difficulty(S);
    GTP.hints.init(opts.mode, diff.hints);
    // Difficulty sets how many guesses a player gets (easy/medium 5, hard 3,
    // legendary 1). Reveal steps degrade gracefully via Math.min in each mode.
    const maxGuesses = diff.guesses;

    let pool = GTP.pool(S).filter(opts.poolFilter);
    if (!pool.length && !GTP.noSelection(S)) { // fall back if plan filter is too strict for this mode
      pool = GTP.filter('current', null).filter(opts.poolFilter);
    }
    if (!pool.length) { // no subscription selected (or nothing matches) — prompt instead of starting
      renderNoGames(el, S);
      return;
    }
    const guessable = GTP.titleIndex(GTP.pool(S));
    const dayKey = GTP.todayKey();

    // choose answer
    let answer;
    if (S.daily) {
      answer = pool[GTP.dailyIndex(opts.mode, pool.length, dayKey)];
    } else {
      answer = GTP.rng.pick(opts.mode, pool);
    }

    let state = { guesses: [], done: false, won: false, step: 0 };

    // ---- hint UI (1 per session, refreshes every 10 in a row) ----
    const btnrow = el.submit ? el.submit.parentNode : null;
    let hintBox = document.getElementById('hint');
    if (!hintBox) {
      hintBox = document.createElement('div');
      hintBox.id = 'hint';
      hintBox.className = 'hintbox hidden';
      if (el.clues && el.clues.parentNode) el.clues.parentNode.insertBefore(hintBox, el.clues.nextSibling);
      else if (el.play && el.play.parentNode) el.play.parentNode.insertBefore(hintBox, el.play);
      else document.body.appendChild(hintBox);
    }
    let hintBtn = null;
    if (btnrow) {
      hintBtn = document.createElement('button');
      hintBtn.className = 'btn hintbtn';
      hintBtn.id = 'hintBtn';
      hintBtn.type = 'button';
      btnrow.insertBefore(hintBtn, btnrow.firstChild);
      hintBtn.onclick = useHint;
    }
    // Fill-in-the-blank title: keep the first character of each word / number run
    // and mask the rest, preserving spaces + punctuation. Far more useful than a
    // lone "starts with X" (useless for the many titles that begin with "The").
    // "The Walking Dead: The Final Season" -> "T__ W______ D___: T__ F____ S_____"
    function titleBlank(t) {
      return String(t || '').replace(/[A-Za-z0-9]+/g, function (w) {
        return w.length <= 1 ? w : w[0] + w.slice(1).replace(/[A-Za-z0-9]/g, '_');
      });
    }
    // Progressive hints: each press reveals a NEW, more-revealing clue instead of
    // repeating the same line. The number of stages tracks the difficulty's hint
    // budget (easy = 2, medium/hard = 1). The strongest clue (developer + a
    // fill-in-the-blank of the title, or a mode's own initials hint) is saved for
    // last, so easy mode's second hint is genuinely more helpful than the first.
    let hintStagesCache = null, hintShown = 0;
    function buildHintStages(g, budget) {
      const year = g.year ? ('Released ' + g.year) : '';
      const cat = g.category ? String(g.category) : '';
      const by = g.developer || g.publisher || '';
      const byTxt = by ? ('Made by ' + by) : '';
      const strongClue = opts.hint ? opts.hint(g) : ('Title: ' + titleBlank(g.title));
      const SEP = '  \u2022  ';
      let stages;
      if (budget >= 2) {
        const s1 = [year, cat].filter(Boolean).join(SEP);
        const s2 = [byTxt, strongClue].filter(Boolean).join(SEP);
        stages = [s1, s2].filter(Boolean);
        if (stages.length < 2) stages = [year, cat, byTxt, strongClue].filter(Boolean).slice(0, 2);
      } else {
        stages = [[year, cat, byTxt].filter(Boolean).join(SEP) || strongClue];
      }
      return stages.length ? stages : [strongClue || 'No hint available'];
    }
    function useHint() {
      if (state.done) return;
      if (!GTP.hints.available(opts.mode)) {
        toast('\uD83D\uDD12 Hint locked \u2014 win ' + GTP.hints.needed(opts.mode) + ' more in a row');
        updateHintBtn();
        return;
      }
      if (!hintStagesCache) hintStagesCache = buildHintStages(answer, diff.hints);
      if (hintShown >= hintStagesCache.length) { toast('\uD83D\uDCA1 That\u2019s every hint for this one'); return; }
      hintShown++;
      hintBox.innerHTML = '<span class="lbl">\uD83D\uDCA1 Hint</span>' +
        hintStagesCache.slice(0, hintShown).map(function (s) { return escapeHtml(s); }).join('<br>');
      hintBox.classList.remove('hidden');
      GTP.hints.use(opts.mode);
      updateHintBtn();
    }
    function updateHintBtn() {
      if (!hintBtn) return;
      if (state.done || diff.hints === 0) { hintBtn.style.display = 'none'; return; }
      hintBtn.style.display = '';
      const avail = GTP.hints.available(opts.mode);
      const left = GTP.hints.left ? GTP.hints.left(opts.mode) : (avail ? 1 : 0);
      hintBtn.disabled = !avail;
      hintBtn.classList.toggle('locked', !avail);
      hintBtn.innerHTML = avail ? ('\uD83D\uDCA1 Hint' + (left > 1 ? ' (' + left + ')' : '')) : ('\uD83D\uDD12 ' + GTP.hints.needed(opts.mode));
      hintBtn.title = avail
        ? ('Reveal a hint (' + left + ' left this run, refreshes every 10 correct in a row)')
        : ('Hint refreshes after ' + GTP.hints.needed(opts.mode) + ' more correct in a row');
    }

    // restore daily progress
    if (S.daily) {
      const saved = GTP.daily.load(opts.mode, dayKey);
      if (saved && saved.answerId === answer.id) {
        state.guesses = saved.guesses || [];
        state.step = state.guesses.length;
        state.done = saved.done;
        state.won = saved.won;
      }
    }

    function persist() {
      if (!S.daily) return;
      GTP.daily.save(opts.mode, dayKey, {
        answerId: answer.id, guesses: state.guesses, done: state.done, won: state.won,
      });
    }

    function reveal() {
      opts.reveal(state.step, answer, el.stage, el.clues, state.done);
    }

    function renderPips() {
      if (!el.pips) return;
      let h = '';
      for (let i = 0; i < maxGuesses; i++) {
        let cls = 'pip';
        if (i < state.guesses.length) {
          const gg = state.guesses[i];
          if (gg.right) cls += ' win';
          else if (gg.close) cls += ' close';
          else cls += ' used';
        }
        if (state.done && !state.won && i === maxGuesses - 1) { /* keep */ }
        h += '<div class="' + cls + '"></div>';
      }
      el.pips.innerHTML = h;
    }

    function renderGuesses() {
      if (!el.guesses) return;
      el.guesses.innerHTML = state.guesses.map(g => {
        const cls = g.right ? 'right' : (g.skip ? 'skip' : (g.close ? 'close' : 'wrong'));
        const ic = g.right ? '\u2705' : (g.skip ? '\u23ED\uFE0F' : (g.close ? '\uD83D\uDFE1' : '\u274C'));
        const nm = g.skip ? 'Skipped' : escapeHtml(g.title);
        const hint = g.close ? '<span class="serieshint">same series</span>' : '';
        return '<div class="grow ' + cls + '"><span class="ic">' + ic + '</span><span class="nm">' + nm + hint + '</span></div>';
      }).join('');
    }

    function end(won) {
      state.done = true; state.won = won;
      reveal();
      el.input.disabled = true; el.submit.disabled = true; if (el.skip) el.skip.disabled = true;
      el.ac.classList.remove('show');
      updateHintBtn();
      const stats = GTP.stats.record(opts.mode, won, won ? state.guesses.length : 0);
      if (!S.daily) { if (won) GTP.streak.win(opts.mode); else GTP.streak.reset(opts.mode); }
      persist();
      showResult(won, stats);
      if (won && window.GTP && GTP.confetti) GTP.confetti();
      // Daily Gauntlet: report this round so the runner can score + advance.
      if (window.GTPGauntlet && GTPGauntlet.active()) {
        const used = state.guesses.length;
        const sc = won ? Math.max(30, 100 - (used - 1) * 14) : 0;
        GTPGauntlet.onResult({ mode: opts.mode, solved: won, score: sc });
      }
    }

    function showResult(won, stats) {
      const g = answer;
      const tierList = [
        ['essential', 'Essential'], ['premium', 'Premium'], ['ultimate', 'Ultimate'],
        ['pc', 'PC'],
      ];
      const badges = g.og
        ? '<span class="tierbadge in og">\uD83D\uDFE2 Original XBOX Classic</span>'
        : tierList.map(([k, lbl]) =>
          '<span class="tierbadge ' + (g.tiers[k] ? 'in' : 'out') + '">' + lbl + '</span>').join('');
      const extra = opts.resultExtra ? opts.resultExtra(g) : '';
      el.result.innerHTML =
        '<div class="result">' +
        '<h2>' + (won ? '\uD83C\uDF89 Solved!' : '\uD83D\uDE22 Out of guesses') + '</h2>' +
        '<div class="ans">' + escapeHtml(g.title) + '</div>' +
        '<div class="meta">' + [escapeHtml(g.developer), g.year || ''].filter(Boolean).join(' \u2022 ') + '</div>' +
        '<div class="tierbadges">' + badges + '</div>' + extra +
        '<div class="btnrow">' +
        '<button class="btn" id="shareBtn">\uD83D\uDCE4 Share</button>' +
        (S.daily ? '' : '<button class="btn primary" id="nextBtn">\u25B6 Next</button>') +
        '<a class="btn' + (S.daily ? ' primary' : '') + '" href="index.html">\uD83C\uDFE0 More modes</a>' +
        '</div>' +
        '<div class="small" style="margin-top:10px">Streak: ' + GTP.streak.current(opts.mode) +
        ' \u2022 Best: ' + GTP.streak.best(opts.mode) +
        ' \u2022 Played: ' + (stats.played || 0) + ' \u2022 Win rate: ' +
        (stats.played ? Math.round(100 * stats.wins / stats.played) : 0) + '%</div>' +
        '</div>';
      el.result.classList.remove('hidden');
      if (window.GTP && GTP.reveal) GTP.reveal.attach(el.result, g);
      // Surface the answer + box art + description at the top (next to the game
      // square) instead of below the guess list, so players don't have to scroll.
      if (el.stage && el.stage.parentNode) el.stage.insertAdjacentElement('afterend', el.result);
      el.play.classList.add('hidden');
      document.getElementById('shareBtn').onclick = () => share(won);
      const nb = document.getElementById('nextBtn');
      if (nb) nb.onclick = nextRound;
    }

    // Start a fresh round in place (endless mode "Next"), without a page reload.
    function nextRound() {
      answer = S.daily
        ? pool[GTP.dailyIndex(opts.mode, pool.length, dayKey)]
        : GTP.rng.pick(opts.mode, pool);
      state = { guesses: [], done: false, won: false, step: 0 };
      el.input.disabled = false; el.submit.disabled = false; if (el.skip) el.skip.disabled = false;
      el.input.value = '';
      el.ac.classList.remove('show');
      el.result.classList.add('hidden'); el.result.innerHTML = '';
      el.play.classList.remove('hidden');
      hintBox.classList.add('hidden'); hintBox.innerHTML = '';
      hintStagesCache = null; hintShown = 0;
      updateHintBtn();
      renderPips(); renderGuesses(); reveal();
      try { el.input.focus(); } catch (e) { /* jsdom */ }
    }

    function share(won) {
      const emoji = state.guesses.map(g => g.right ? '\uD83D\uDFE9' : (g.skip ? '\u2B1C' : (g.close ? '\uD83D\uDFE8' : '\uD83D\uDFE5'))).join('');
      const scoreN = won ? state.guesses.length : 'X';
      const who = (window.GTPProfile && GTPProfile.name()) ? '  (' + GTPProfile.name() + ')' : '';
      const txt = 'Passle \u2014 ' + opts.title + ' #' + GTP.dayNumber() + who + '\n' +
        emoji + ' ' + scoreN + '/' + maxGuesses + '\n' + location.href.split('?')[0];
      if (navigator.share) { navigator.share({ text: txt }).catch(() => copy(txt)); }
      else copy(txt);
    }
    function copy(t) {
      navigator.clipboard.writeText(t).then(() => toast('Copied results!')).catch(() => toast(t));
    }

    function submitGuess(game) {
      if (state.done) return;
      const right = game && GTP.norm(game.title) === GTP.norm(answer.title);
      const close = !right && game && GTP.sameSeries(game, answer);
      state.guesses.push({ title: game ? game.title : '', right: right, close: close, skip: false });
      state.step = state.guesses.length;
      el.input.value = '';
      el.ac.classList.remove('show');
      renderGuesses(); renderPips();
      if (right) { end(true); return; }
      reveal();
      if (state.guesses.length >= maxGuesses) end(false);
      persist();
    }
    function skipGuess() {
      if (state.done) return;
      state.guesses.push({ title: '', right: false, skip: true });
      state.step = state.guesses.length;
      renderGuesses(); renderPips();
      reveal();
      if (state.guesses.length >= maxGuesses) end(false);
      persist();
    }

    // ---- autocomplete ----
    let acItems = [], acActive = -1;
    function updateAC() {
      const q = GTP.norm(el.input.value);
      if (!q) { el.ac.classList.remove('show'); return; }
      acItems = guessable.filter(g => GTP.norm(g.title).includes(q)).slice(0, 8);
      if (!acItems.length) { el.ac.classList.remove('show'); return; }
      acActive = -1;
      el.ac.innerHTML = acItems.map((g, i) => '<div data-i="' + i + '">' + escapeHtml(g.title) + '</div>').join('');
      el.ac.classList.add('show');
      Array.from(el.ac.children).forEach(c => c.onclick = () => submitGuess(acItems[+c.dataset.i]));
    }
    el.input.addEventListener('input', updateAC);
    el.input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { acActive = Math.min(acActive + 1, acItems.length - 1); hlAC(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { acActive = Math.max(acActive - 1, 0); hlAC(); e.preventDefault(); }
      else if (e.key === 'Enter') {
        if (acActive >= 0 && acItems[acActive]) submitGuess(acItems[acActive]);
        else if (acItems.length === 1) submitGuess(acItems[0]);
      } else if (e.key === 'Escape') el.ac.classList.remove('show');
    });
    function hlAC() {
      Array.from(el.ac.children).forEach((c, i) => c.classList.toggle('active', i === acActive));
    }
    document.addEventListener('click', e => {
      if (!el.ac.contains(e.target) && e.target !== el.input) el.ac.classList.remove('show');
    });

    el.submit.onclick = () => { if (acItems.length) submitGuess(acItems[acActive >= 0 ? acActive : 0]); };
    if (el.skip) el.skip.onclick = skipGuess;

    // ---- init ----
    renderPips(); renderGuesses(); reveal(); updateHintBtn();
    if (state.done) end(state.won); // restored finished game

    return state;
  }

  function escapeHtml(s) {
    return (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function toast(msg) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t);
      t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#107C10;color:#fff;padding:12px 18px;border-radius:10px;z-index:200;font-size:14px;box-shadow:0 6px 24px rgba(0,0,0,.5)'; }
    t.textContent = msg; t.style.opacity = '1';
    clearTimeout(t._t); t._t = setTimeout(() => { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; }, 2200);
  }

  window.GTPEngine = {
    createGame, getSettings, saveSettings, escapeHtml, toast,
    difficulty, DIFFICULTY, DIFF_ORDER, diffLabel, diffIcon, diffNaming, themeName, applyTheme,
  };
})();
