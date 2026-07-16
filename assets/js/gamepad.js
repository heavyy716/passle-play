/* Passle — Xbox controller (Gamepad API) support.
   Spatial focus navigation with the D-pad / left stick, A to activate the
   focused control, B to go back. Works on every page because it drives native
   focus() + click() over standard focusable elements (the mode cards are
   anchors, game controls are buttons/inputs/links).

   Also dispatches a `gtp:gamepad` window event on first input so the Gears
   "COG tag" theme chime can satisfy the browser autoplay-gesture policy. */
(function () {
  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  var DEAD = 0.55;          // stick deadzone
  var REPEAT_MS = 170;      // held-direction repeat rate
  var connected = 0;
  var lastDir = 0;          // ms timestamp of last movement
  var prevBtn = {};         // edge-detect button state
  var raf = null;
  var firstInput = false;

  // Secret-code entry is deliberate: press the Left Bumper (LB, button 4) on the
  // main menu to summon the on-screen Xbox controller pad, then punch in the
  // Konami code there. There is NO "enter the code during normal navigation"
  // path — that conflicted with using the menu (the final A launched a game).
  // Requiring the pad also means the cheat can't be done without the on-screen
  // controller. LB mirrors RB (which opens the Gears active-reload), and only
  // fires where GTPKonami exists (the main menu) so it's inert everywhere else.
  var LB = 4;                // standard-mapping Left Bumper

  function visible(el) {
    if (!el || el.offsetParent === null && el !== document.activeElement) return false;
    var r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1 && r.bottom > 0 && r.right > 0 &&
           r.top < innerHeight && r.left < innerWidth;
  }
  // The element the gamepad is allowed to navigate inside. When a modal/overlay
  // is open we trap focus to it, so a D-pad press can never leak to the page
  // behind the dialog (that's the "jumps to the background" bug). Otherwise the
  // whole document is in scope.
  function scopeRoot() {
    // A visible on-screen keyboard captures navigation first.
    try { if (window.PassleVKbd && PassleVKbd.isOpen()) { var vk = PassleVKbd.root(); if (vk) return vk; } } catch (e) {}
    var overlays = document.querySelectorAll('.overlay.show');
    if (overlays.length) return overlays[overlays.length - 1];
    return document;
  }
  function items() {
    return Array.prototype.filter.call(scopeRoot().querySelectorAll(FOCUSABLE), function (el) {
      return visible(el) && !el.hasAttribute('data-gp-skip');
    });
  }
  function center(el) { var r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }

  function current() {
    var a = document.activeElement;
    if (!a || a === document.body || !a.matches || !a.matches(FOCUSABLE) || !visible(a)) return null;
    // Only honour focus that lives inside the current scope; ignore stale focus
    // sitting on the page behind an open modal.
    var root = scopeRoot();
    if (root !== document && !root.contains(a)) return null;
    return a;
  }

  // The best starting element when nothing valid is focused: an on-screen
  // "selected" item (OG blade item or home tile), else the first control. The
  // candidate must be in the live focusable list, so a hidden .tile.sel (e.g.
  // while OG mode is showing its own blade) is skipped instead of swallowing input.
  function initial(list) {
    var sels = ['.og-item.sel', '.tile.sel', '.sel'];
    for (var i = 0; i < sels.length; i++) {
      var el = scopeRoot().querySelector(sels[i]);
      if (el && list.indexOf(el) !== -1) return el;
    }
    return list[0];
  }

  // Focus the nearest visible control in a compass direction.
  function move(dir) {
    var list = items();
    if (!list.length) return;
    var cur = current();
    if (!cur) {
      focus(initial(list));
      return;
    }
    var c0 = center(cur);
    // Two candidates: the nearest neighbour that's genuinely in the pressed
    // direction (inside a ~45° cone), and a fallback for when nothing is
    // aligned. The cone stops a diagonal element (e.g. a difficulty chip below
    // the mode cards) from stealing a straight left/right press between the two
    // big menu buttons.
    var best = null, bestScore = Infinity;
    var fallback = null, fallbackScore = Infinity;
    list.forEach(function (el) {
      if (el === cur) return;
      var c = center(el), dx = c.x - c0.x, dy = c.y - c0.y;
      var primary, cross;
      if (dir === 'right') { primary = dx; cross = Math.abs(dy); }
      else if (dir === 'left') { primary = -dx; cross = Math.abs(dy); }
      else if (dir === 'down') { primary = dy; cross = Math.abs(dx); }
      else { primary = -dy; cross = Math.abs(dx); }
      if (primary <= 1) return;                 // must be in the chosen direction
      // In-cone: mostly straight ahead. Prefer the closest such element.
      if (cross <= primary) {
        var d = primary + cross;                // aligned & close wins
        if (d < bestScore) { bestScore = d; best = el; }
      }
      // Fallback only used when nothing is aligned; penalise off-axis heavily.
      var f = primary + cross * 3;
      if (f < fallbackScore) { fallbackScore = f; fallback = el; }
    });
    var target = best || fallback;
    if (target) focus(target);
  }

  function focus(el) {
    if (!el) return;
    try { el.focus({ preventScroll: false }); } catch (e) { try { el.focus(); } catch (e2) {} }
    if (el.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function activate() {
    var el = current();
    if (!el) { move('down'); return; }
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
      // Bring up the on-screen keyboard for controller users on text fields.
      if (window.PassleVKbd && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
        var ty = (el.type || 'text').toLowerCase();
        if (el.tagName === 'TEXTAREA' || /^(text|search|email|url|tel|password|)$/.test(ty)) {
          PassleVKbd.open(el);
        }
      }
      return;
    }
    el.click();
  }

  function back() {
    // A visible on-screen keyboard closes first.
    try { if (window.PassleVKbd && PassleVKbd.isOpen()) { PassleVKbd.close(); return; } } catch (e) {}
    // If a modal/overlay is open, close the topmost one (these dialogs close on
    // backdrop click but most don't listen for Escape, so B needs to do it).
    var overlays = document.querySelectorAll('.overlay.show');
    if (overlays.length) {
      var top = overlays[overlays.length - 1];
      top.classList.remove('show');
      top.dispatchEvent(new CustomEvent('gtp:overlay-close', { bubbles: true }));
      return;
    }
    var esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    document.dispatchEvent(esc);
    // If a page modal listens for Escape it will close; otherwise navigate home.
    if (document.querySelector('.modal-open, .overlay.show, .settings-open')) return;
    // On the OG blade dashboard, B leaves OG mode and returns to the normal home.
    var ogDash = document.body.classList.contains('og-theme') && document.getElementById('ogdash');
    if (ogDash && window.PassleExitOG) { window.PassleExitOG(); return; }
    if (/index\.html$|\/$/.test(location.pathname)) return;
    if (history.length > 1) history.back(); else location.href = 'index.html';
  }

  // Summon the on-screen secret-code pad (the only way to enter the Konami code
  // on a controller). Triggered by the Left Bumper on the main menu. No-op if
  // the pad isn't on this page or OG is already unlocked.
  function openSecretPad() {
    try {
      if (!window.GTPKonami || !GTPKonami.open) return;
      if (GTPKonami.unlocked && GTPKonami.unlocked()) return;
      if (document.querySelector('.konami-overlay.show')) return;
      signalFirstInput();
      GTPKonami.open();
      try { if (window.GTPSfx) GTPSfx.click(); } catch (e) {}
    } catch (e) {}
  }

  function signalFirstInput() {
    if (firstInput) return;
    firstInput = true;
    document.body.classList.add('gp-active');
    try { window.dispatchEvent(new Event('gtp:gamepad')); } catch (e) {}
  }

  function pressed(gp, i) { return gp.buttons[i] && gp.buttons[i].pressed; }

  function poll() {
    var pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (var p = 0; p < pads.length; p++) {
      var gp = pads[p];
      if (!gp) continue;
      var now = performance.now();

      // A raw-input modal (the secret-code pad or the active-reload mini-game)
      // consumes the gamepad itself. Yield: don't move focus, activate, or go
      // "back" (B would close it).
      if (document.querySelector('.konami-overlay.show, .reload-overlay.show')) {
        prevBtn[p] = { a: pressed(gp, 0), b: pressed(gp, 1), y: pressed(gp, 3), lb: pressed(gp, LB) };
        lastDir = 0;
        continue;
      }

      var ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      var up = pressed(gp, 12) || ay < -DEAD;
      var down = pressed(gp, 13) || ay > DEAD;
      var left = pressed(gp, 14) || ax < -DEAD;
      var right = pressed(gp, 15) || ax > DEAD;
      var anyDir = up || down || left || right;
      var aBtn = pressed(gp, 0), bBtn = pressed(gp, 1);

      // --- Left Bumper summons the secret-code pad (main menu only) ---
      var lbBtn = pressed(gp, LB);
      if (lbBtn && !(prevBtn[p] && prevBtn[p].lb)) openSecretPad();

      if (anyDir && now - lastDir > REPEAT_MS) {
        signalFirstInput();
        if (right) move('right'); else if (left) move('left');
        else if (down) move('down'); else if (up) move('up');
        lastDir = now;
        try { if (window.GTPSfx) GTPSfx.click(); } catch (e) {}
      } else if (!anyDir) {
        lastDir = 0;
      }

      // A (0) activate, B (1) back — edge triggered. No Konami suppression is
      // needed any more since the code is only entered on the pad.
      var key = p;
      var st = prevBtn[key] || {};
      var a = aBtn, b = bBtn;
      var modalOpen = !!document.querySelector('.overlay.show');
      if (a && !st.a) { signalFirstInput(); activate(); }
      if (b && !st.b) { signalFirstInput(); back(); }
      // X (2) / Y (3): on the OG blade these are HELP / SYSTEM (as the UI shows);
      // otherwise Y goes home. Never hijack them while a modal is open.
      var x = pressed(gp, 2);
      var y = pressed(gp, 3);
      var ogDash = document.body.classList.contains('og-theme') && document.getElementById('ogdash');
      if (y && !st.y && !modalOpen) {
        signalFirstInput();
        var sysBtn = ogDash && document.getElementById('ogSystem');
        if (sysBtn) sysBtn.click();
        else if (!/index\.html$|\/$/.test(location.pathname)) location.href = 'index.html';
      }
      if (x && !st.x && !modalOpen && ogDash) {
        signalFirstInput();
        var helpBtn = document.getElementById('ogHelp');
        if (helpBtn) helpBtn.click();
      }
      prevBtn[key] = { a: a, b: b, y: y, x: x, lb: lbBtn };
    }
    raf = requestAnimationFrame(poll);
  }

  function start() { if (!raf) { connected++; toast('Controller connected'); poll(); } }
  function stop() { connected = Math.max(0, connected - 1); }

  function toast(msg) {
    if (window.GTPEngine && GTPEngine.toast) { try { GTPEngine.toast('\uD83C\uDFAE ' + msg); return; } catch (e) {} }
  }

  window.addEventListener('gamepadconnected', start);
  window.addEventListener('gamepaddisconnected', stop);
  // Some browsers only expose pads after a poll; start if one is already present.
  (function probe() {
    var pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (var i = 0; i < pads.length; i++) if (pads[i]) { start(); return; }
    setTimeout(probe, 1000);
  })();
})();
