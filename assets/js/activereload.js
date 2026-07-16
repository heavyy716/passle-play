/* Passle — Gears "active reload" unlock (controller).
   Press the Right Bumper (RB) on the menu to pop an active-reload-style
   mini-game. Nail the reload bar (Right Bumper / A / R / Space / click) inside
   the glowing band to unlock Gears mode. Miss and the weapon jams (error buzz)
   and the mini-game closes — press RB again to retry.

   Decoupled from index.html: on success it dispatches `gtp:gears-unlock` (and
   calls window.PassleGears.unlock() if present). Only arms where the menu has
   published window.PassleGears, so it never triggers on plain game pages. */
(function () {
  if (!('getGamepads' in navigator)) return;

  var RB = 5, A = 0;
  var SWEEP_MS = 1150;     // marker crosses the bar in this time (one pass)
  var TIMEOUT_MS = 4200;   // auto-jam if you never lock

  var raf = null, prev = {};
  var game = null;         // { pos, dir, last, perfect:[a,b], active:[a,b], raf, over }

  function menuArmed() { return !!(window.PassleGears && window.PassleGears.unlock); }
  function alreadyGears() {
    try { return !!(window.PassleGears && window.PassleGears.unlocked && window.PassleGears.unlocked()); }
    catch (e) { return false; }
  }

  // ---------- mini-game ----------
  function startGame() {
    if (game) return;
    try { if (window.GTPSfx && GTPSfx.click) GTPSfx.click(); } catch (e) {}

    var overlay = document.createElement('div');
    overlay.className = 'reload-overlay';
    // Randomised bands: a wider "active" zone with a tight "perfect" sweet spot.
    var activeW = 0.16, perfectW = 0.05;
    var aStart = 0.34 + Math.random() * (0.62 - activeW - 0.34);
    var pStart = aStart + Math.random() * (activeW - perfectW);
    overlay.innerHTML =
      '<div class="reload-panel" role="dialog" aria-label="Active reload">' +
        '<div class="reload-title">ACTIVE RELOAD</div>' +
        '<div class="reload-sub">Lock the reload in the band \u2014 <b>RB</b> / <b>A</b> / <b>Space</b></div>' +
        '<div class="reload-bar">' +
          '<span class="rl-active" style="left:' + (aStart * 100) + '%;width:' + (activeW * 100) + '%"></span>' +
          '<span class="rl-perfect" style="left:' + (pStart * 100) + '%;width:' + (perfectW * 100) + '%"></span>' +
          '<span class="rl-marker"></span>' +
        '</div>' +
        '<div class="reload-hint">Miss and the weapon jams. <b>Esc</b> to cancel.</div>' +
      '</div>';
    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.classList.add('show'); });

    game = {
      overlay: overlay,
      marker: overlay.querySelector('.rl-marker'),
      pos: 0, dir: 1, last: performance.now(), over: false,
      perfect: [pStart, pStart + perfectW],
      active: [aStart, aStart + activeW],
      started: performance.now(),
    };

    document.addEventListener('keydown', onKey, true);
    tickMarker();
  }

  function tickMarker() {
    if (!game || game.over) return;
    var now = performance.now();
    var dt = now - game.last; game.last = now;
    game.pos += game.dir * (dt / SWEEP_MS);
    if (game.pos >= 1) { game.pos = 1; game.dir = -1; }
    else if (game.pos <= 0) { game.pos = 0; game.dir = 1; }
    if (game.marker) game.marker.style.left = (game.pos * 100) + '%';
    if (now - game.started > TIMEOUT_MS) { resolve('jam'); return; }
    game.raf = requestAnimationFrame(tickMarker);
  }

  function inBand(band) { return game.pos >= band[0] && game.pos <= band[1]; }

  function lock() {
    if (!game || game.over) return;
    if (inBand(game.perfect)) resolve('perfect');
    else if (inBand(game.active)) resolve('active');
    else resolve('jam');
  }

  function resolve(kind) {
    if (!game || game.over) return;
    game.over = true;
    if (game.raf) cancelAnimationFrame(game.raf);
    document.removeEventListener('keydown', onKey, true);
    var panel = game.overlay.querySelector('.reload-panel');
    var marker = game.marker;

    if (kind === 'cancel') {
      closeGame(120);
      return;
    }
    if (kind === 'jam') {
      if (panel) panel.classList.add('jam');
      if (marker) marker.classList.add('miss');
      try { if (window.GTPSfx && GTPSfx.error) GTPSfx.error(); } catch (e) {}
      flashMsg('WEAPON JAMMED', 'rl-fail');
      closeGame(900);
    } else {
      if (panel) panel.classList.add(kind === 'perfect' ? 'perfect-hit' : 'active-hit');
      if (marker) marker.classList.add('hit');
      flashMsg(kind === 'perfect' ? 'PERFECT ACTIVE RELOAD' : 'ACTIVE RELOAD', 'rl-win');
      unlock();
      closeGame(760);
    }
  }

  function flashMsg(text, cls) {
    if (!game) return;
    var m = document.createElement('div');
    m.className = 'reload-flash ' + cls;
    m.textContent = text;
    game.overlay.querySelector('.reload-panel').appendChild(m);
    requestAnimationFrame(function () { m.classList.add('show'); });
  }

  function closeGame(delay) {
    var ov = game ? game.overlay : null;
    setTimeout(function () {
      if (ov) { ov.classList.remove('show'); setTimeout(function () { if (ov.parentNode) ov.remove(); }, 220); }
    }, delay);
    setTimeout(function () { game = null; }, delay + 260);
  }

  function unlock() {
    try {
      if (window.PassleGears && window.PassleGears.unlock) window.PassleGears.unlock();
      else {
        localStorage.setItem('gtp_gears_unlocked', '1');
        window.dispatchEvent(new CustomEvent('gtp:gears-unlock'));
      }
    } catch (e) {}
  }

  function onKey(e) {
    if (!game || game.over) return;
    if (e.repeat) return;   // a held key (e.g. the R used to open this) must not auto-lock
    if (e.key === 'Escape') { e.preventDefault(); resolve('cancel'); return; }
    if (e.key === ' ' || e.code === 'Space' || e.key === 'Enter' || e.key === 'r' || e.key === 'R') {
      e.preventDefault(); lock();
    }
  }

  // Click-to-lock anywhere on the bar.
  document.addEventListener('click', function (e) {
    if (game && !game.over && e.target && e.target.closest && e.target.closest('.reload-overlay')) lock();
  });

  // ---------- keyboard fallback (press R) ----------
  // Controller RB is the canonical trigger, but pressing the R key does the
  // same on the menu — reachable without a pad, and easy to verify.
  function typingTarget(el) {
    return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
  }
  document.addEventListener('keydown', function (e) {
    if (e.repeat || game) return;
    if (e.key !== 'r' && e.key !== 'R') return;
    if (typingTarget(e.target)) return;
    if (document.querySelector('.overlay.show, .konami-overlay.show')) return;
    if (!menuArmed() || alreadyGears()) return;
    startGame();
  });

  // ---------- gamepad poll ----------
  function poll() {
    var pads = navigator.getGamepads ? navigator.getGamepads() : [];
    var gp = null;
    for (var i = 0; i < pads.length; i++) { if (pads[i]) { gp = pads[i]; break; } }
    if (gp) {
      var rb = !!(gp.buttons[RB] && gp.buttons[RB].pressed);
      var a = !!(gp.buttons[A] && gp.buttons[A].pressed);

      if (game && !game.over) {
        if ((rb && !prev.rb) || (a && !prev.a)) lock();
      } else if (!game && (rb && !prev.rb) && menuArmed() && !alreadyGears() &&
                 !document.querySelector('.overlay.show, .konami-overlay.show')) {
        // Single RB press on the menu opens the active-reload mini-game.
        startGame();
      }
      prev.rb = rb; prev.a = a;
    }
    raf = requestAnimationFrame(poll);
  }
  raf = requestAnimationFrame(poll);
})();
