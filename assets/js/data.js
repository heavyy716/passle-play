/* Passle — shared data layer */
(function () {
  const GTP = {};
  GTP.games = [];
  GTP.meta = null;
  GTP.ogGames = [];

  const BASE = (function () {
    // resolve data path relative to site root (works on GitHub Pages subpaths)
    const path = location.pathname;
    const dir = path.substring(0, path.lastIndexOf('/') + 1);
    return dir;
  })();

  GTP.load = async function () {
    if (GTP.games.length) return GTP;
    const [g, m, og] = await Promise.all([
      fetch(BASE + 'data/games.json').then(r => r.json()),
      fetch(BASE + 'data/meta.json').then(r => r.json()).catch(() => null),
      fetch(BASE + 'data/og_games.json').then(r => r.json()).catch(() => []),
    ]);
    GTP.games = canonicalize(g);
    GTP.meta = m;
    GTP.ogGames = canonicalize(Array.isArray(og) ? og : []);
    return GTP;
  };

  // Lazily load positive store reviews (only used by the review mode).
  GTP.reviews = null;
  GTP.loadReviews = async function () {
    if (GTP.reviews) return GTP.reviews;
    GTP.reviews = await fetch(BASE + 'data/reviews.json').then(r => r.json()).catch(() => ({}));
    return GTP.reviews;
  };

  // ---- catalog canonicalization ----
  // Collapse duplicate SKUs of the same game — edition variants (Ultimate /
  // Standard / Cross-Gen Bundle / Game of the Year), platform siblings (Xbox
  // One / Series X|S / Windows / PC), and ®/™/smart-quote spelling differences —
  // into a single record with a clean display title. Sequel numbers and roman
  // numerals are preserved so "Age of Empires II/III/IV" stay distinct. Each
  // surviving record is also tagged `sports:true` when it belongs to an annual
  // sports franchise, so the Settings "Sports" toggle can hide them.
  function canonBase(s) {
    return String(s || '').toLowerCase()
      .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[\u00ae\u2122\u00a9]/g, '')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }
  // Edition-qualifier words: only stripped when they run contiguously up to an
  // "Edition"/"Bundle" anchor (never grabbed from the middle of a title).
  const CANON_QUAL = new Set(('ultimate deluxe standard definitive complete gold premium legendary legacy ' +
    'digital anniversary enhanced special classic maximum evil survivor cross gen crossgen game of the year ' +
    'goty day one founders founder collectors collector 40th s ' +
    'director directors remastered remaster elite').split(/\s+/));
  const CANON_PLAT = new Set('xbox one series x s windows win pc console version'.split(' '));

  // Grouping key: strip a trailing platform run and a trailing Edition/Bundle +
  // qualifier run, keeping interior sequel numbers.
  function canonKey(title) {
    let toks = canonBase(title).split(' ').filter(Boolean);
    const stripPlat = function () {
      while (toks.length > 1 && CANON_PLAT.has(toks[toks.length - 1])) toks.pop();
      if (toks.length > 1 && toks[toks.length - 1] === 'for') toks.pop();
    };
    stripPlat();
    if (toks.length > 1 && (toks[toks.length - 1] === 'edition' || toks[toks.length - 1] === 'bundle')) {
      toks.pop();
      while (toks.length > 1 && CANON_QUAL.has(toks[toks.length - 1])) toks.pop();
      stripPlat();
    }
    return toks.join(' ');
  }

  const CANON_EDITION_RE = new RegExp('\\s*[-\u2013\u2014:]?\\s*(?:(?:ultimate|deluxe|standard|definitive|' +
    'complete|gold|premium|legendary|legacy|digital|anniversary|enhanced|special|classic|maximum|evil|survivor|' +
    'elite|cross[- ]?gen|game of the year|goty|day one|founder\'?s?|collector\'?s?|40th|' +
    'director\'?s? cut)\\s+)*(?:edition|bundle)\\s*$', 'i');
  const CANON_PAREN_RE = /\s*\((?:windows(?: version)?(?: pc)?|windows pc|win|pc|xbox one|xbox series[^)]*|console)\)\s*$/i;
  const CANON_PLAT_RE = /\s*[-\u2013\u2014:]?\s*(?:for\s+)?(?:xbox series x\s*[\|\/]\s*s|xbox series|xbox one|xbox|windows(?: version)?|pc|console)\s*$/i;

  function displayClean(title) {
    let t = String(title || '').replace(/\s+/g, ' ').trim();
    let prev;
    do {
      prev = t;
      t = t.replace(CANON_PAREN_RE, '').trim();
      t = t.replace(CANON_PLAT_RE, '').trim();
      t = t.replace(CANON_EDITION_RE, '').trim();
      t = t.replace(/[\s:\u2013\u2014-]+$/, '').trim();
    } while (t !== prev && t.length);
    return t || String(title || '').trim();
  }
  // Light clean (platform/paren only) — used for single-SKU games so a real
  // edition name (e.g. "ARK: Ultimate Survivor Edition") isn't chopped away.
  function lightClean(title) {
    let t = String(title || '').replace(/\s+/g, ' ').trim();
    let prev;
    do {
      prev = t;
      t = t.replace(CANON_PAREN_RE, '').trim();
      t = t.replace(CANON_PLAT_RE, '').trim();
      t = t.replace(/[\s:\u2013\u2014-]+$/, '').trim();
    } while (t !== prev && t.length);
    return t || String(title || '').trim();
  }

  const CANON_SPORTS = [/\bmadden\b/i, /\bfifa\b/i, /\bea sports fc\b/i, /\bea fc\b/i, /\bnhl\b/i,
    /\bnba 2k\b/i, /\bnba live\b/i, /\bnba playgrounds\b/i, /\bmlb the show\b/i, /\bmlb\b/i,
    /\bpga\b/i, /\bufc\b/i, /\bwwe\b/i, /\bf1\s*\d/i, /\bformula 1\b/i, /\bcricket\b/i, /\brugby\b/i,
    /\bpro evolution soccer\b/i, /\befootball\b/i, /\bfootball manager\b/i, /\btennis\b/i];
  function isSport(g) { const t = (g && g.title) || ''; return CANON_SPORTS.some(re => re.test(t)); }

  function canonScore(g) {
    let s = 0;
    if (g.images && g.images.boxart) s += 1000;
    s += (g.criticScore || 0);
    s += (g.igdbRating || 0) / 10;
    s += (g.rating || 0);
    if (!g.legacy) s += 5;
    if (g.year) s += 1;
    return s;
  }
  function tokLen(t) { return canonBase(t).split(' ').filter(Boolean).length; }

  function canonicalize(list) {
    if (!Array.isArray(list) || !list.length) return list || [];
    const groups = new Map();
    for (const g of list) {
      if (!g || !g.title) continue;
      const k = canonKey(g.title);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(g);
    }
    const out = [];
    for (const grp of groups.values()) {
      grp.sort((a, b) => canonScore(b) - canonScore(a));
      const rep = Object.assign({}, grp[0]);
      const disp = grp.slice().sort((a, b) =>
        tokLen(a.title) - tokLen(b.title) || a.title.length - b.title.length)[0].title;
      const agg = displayClean(disp);
      const baseMatch = grp.some(m => lightClean(m.title).toLowerCase() === agg.toLowerCase());
      // Accept the aggressive clean whenever it still yields a real name. It only
      // strips trailing platform/edition noise, so single-word bases (e.g. "Avowed
      // Standard Edition" -> "Avowed") clean up too, while a lone edition whose
      // name collapses to nothing falls back to the platform-only clean.
      const cleaned = (baseMatch || agg.split(' ').filter(Boolean).length >= 1) ? agg : lightClean(disp);
      rep.title = cleaned;
      rep.sortTitle = cleaned;
      rep.sports = grp.some(isSport);
      out.push(rep);
    }
    return out;
  }
  GTP.canonicalize = canonicalize;

  // True when the Sports toggle is on (annual sports franchises included).
  GTP._sportsOn = function () {
    try { return !!(JSON.parse(localStorage.getItem('gtp_settings')) || {}).sports; }
    catch (e) { return false; }
  };

  // ---- scope + plan filtering ----
  // scope: 'current' | 'legacy' | 'combined'
  // plans: array subset of ['ultimate','premium','essential','pc'].
  //        An array (even empty) is an explicit subscription selection, so an
  //        EMPTY array matches nothing. Pass null/undefined for "no constraint"
  //        (used by internal fallbacks that want the whole current catalog).
  // og: when true, ignore scope/plans and use the Original Xbox library instead.
  GTP.filter = function (scope, plans, og, sportsAllowed) {
    const allow = (sportsAllowed === undefined) ? GTP._sportsOn() : !!sportsAllowed;
    if (og) {
      const op = GTP.ogGames.slice();
      return allow ? op : op.filter(g => !g.sports);
    }
    let pool = GTP.games;
    if (scope === 'current') pool = pool.filter(g => !g.legacy);
    else if (scope === 'legacy') pool = pool.filter(g => g.legacy);
    if (Array.isArray(plans)) {
      pool = pool.filter(g => plans.some(p => g.tiers && g.tiers[p]));
    }
    if (!allow) pool = pool.filter(g => !g.sports);
    return pool;
  };

  // True when the user has explicitly selected no Game Pass subscription (and
  // isn't in OG mode): the pool should stay empty, not fall back to everything.
  GTP.noSelection = function (S) {
    return !!S && !S.og && Array.isArray(S.plans) && S.plans.length === 0;
  };

  // Resolve the active pool straight from a settings object.
  GTP.pool = function (S) {
    return GTP.filter(S && S.scope, S && S.plans, S && S.og, S && S.sports);
  };

  // full guessable title list for autocomplete (dedup by normalized title)
  GTP.titleIndex = function (pool) {
    const seen = new Set();
    const out = [];
    for (const g of pool) {
      const key = norm(g.title);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(g);
    }
    out.sort((a, b) => a.title.localeCompare(b.title));
    return out;
  };

  function norm(s) {
    return (s || '')
      .toLowerCase()
      .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }
  GTP.norm = norm;

  // Tokens that don't help identify a franchise (articles, edition noise, etc.)
  const STOP = new Set(['the', 'of', 'a', 'an', 'and', 'to', 'for']);
  const NOISE = new Set([
    'edition', 'standard', 'deluxe', 'ultimate', 'definitive', 'complete',
    'remastered', 'remaster', 'remake', 'goty', 'game', 'year', 'collection',
    'bundle', 'hd', 'anniversary', 'preview', 'trial', 'demo', 'digital',
    'pc', 'windows', 'console', 'xbox', 'series', 'version', 'pack',
  ]);
  const ROMAN = /^(x{0,3})(ix|iv|v?i{0,3})$/;

  // Significant, order-preserving tokens of a title (franchise-identifying words).
  function sigTokens(title) {
    return norm(title).split(' ').filter(t => {
      if (!t) return false;
      if (STOP.has(t) || NOISE.has(t)) return false;
      if (/^\d+$/.test(t)) return false;          // drop sequel numbers: "5"
      if (t !== 'i' && ROMAN.test(t)) return false; // drop roman numerals: "ii","iv"
      return true;
    });
  }
  GTP.sigTokens = sigTokens;

  // Heuristic: are two games part of the same franchise/series? Used to mark a
  // wrong-but-warm guess yellow. Two leading shared tokens (e.g. "assassin s
  // creed", "forza horizon", "age empires") is a confident match; a single
  // shared leading token (e.g. "forza", "halo", "gears") only counts when the
  // publisher or developer also matches, to avoid false hits like
  // "Dragon Age" vs "Dragon Quest".
  GTP.sameSeries = function (a, b) {
    if (!a || !b) return false;
    if (norm(a.title) === norm(b.title)) return false; // identical = a correct guess, not "close"
    const ta = sigTokens(a.title), tb = sigTokens(b.title);
    if (!ta.length || !tb.length) return false;
    let n = 0;
    while (n < ta.length && n < tb.length && ta[n] === tb[n]) n++;
    if (n >= 2) return true;
    if (n === 1) {
      const pubMatch = a.publisher && b.publisher && norm(a.publisher) === norm(b.publisher);
      const devMatch = a.developer && b.developer && norm(a.developer) === norm(b.developer);
      return !!(pubMatch || devMatch);
    }
    return false;
  };

  // ---- deterministic daily pick ----
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }
  GTP.todayKey = function () {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  GTP.dailyIndex = function (mode, poolLen, dayKey) {
    const seed = hashStr(mode + '|' + (dayKey || GTP.todayKey()));
    return poolLen ? seed % poolLen : 0;
  };
  GTP.dayNumber = function () {
    // days since launch epoch for "Passle #N"
    const epoch = Date.UTC(2025, 0, 1);
    const now = new Date();
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.floor((today - epoch) / 86400000);
  };
  GTP.mulberry32 = function (a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // Unbiased random integer in [0, n). Uses the crypto RNG when available
  // (rejection-sampled to avoid modulo bias), falling back to Math.random. This
  // is the entropy source for every Endless pick and one-off seed, so shuffles
  // feel genuinely random instead of clustering the way raw Math.random can.
  GTP.randInt = function (n) {
    n = Math.floor(n);
    if (!(n > 0)) return 0;
    try {
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        var limit = Math.floor(4294967296 / n) * n; // largest multiple of n
        var buf = new Uint32Array(1), v;
        do { crypto.getRandomValues(buf); v = buf[0]; } while (v >= limit);
        return v % n;
      }
    } catch (e) {}
    return Math.floor(Math.random() * n);
  };
  // A fresh 32-bit seed for one-off Endless runs (mulberry32 input).
  GTP.randSeed = function () { return GTP.randInt(4294967296) | 0; };

  // ---- stats persistence ----
  GTP.stats = {
    key(mode) { return 'gtp_stats_' + mode; },
    get(mode) {
      try { return JSON.parse(localStorage.getItem(this.key(mode))) || {}; }
      catch (e) { return {}; }
    },
    record(mode, won, guesses) {
      const s = this.get(mode);
      s.played = (s.played || 0) + 1;
      s.wins = (s.wins || 0) + (won ? 1 : 0);
      s.curStreak = won ? (s.curStreak || 0) + 1 : 0;
      s.maxStreak = Math.max(s.maxStreak || 0, s.curStreak);
      s.dist = s.dist || {};
      if (won) s.dist[guesses] = (s.dist[guesses] || 0) + 1;
      localStorage.setItem(this.key(mode), JSON.stringify(s));
      return s;
    },
  };

  // ---- session streak (current = in-memory, resets on refresh/leave; best persists) ----
  // GTP is rebuilt on every page load, so _cur naturally clears when you refresh
  // or leave. Only the longest streak is written to localStorage.
  GTP.streak = {
    _cur: {},
    bestKey(mode) { return 'gtp_best_' + mode; },
    best(mode) {
      let b = parseInt(localStorage.getItem(this.bestKey(mode)), 10);
      if (isNaN(b)) { b = (GTP.stats.get(mode).maxStreak) || 0; } // migrate old value
      return b || 0;
    },
    current(mode) { return this._cur[mode] || 0; },
    recordBest(mode, val) {
      if (val > this.best(mode)) localStorage.setItem(this.bestKey(mode), String(val));
    },
    win(mode) {
      this._cur[mode] = (this._cur[mode] || 0) + 1;
      this.recordBest(mode, this._cur[mode]);
      var n = this._cur[mode];
      if (n % 10 === 0 && GTP.hints) GTP.hints.refresh(mode); // regain a hint every 10 in a row
      try { window.dispatchEvent(new CustomEvent('gtp:win', { detail: { mode: mode, streak: n } })); } catch (e) {}
      return n;
    },
    reset(mode) { this._cur[mode] = 0; },
  };

  // ---- hint budget: N per run (set by difficulty), spent on use, refreshes
  //      every 10-in-a-row ----
  // In-memory (like the session streak): each run you start with the difficulty's
  // hint budget, spend one per hint, and regain the full budget after every 10
  // correct in a row. GTP is rebuilt per page load, so this resets each session.
  GTP.hints = {
    _left: {},
    _budget: {},
    init(mode, budget) {
      budget = budget || 0;
      this._budget[mode] = budget;
      if (this._left[mode] === undefined) this._left[mode] = budget;
      else if (this._left[mode] > budget) this._left[mode] = budget; // difficulty lowered mid-session
    },
    available(mode) { return (this._left[mode] || 0) > 0; },
    left(mode) { return this._left[mode] || 0; },
    use(mode) { if (this._left[mode] > 0) this._left[mode]--; },
    refresh(mode) { this._left[mode] = this._budget[mode] || 0; },
    // correct-in-a-row still needed before the next refresh (when spent)
    needed(mode) { const c = GTP.streak.current(mode); return 10 - (c % 10); },
  };

  // ---- per-day result persistence (so refresh keeps state) ----
  GTP.daily = {
    key(mode, dayKey) { return 'gtp_daily_' + mode + '_' + dayKey; },
    load(mode, dayKey) {
      try { return JSON.parse(localStorage.getItem(this.key(mode, dayKey))); }
      catch (e) { return null; }
    },
    save(mode, dayKey, state) {
      localStorage.setItem(this.key(mode, dayKey), JSON.stringify(state));
    },
  };

  // ---- endless-mode no-repeat picker ----
  // Remembers the recently-served answer per game mode (persisted in
  // localStorage) so Endless mode stops handing you the same game twice in a
  // row / over and over. Daily mode stays deterministic and never uses this.
  GTP.rng = {
    _key(mode) { return 'gtp_recent_' + mode; },
    recent(mode) {
      try { return JSON.parse(localStorage.getItem(this._key(mode))) || []; }
      catch (e) { return []; }
    },
    _save(mode, arr) {
      try { localStorage.setItem(this._key(mode), JSON.stringify(arr)); } catch (e) {}
    },
    keyOf(it) {
      if (it == null) return null;
      return it.id != null ? it.id : (it.title != null ? it.title : it);
    },
    // record that `key` was just served for `mode`, keeping the memory window
    // just under the pool size so there's always at least one fresh option.
    note(mode, key, poolLen) {
      if (key == null) return;
      var arr = this.recent(mode).filter(function (k) { return k !== key; });
      arr.push(key);
      var cap = Math.max(1, Math.min((poolLen || arr.length) - 1, 60));
      while (arr.length > cap) arr.shift();
      this._save(mode, arr);
    },
    // pick a random item from `pool` avoiding recently-served + excluded keys.
    // keyFn(item) -> stable id (defaults to id/title). excludeKeys: extra keys
    // to skip for this call only (e.g. the item already on screen).
    pick(mode, pool, keyFn, excludeKeys) {
      if (!pool || !pool.length) return undefined;
      var kf = keyFn || this.keyOf;
      var ex = {};
      (excludeKeys || []).forEach(function (k) { ex[k] = 1; });
      if (pool.length === 1) { this.note(mode, kf(pool[0]), pool.length); return pool[0]; }
      var seen = this.recent(mode);
      var seenSet = {}; seen.forEach(function (k) { seenSet[k] = 1; });
      var fresh = pool.filter(function (it) { var k = kf(it); return !seenSet[k] && !ex[k]; });
      var from;
      if (fresh.length) {
        from = fresh;
      } else {
        // whole pool recently seen: relax memory but still avoid explicit
        // excludes and the single most-recent item.
        var last = seen.length ? seen[seen.length - 1] : null;
        from = pool.filter(function (it) { var k = kf(it); return !ex[k] && k !== last; });
        if (!from.length) from = pool.filter(function (it) { return !ex[kf(it)]; });
        if (!from.length) from = pool;
      }
      var chosen = from[GTP.randInt(from.length)];
      this.note(mode, kf(chosen), pool.length);
      return chosen;
    },
  };

  window.GTP = GTP;
})();
