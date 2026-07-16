/* Passle — sound effects.
   Subtle "pop" on every correct guess; anime "wow" every 50th in a session
   streak. Kept quiet; user can mute via the topbar speaker toggle (persisted).
   Pop is synthesized with WebAudio (no asset); wow is a bundled mp3. */
(function () {
  const MUTE_KEY = 'gtp_muted';
  const WOW_SRC = 'assets/audio/anime-wow.mp3?v=6';
  const WOW_VOL = 0.28; // quiet
  const POP_VOL = 0.10; // very subtle

  // Gears theme — real game audio (bundled locally; see about.html credits).
  const GEARS_CHAINSAW = 'assets/audio/gears-chainsaw.mp3?v=1';
  const GEARS_COG = 'assets/audio/gears-cog.mp3?v=1';
  // Random character barks, played last in the boot sequence.
  const GEARS_VOICES = [
    'assets/audio/gears-marcus.mp3?v=1', // Marcus — "Oh yeah"
    'assets/audio/gears-cole.mp3?v=1',   // Cole — "Bring it on, baby!"
    'assets/audio/gears-baird.mp3?v=1',  // Baird — "Look who decided to show up"
    'assets/audio/gears-dom.mp3?v=1',    // Dom — "Let's get messy"
  ];

  let ctx = null;
  let wowAudio = null;
  const fileCache = {};

  // The Gears power-on fanfare should fire ONCE — when the Gears theme first
  // loads in this browsing session — not on every page navigation (the theme
  // persists in localStorage, so every page would otherwise replay it and the
  // cues would clip each other). sessionStorage clears when the tab closes, so
  // "once per session" == "once when you switch Gears on and start playing".
  const FANFARE_KEY = 'gtp_gears_fanfare';
  function fanfarePlayed() {
    try { return sessionStorage.getItem(FANFARE_KEY) === '1'; } catch (e) { return false; }
  }
  function markFanfarePlayed() {
    try { sessionStorage.setItem(FANFARE_KEY, '1'); } catch (e) {}
  }

  function muted() { return localStorage.getItem(MUTE_KEY) === '1'; }
  function setMuted(m) { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); refreshToggle(); }

  // Play a bundled audio file (cached HTMLAudioElement). Returns the element,
  // or null on failure so callers can fall back to a synthesized cue.
  function playFile(src, vol) {
    if (muted()) return null;
    try {
      let a = fileCache[src];
      if (!a) { a = new Audio(src); a.preload = 'auto'; fileCache[src] = a; }
      a.volume = (vol == null) ? 1 : vol;
      a.currentTime = 0;
      const p = a.play();
      if (p && p.catch) p.catch(function () {});
      return a;
    } catch (e) { return null; }
  }


  function audioCtx() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    } catch (e) { ctx = null; }
    return ctx;
  }

  // Short, soft "pop" — pitch drop with a quick envelope.
  function pop() {
    if (muted()) return;
    const c = audioCtx();
    if (!c) return;
    try {
      if (c.state === 'suspended') c.resume();
      const t = c.currentTime;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, t);
      osc.frequency.exponentialRampToValueAtTime(150, t + 0.09);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(POP_VOL, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      osc.connect(gain).connect(c.destination);
      osc.start(t);
      osc.stop(t + 0.13);
    } catch (e) {}
  }

  function wow() {
    if (muted()) return;
    try {
      if (!wowAudio) { wowAudio = new Audio(WOW_SRC); wowAudio.preload = 'auto'; }
      wowAudio.volume = WOW_VOL;
      wowAudio.currentTime = 0;
      const p = wowAudio.play();
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }

  // Xbox-style "achievement unlocked" chime — a soft rising whoosh into a bright
  // two-note signature, a sparkle arpeggio and a warm bell body with a shimmer
  // tail. Synthesized, no asset.
  function achievement() {
    if (muted()) return;
    const c = audioCtx();
    if (!c) return;
    try {
      if (c.state === 'suspended') c.resume();
      const t0 = c.currentTime;
      const master = c.createGain();
      master.gain.value = 0.85;
      master.connect(c.destination);

      // Light reverb-ish tail via a short feedback delay for shimmer.
      let delay = null, fb = null, wet = null;
      try {
        delay = c.createDelay(0.5); delay.delayTime.value = 0.13;
        fb = c.createGain(); fb.gain.value = 0.28;
        wet = c.createGain(); wet.gain.value = 0.35;
        delay.connect(fb).connect(delay);
        delay.connect(wet).connect(c.destination);
      } catch (e) { delay = null; }
      function voice(dest) { return delay ? [master, delay] : [master]; }

      // 1) rising whoosh — filtered noise sweep that lifts into the chime.
      const nb = c.createBuffer(1, Math.floor(c.sampleRate * 0.5), c.sampleRate);
      const nd = nb.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1);
      const noise = c.createBufferSource(); noise.buffer = nb;
      const nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.Q.value = 0.9;
      nf.frequency.setValueAtTime(500, t0);
      nf.frequency.exponentialRampToValueAtTime(4200, t0 + 0.32);
      const ng = c.createGain();
      ng.gain.setValueAtTime(0.0001, t0);
      ng.gain.exponentialRampToValueAtTime(0.10, t0 + 0.10);
      ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.42);
      noise.connect(nf).connect(ng).connect(master);
      noise.start(t0); noise.stop(t0 + 0.5);

      // 2) bright bell notes: a quick ascending run, then the iconic higher
      //    "ta-DA" pair landing a touch later. [freq, start, type, peak, dur]
      const notes = [
        [1046.5, 0.18, 'triangle', 0.16, 0.5],  // C6
        [1318.5, 0.26, 'triangle', 0.16, 0.5],  // E6
        [1568.0, 0.34, 'triangle', 0.20, 0.6],  // G6
        [2093.0, 0.50, 'sine', 0.22, 0.9],      // C7  — signature high
        [3136.0, 0.50, 'sine', 0.08, 0.9],      // G7  — airy octave shimmer
        [2637.0, 0.66, 'sine', 0.12, 1.0],      // E7  — resolving sparkle
      ];
      notes.forEach(function (n) {
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = n[2];
        osc.frequency.setValueAtTime(n[0], t0 + n[1]);
        const a = t0 + n[1];
        g.gain.setValueAtTime(0.0001, a);
        g.gain.exponentialRampToValueAtTime(n[3], a + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, a + n[4]);
        osc.connect(g);
        voice().forEach(function (d) { g.connect(d); });
        osc.start(a);
        osc.stop(a + n[4] + 0.05);
      });

      // 3) warm bell body underneath for weight.
      const sub = c.createOscillator();
      const sg = c.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(523.25, t0 + 0.18); // C5
      sg.gain.setValueAtTime(0.0001, t0 + 0.18);
      sg.gain.exponentialRampToValueAtTime(0.14, t0 + 0.24);
      sg.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.15);
      sub.connect(sg).connect(master);
      sub.start(t0 + 0.18);
      sub.stop(t0 + 1.25);
    } catch (e) {}
  }

  // Soft mechanical "click" for controller button presses.
  function click() {
    if (muted()) return;
    const c = audioCtx();
    if (!c) return;
    try {
      if (c.state === 'suspended') c.resume();
      const t = c.currentTime;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(680, t);
      osc.frequency.exponentialRampToValueAtTime(320, t + 0.04);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.06, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      osc.connect(gain).connect(c.destination);
      osc.start(t);
      osc.stop(t + 0.07);
    } catch (e) {}
  }

  // Harsh "weapon jammed" error buzz — two clashing low square tones that drop
  // in pitch plus a filtered noise clunk. Played when the active-reload lock
  // misses (replaces the old "wow" on a fail).
  function error() {
    if (muted()) return;
    const c = audioCtx();
    if (!c) return;
    try {
      if (c.state === 'suspended') c.resume();
      const t = c.currentTime;
      const master = c.createGain(); master.gain.value = 0.5; master.connect(c.destination);
      [146.83, 155.56].forEach(function (f) {           // D3 vs D#3 — dissonant
        const o = c.createOscillator(); o.type = 'square';
        o.frequency.setValueAtTime(f, t);
        o.frequency.exponentialRampToValueAtTime(f * 0.5, t + 0.32);
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
        o.connect(g).connect(master);
        o.start(t); o.stop(t + 0.38);
      });
      const nb = c.createBuffer(1, Math.floor(c.sampleRate * 0.14), c.sampleRate);
      const nd = nb.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / nd.length, 1.4);
      const noise = c.createBufferSource(); noise.buffer = nb;
      const nf = c.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 900;
      const ng = c.createGain(); ng.gain.value = 0.3;
      noise.connect(nf).connect(ng).connect(master);
      noise.start(t); noise.stop(t + 0.14);
    } catch (e) {}
  }

  // Gears "Lancer" chainsaw rev — real game audio, falling back to a
  // synthesized rev (detuned buzzy saws through a lowpass with tremolo).
  // Returns the HTMLAudioElement when the real file plays (so the boot sequence
  // can wait for it to finish), or null when the synth fallback is used.
  function chainsaw() {
    if (muted()) return null;
    var a = playFile(GEARS_CHAINSAW, 0.5);
    if (a) return a;
    chainsawSynth();
    return null;
  }
  function chainsawSynth() {
    if (muted()) return;
    const c = audioCtx();
    if (!c) return;
    try {
      if (c.state === 'suspended') c.resume();
      const t = c.currentTime;
      const dur = 1.6;
      const master = c.createGain();
      master.gain.setValueAtTime(0.0001, t);
      master.gain.exponentialRampToValueAtTime(0.5, t + 0.12);
      master.gain.setValueAtTime(0.5, t + dur - 0.5);
      master.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      master.connect(c.destination);

      const filt = c.createBiquadFilter();
      filt.type = 'lowpass'; filt.Q.value = 6;
      filt.frequency.setValueAtTime(500, t);
      filt.frequency.exponentialRampToValueAtTime(2600, t + 0.25); // rev up
      filt.frequency.exponentialRampToValueAtTime(1400, t + dur);  // settle

      // tremolo LFO modulates a gain node (base 1 + depth) => buzzy engine
      const trem = c.createGain(); trem.gain.value = 1;
      filt.connect(trem).connect(master);
      const lfo = c.createOscillator(); lfo.type = 'square';
      lfo.frequency.setValueAtTime(26, t);
      lfo.frequency.exponentialRampToValueAtTime(46, t + 0.25);
      const lfoDepth = c.createGain(); lfoDepth.gain.value = 0.35;
      lfo.connect(lfoDepth).connect(trem.gain);
      lfo.start(t); lfo.stop(t + dur);

      const base = 96;
      [-6, 7].forEach(function (det) {
        const o = c.createOscillator();
        o.type = 'sawtooth'; o.detune.value = det;
        o.frequency.setValueAtTime(base * 0.7, t);
        o.frequency.exponentialRampToValueAtTime(base * 1.35, t + 0.22);
        o.frequency.exponentialRampToValueAtTime(base, t + dur);
        const og = c.createGain(); og.gain.value = 0.5;
        o.connect(og).connect(filt);
        o.start(t); o.stop(t + dur);
      });

      // gritty noise bed
      const nb = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
      const nd = nb.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * 0.5;
      const noise = c.createBufferSource(); noise.buffer = nb;
      const ng = c.createGain(); ng.gain.value = 0.15;
      noise.connect(ng).connect(filt);
      noise.start(t); noise.stop(t + dur);
    } catch (e) {}
  }

  // Gears COG-tag pickup — real game audio, falling back to a synthesized
  // metallic "ching". Returns the HTMLAudioElement (or null on synth fallback).
  function cogTag() {
    if (muted()) return null;
    var a = playFile(GEARS_COG, 0.55);
    if (a) return a;
    cogTagSynth();
    return null;
  }
  function cogTagSynth() {
    if (muted()) return;
    const c = audioCtx();
    if (!c) return;
    try {
      if (c.state === 'suspended') c.resume();
      const t = c.currentTime;
      const master = c.createGain(); master.gain.value = 0.5; master.connect(c.destination);
      const parts = [[1245, 0.0, 0.34], [1867, 0.008, 0.22], [2632, 0.016, 0.14], [3520, 0.02, 0.08]];
      parts.forEach(function (p) {
        const o = c.createOscillator(); o.type = 'triangle';
        o.frequency.setValueAtTime(p[0], t + p[1]);
        const g = c.createGain(); const a = t + p[1];
        g.gain.setValueAtTime(0.0001, a);
        g.gain.exponentialRampToValueAtTime(p[2], a + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, a + 0.45);
        o.connect(g).connect(master);
        o.start(a); o.stop(a + 0.5);
      });
      const nb = c.createBuffer(1, Math.floor(c.sampleRate * 0.03), c.sampleRate);
      const nd = nb.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / nd.length, 2);
      const noise = c.createBufferSource(); noise.buffer = nb;
      const nf = c.createBiquadFilter(); nf.type = 'highpass'; nf.frequency.value = 2500;
      const ng = c.createGain(); ng.gain.value = 0.25;
      noise.connect(nf).connect(ng).connect(master);
      noise.start(t); noise.stop(t + 0.03);
    } catch (e) {}
  }

  // A random Gears character bark (Marcus / Cole / Baird / Dom). Returns the
  // HTMLAudioElement so the boot sequence can wait for it.
  function character() {
    if (muted()) return null;
    const src = GEARS_VOICES[Math.floor(Math.random() * GEARS_VOICES.length)];
    return playFile(src, 0.9);
  }

  // Wait for a sound to finish before continuing the boot chain. The real signal
  // is the element's `ended` event; the timeout is only a SAFETY NET for when
  // `ended` never arrives (decode error, throttled tab, or a synth fallback with
  // no element). Crucially the net is sized to the clip's real duration when we
  // know it, so a long cue is never cut off early — the previous version fired a
  // fixed timeout that clipped cues that ran longer than it.
  function afterSound(el, fallbackMs, cb) {
    var fired = false;
    function go() { if (fired) return; fired = true; cb(); }
    if (el && el.addEventListener) {
      el.addEventListener('ended', go, { once: true });
      var guard = function () {
        var ms = (el.duration && isFinite(el.duration)) ? el.duration * 1000 + 350 : Math.max(fallbackMs, 8000);
        setTimeout(go, ms);
      };
      if (el.duration && isFinite(el.duration)) guard();
      else {
        el.addEventListener('loadedmetadata', guard, { once: true });
        setTimeout(go, Math.max(fallbackMs, 8000)); // absolute backstop
      }
    } else {
      setTimeout(go, fallbackMs);
    }
  }

  // The Gears "power-on" fanfare: chainsaw, then COG tag, then a random
  // character line — each one now plays ALL the way through before the next
  // begins (with a short beat between), so they no longer clip each other. A
  // guard stops a second trigger (e.g. theme-on-load + the unlock intro) from
  // starting an overlapping sequence.
  var bootPlaying = false;
  function gearsBoot() {
    if (muted()) return;
    if (bootPlaying) return;
    // Only ever play the fanfare once per session — the theme persists across
    // navigations, so without this every page would restart (and clip) it.
    if (fanfarePlayed()) return;
    bootPlaying = true;
    markFanfarePlayed();
    var GAP = 220;
    var doneBoot = function () { bootPlaying = false; };
    // Hard ceiling so the guard always clears even if a cue never ends.
    var ceiling = setTimeout(doneBoot, 14000);
    afterSound(chainsaw(), 2600, function () {
      if (muted()) { clearTimeout(ceiling); doneBoot(); return; }
      setTimeout(function () {
        afterSound(cogTag(), 1600, function () {
          if (muted()) { clearTimeout(ceiling); doneBoot(); return; }
          setTimeout(function () {
            afterSound(character(), 3000, function () { clearTimeout(ceiling); doneBoot(); });
          }, GAP);
        });
      }, GAP);
    });
  }

  const SFX = { pop, wow, achievement, error, click, chainsaw, cogTag, character, gearsBoot, themeChime, muted, setMuted };
  window.GTPSfx = SFX;

  // Play the Gears power-on fanfare when the Gears theme is present on load.
  // Fresh navigations lose the autoplay gesture, so if the AudioContext is
  // still suspended we arm a one-shot: the fanfare fires on the first input.
  function themeChime() {
    if (muted()) return;
    if (!document.body || !document.body.classList.contains('gears-theme')) return;
    if (fanfarePlayed()) return; // already fired this session — don't nag on every page
    const c = audioCtx();
    if (c && c.state === 'running') { gearsBoot(); return; }
    const evs = ['pointerdown', 'keydown', 'touchstart', 'gtp:gamepad'];
    function armed() {
      evs.forEach(function (ev) { window.removeEventListener(ev, armed, true); });
      const cc = audioCtx();
      try { if (cc && cc.state === 'suspended') cc.resume(); } catch (e) {}
      gearsBoot();
    }
    evs.forEach(function (ev) { window.addEventListener(ev, armed, true); });
  }

  // Every correct guess funnels through GTP.streak.win(), which dispatches this.
  window.addEventListener('gtp:win', function (e) {
    const n = (e.detail && e.detail.streak) || 0;
    if (n > 0 && n % 50 === 0) wow();
    else pop();
  });

  // ---- topbar mute toggle ----
  function iconHtml() {
    return muted()
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l4 6M21 9l-4 6"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12"/></svg>';
  }
  function refreshToggle() {
    const b = document.getElementById('sfxToggle');
    if (b) { b.innerHTML = iconHtml(); b.classList.toggle('muted', muted()); b.title = muted() ? 'Sound off' : 'Sound on'; }
  }
  function mountToggle() {
    const bar = document.querySelector('.topbar');
    if (!bar || document.getElementById('sfxToggle')) return;
    const b = document.createElement('button');
    b.id = 'sfxToggle';
    b.className = 'sfxtoggle';
    b.innerHTML = iconHtml();
    b.title = muted() ? 'Sound off' : 'Sound on';
    b.classList.toggle('muted', muted());
    b.onclick = function () { setMuted(!muted()); if (!muted()) pop(); };
    bar.appendChild(b);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { mountToggle(); themeChime(); });
  else { mountToggle(); themeChime(); }
})();
