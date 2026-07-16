/* Passle — secret OG-mode unlock.
   Click the Xbox logo next to the title to open a mini Xbox controller, then
   enter the Konami code (Up Up Down Down Left Right Left Right B A) with the
   on-screen buttons or your arrow keys. On success an Xbox-style achievement
   pops with a chime and OG mode unlocks. */
(function () {
  const UNLOCK_KEY = 'gtp_og_unlocked';
  // Classic Konami code. X / Y / Guide are flavor-only (don't affect it).
  const SEQ = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a'];
  const GLYPH = {
    up: ['\u25B2', 'dir'], down: ['\u25BC', 'dir'], left: ['\u25C0', 'dir'], right: ['\u25B6', 'dir'],
    a: ['A', 'a'], b: ['B', 'b'],
  };

  function unlocked() { return localStorage.getItem(UNLOCK_KEY) === '1'; }
  function setUnlocked() { try { localStorage.setItem(UNLOCK_KEY, '1'); } catch (e) {} }

  let overlay = null, inputsEl = null, progress = 0, keyHandler = null;

  const XLOGO = '<svg viewBox="0 0 24 24"><path d="M4.102 21.033A11.947 11.947 0 0 0 12 24a11.96 11.96 0 0 0 7.902-2.967c1.877-1.912-4.316-8.709-7.902-11.417-3.582 2.708-9.779 9.505-7.898 11.417zm11.16-14.406c2.5 2.961 7.484 10.313 6.076 12.912A11.942 11.942 0 0 0 24 12.004a11.95 11.95 0 0 0-3.57-8.537s-.027-.02-.082-.024c-.063-.004-.211.031-.607.257-.643.368-1.949 1.542-4.482 4.927zM3.57 3.467A11.952 11.952 0 0 0 0 12.004c0 2.4.705 4.633 1.917 6.505l.056.026c.02 0-1.61-2.735 6.083-12.94-2.532-3.386-3.838-4.56-4.482-4.928-.396-.226-.545-.261-.607-.257a.221.221 0 0 0-.082.024l-.106.028c-.011.049 1.694 2.081 4.888 5.972zM12 3.24l.037.024c.752-.503 4.184-2.712 6.437-3.223A11.947 11.947 0 0 0 12 0a11.94 11.94 0 0 0-6.47 1.898c-.023.005 4.294 1.4 6.433 3.34z"/></svg>';

  function buildOverlay() {
    overlay = document.createElement('div');
    overlay.className = 'konami-overlay';
    overlay.id = 'konamiOverlay';
    overlay.innerHTML =
      '<div class="konami-panel" role="dialog" aria-label="Secret code">' +
        '<button class="konami-close" title="Close">&times;</button>' +
        '<div class="konami-head"><span class="konami-x">' + XLOGO + '</span>' +
          '<div><div class="konami-title">SECRET INPUT</div>' +
          '<div class="konami-sub">Enter the code&hellip;</div></div></div>' +
        '<div class="konami-inputs" id="konamiInputs"></div>' +
        '<div class="mini-pad">' +
          '<div class="dpad">' +
            '<button class="dbtn up" data-in="up" aria-label="Up">\u25B2</button>' +
            '<button class="dbtn left" data-in="left" aria-label="Left">\u25C0</button>' +
            '<span class="dhub"></span>' +
            '<button class="dbtn right" data-in="right" aria-label="Right">\u25B6</button>' +
            '<button class="dbtn down" data-in="down" aria-label="Down">\u25BC</button>' +
          '</div>' +
          '<button class="pad-guide" data-in="guide" aria-label="Guide">' + XLOGO + '</button>' +
          '<div class="face">' +
            '<button class="fbtn fy" data-in="y" aria-label="Y">Y</button>' +
            '<button class="fbtn fx" data-in="x" aria-label="X">X</button>' +
            '<button class="fbtn fb" data-in="b" aria-label="B">B</button>' +
            '<button class="fbtn fa" data-in="a" aria-label="A">A</button>' +
          '</div>' +
        '</div>' +
        '<div class="konami-hint">Use the pad or your <b>arrow keys</b> + <b>A</b> / <b>B</b>.</div>' +
      '</div>';
    document.body.appendChild(overlay);
    inputsEl = overlay.querySelector('#konamiInputs');

    overlay.querySelector('.konami-close').onclick = close;
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    overlay.querySelectorAll('.mini-pad button').forEach(function (b) {
      b.addEventListener('click', function () {
        pressAnim(b);
        push(b.dataset.in);
      });
    });
    renderInputs();
  }

  function pressAnim(btn) {
    btn.classList.remove('pressed');
    // force reflow so the animation retriggers on rapid taps
    void btn.offsetWidth;
    btn.classList.add('pressed');
    try { if (window.GTPSfx) GTPSfx.click(); } catch (e) {}
    setTimeout(function () { btn.classList.remove('pressed'); }, 180);
  }

  function renderInputs() {
    if (!inputsEl) return;
    let html = '';
    for (let i = 0; i < SEQ.length; i++) {
      const g = GLYPH[SEQ[i]];
      const filled = i < progress;
      html += '<span class="kin ' + g[1] + (filled ? ' lit' : '') + '">' +
        (filled ? g[0] : '') + '</span>';
    }
    inputsEl.innerHTML = html;
  }

  function push(input) {
    // Flavor buttons: animate + beep only, no effect on the sequence.
    if (input === 'x' || input === 'y' || input === 'guide') return;
    if (input === SEQ[progress]) {
      progress++;
      renderInputs();
      if (progress === SEQ.length) { success(); }
    } else {
      // forgiving restart: if this input is a valid opener, count it
      progress = (input === SEQ[0]) ? 1 : 0;
      renderInputs();
      if (progress === 0) shake();
    }
  }

  function shake() {
    if (!inputsEl) return;
    inputsEl.classList.remove('bad');
    void inputsEl.offsetWidth;
    inputsEl.classList.add('bad');
  }

  function success() {
    const panel = overlay.querySelector('.konami-panel');
    if (panel) panel.classList.add('win');
    setUnlocked();
    setTimeout(function () {
      close();
      celebrate();
      window.dispatchEvent(new CustomEvent('gtp:og-unlock'));
    }, 620);
  }

  // ---- Xbox-style achievement toast ----
  function celebrate() {
    try { if (window.GTPSfx) GTPSfx.achievement(); } catch (e) {}
    let toast = document.getElementById('achToast');
    if (toast) toast.remove();
    toast = document.createElement('div');
    toast.id = 'achToast';
    toast.className = 'ach-toast';
    toast.innerHTML =
      '<div class="ach-ring"><span class="ach-x">' + XLOGO + '</span></div>' +
      '<div class="ach-body">' +
        '<div class="ach-line"><span class="ach-g">' + XLOGO + ' 50</span>' +
        '<span class="ach-h">Achievement Unlocked</span></div>' +
        '<div class="ach-d">Welcome to OG Mode!</div>' +
      '</div>';
    document.body.appendChild(toast);
    // trigger slide-in
    requestAnimationFrame(function () { toast.classList.add('show'); });
    setTimeout(function () { toast.classList.remove('show'); }, 5200);
    setTimeout(function () { if (toast && toast.parentNode) toast.remove(); }, 5900);
  }

  function open() {
    if (!overlay) buildOverlay();
    progress = 0;
    renderInputs();
    overlay.classList.add('show');
    keyHandler = function (e) {
      const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
        KeyA: 'a', KeyB: 'b', KeyX: 'x', KeyY: 'y' };
      const input = map[e.code];
      if (!input) { if (e.key === 'Escape') close(); return; }
      e.preventDefault();
      const btn = overlay.querySelector('[data-in="' + input + '"]');
      if (btn) pressAnim(btn);
      push(input);
    };
    document.addEventListener('keydown', keyHandler);
    startPad();
  }

  // ---- Direct gamepad input while the code pad is open ----
  // gamepad.js yields to us (it skips its focus-nav while .konami-overlay.show
  // exists), so here the D-pad enters directions and A/B enter the face inputs
  // exactly like the arrow keys — the natural way to punch in the code.
  let padRaf = null, padPrev = {};
  function bp(gp, i) { return !!(gp.buttons[i] && gp.buttons[i].pressed); }
  function fire(input) {
    const btn = overlay && overlay.querySelector('[data-in="' + input + '"]');
    if (btn) pressAnim(btn);
    push(input);
  }
  function padPoll() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let p = 0; p < pads.length; p++) {
      const gp = pads[p];
      if (!gp) continue;
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0, D = 0.55;
      const st = {
        up: bp(gp, 12) || ay < -D, down: bp(gp, 13) || ay > D,
        left: bp(gp, 14) || ax < -D, right: bp(gp, 15) || ax > D,
        a: bp(gp, 0), b: bp(gp, 1), x: bp(gp, 2), y: bp(gp, 3),
      };
      const prev = padPrev[p] || {};
      ['up', 'down', 'left', 'right', 'a', 'b', 'x', 'y'].forEach(function (k) {
        if (st[k] && !prev[k]) fire(k);   // edge-triggered: one tap = one input
      });
      padPrev[p] = st;
    }
    padRaf = requestAnimationFrame(padPoll);
  }
  function startPad() {
    if (padRaf || !navigator.getGamepads) return;
    padPrev = {};
    padRaf = requestAnimationFrame(padPoll);
  }
  function stopPad() {
    if (padRaf) { cancelAnimationFrame(padRaf); padRaf = null; }
    padPrev = {};
  }

  function close() {
    if (!overlay) return;
    overlay.classList.remove('show');
    const panel = overlay.querySelector('.konami-panel');
    if (panel) panel.classList.remove('win');
    if (keyHandler) { document.removeEventListener('keydown', keyHandler); keyHandler = null; }
    stopPad();
  }

  window.GTPKonami = { open: open, unlocked: unlocked, celebrate: celebrate, unlockDirect: unlockDirect };

  // Unlock OG mode straight away (no code pad) — used by the controller's
  // global Konami detector. Idempotent: does nothing if already unlocked.
  function unlockDirect() {
    if (unlocked()) return;
    setUnlocked();
    celebrate();
    try { window.dispatchEvent(new CustomEvent('gtp:og-unlock')); } catch (e) {}
  }

  // Wire the secret trigger (the Xbox logo button next to the title).
  function mount() {
    const trig = document.getElementById('ogSecret');
    if (trig) trig.addEventListener('click', open);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
