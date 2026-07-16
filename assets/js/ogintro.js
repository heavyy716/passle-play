/* Passle — OG mode intro sequence (achievement toast + animated boot).

   When OG mode powers on we want the full "turning on the console" moment:
   first an Achievement Unlocked toast slides in, then an animated boot sequence
   plays full-screen (green particles converge into a glowing orb, a ring flares
   out, and the Passle X mark reveals) in sync with the OG boot chime.

   The animation is original artwork evoking a console power-on — it does not use
   any copyrighted boot footage. Audio reuses PassleOGBoot (the bundled chime),
   so the site mute toggle is still respected.

   API: PassleOGIntro.play({ gestured:true }) — call from a user gesture so the
   audio is allowed to start immediately. */
(function () {
  var X_PATH = 'M4.102 21.033A11.947 11.947 0 0 0 12 24a11.96 11.96 0 0 0 7.902-2.967c1.877-1.912-4.316-8.709-7.902-11.417-3.582 2.708-9.779 9.505-7.898 11.417zm11.16-14.406c2.5 2.961 7.484 10.313 6.076 12.912A11.942 11.942 0 0 0 24 12.004a11.95 11.95 0 0 0-3.57-8.537s-.027-.02-.082-.024c-.063-.004-.211.031-.607.257-.643.368-1.949 1.542-4.482 4.927zM3.57 3.467A11.952 11.952 0 0 0 0 12.004c0 2.4.705 4.633 1.917 6.505l.056.026c.02 0-1.61-2.735 6.083-12.94-2.532-3.386-3.838-4.56-4.482-4.928-.396-.226-.545-.261-.607-.257a.221.221 0 0 0-.082.024l-.106.028c-.011.049 1.694 2.081 4.888 5.972zM12 3.24l.037.024c.752-.503 4.184-2.712 6.437-3.223A11.947 11.947 0 0 0 12 0a11.94 11.94 0 0 0-6.47 1.898c-.023.005 4.294 1.4 6.433 3.34z';
  var X_SVG = '<svg viewBox="0 0 24 24"><path d="' + X_PATH + '"/></svg>';

  var reduced = false;
  try { reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var running = false;

  function achievement() {
    try { if (window.GTPSfx) GTPSfx.achievement(); } catch (e) {}
    var toast = document.getElementById('achToast');
    if (toast) toast.remove();
    toast = document.createElement('div');
    toast.id = 'achToast';
    toast.className = 'ach-toast';
    toast.innerHTML =
      '<div class="ach-ring"><span class="ach-x">' + X_SVG + '</span></div>' +
      '<div class="ach-body">' +
        '<div class="ach-line"><span class="ach-g">' + X_SVG + ' 100</span>' +
        '<span class="ach-h">Achievement Unlocked</span></div>' +
        '<div class="ach-d">Original Xbox Mode \u2014 Welcome Back</div>' +
      '</div>';
    document.body.appendChild(toast);
    requestAnimationFrame(function () { toast.classList.add('show'); });
    setTimeout(function () { toast.classList.remove('show'); }, 5200);
    setTimeout(function () { if (toast && toast.parentNode) toast.remove(); }, 5900);
  }

  function play(opts) {
    if (running) return;
    running = true;
    achievement();
    // Let the achievement start sliding in, then power on the console.
    setTimeout(function () { boot(opts); }, 620);
  }

  function boot(opts) {
    var ov = document.createElement('div');
    ov.className = 'ogi-overlay';
    ov.innerHTML =
      '<video class="ogi-video" playsinline preload="auto"></video>' +
      '<canvas class="ogi-canvas"></canvas>' +
      '<div class="ogi-center">' +
        '<div class="ogi-orb"></div>' +
        '<div class="ogi-logo">' + X_SVG + '</div>' +
        '<div class="ogi-word">PASSLE<span>OG</span></div>' +
      '</div>' +
      '<div class="ogi-skip">Press any key to skip</div>';
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add('show'); });

    // Prefer the real Xbox boot video if the operator has dropped one into the
    // repo (assets/video/og-boot.mp4 or .webm). Passle ships NO copyrighted
    // footage — if the file is absent or can't play, we fall back to the
    // original animated boot sequence below.
    tryVideo(ov, opts, function (usedVideo) {
      if (!usedVideo) runAnimation(ov, opts);
    });
  }

  var VIDEO_SRCS = ['assets/video/og-boot.mp4', 'assets/video/og-boot.webm'];

  function tryVideo(ov, opts, cb) {
    var vid = ov.querySelector('.ogi-video');
    if (!vid || !vid.canPlayType) { cb(false); return; }
    var settled = false, safety = null;
    function fallback() {
      if (settled) return; settled = true;
      if (safety) clearTimeout(safety);
      try { vid.remove(); } catch (e) {}
      cb(false);
    }
    function use() {
      if (settled) return; settled = true;
      if (safety) clearTimeout(safety);
      ov.classList.add('has-video');
      // Audio comes from the video itself; play with sound unless the site is muted.
      var siteMuted = false;
      try { siteMuted = !!(window.GTPSfx && GTPSfx.muted && GTPSfx.muted()); } catch (e) {}
      vid.muted = siteMuted;
      var pr = vid.play();
      if (pr && pr.catch) pr.catch(function () { vid.muted = true; vid.play().catch(function () {}); });

      var finished = false, guard = null;
      var skipEvs = ['pointerdown', 'keydown', 'gtp:gamepad'];
      function cleanupSkip() { skipEvs.forEach(function (ev) { window.removeEventListener(ev, onSkip, true); }); }
      function endVid() {
        if (finished) return; finished = true;
        if (guard) clearTimeout(guard);
        cleanupSkip();
        try { vid.pause(); } catch (e) {}
        ov.classList.add('fade');
        setTimeout(function () { if (ov.parentNode) ov.remove(); running = false; }, 480);
      }
      function onSkip() { endVid(); }
      vid.addEventListener('ended', endVid);
      var dur = (isFinite(vid.duration) && vid.duration > 0) ? vid.duration : 8;
      guard = setTimeout(endVid, (dur + 1.5) * 1000);
      // Arm skip a beat late so the unlock gesture itself doesn't skip it.
      setTimeout(function () { skipEvs.forEach(function (ev) { window.addEventListener(ev, onSkip, true); }); }, 500);
      cb(true);
    }
    vid.addEventListener('loadeddata', use);

    // Build the list of sources the browser could decode, then try them in
    // order — advancing to the next on a load error (e.g. a 404 for a format
    // that wasn't supplied). Only fall back to the animation once all fail.
    var cands = [];
    for (var i = 0; i < VIDEO_SRCS.length; i++) {
      var mime = /\.webm$/.test(VIDEO_SRCS[i]) ? 'video/webm' : 'video/mp4';
      if (vid.canPlayType(mime)) cands.push(VIDEO_SRCS[i]);
    }
    if (!cands.length) { cb(false); return; }
    var ci = -1;
    function next() {
      if (settled) return;
      ci++;
      if (ci >= cands.length) { fallback(); return; }
      vid.src = cands[ci];
      try { vid.load(); } catch (e) {}
      if (safety) clearTimeout(safety);
      safety = setTimeout(next, 3000);
    }
    vid.addEventListener('error', next, true);
    next();
  }

  function runAnimation(ov, opts) {
    // Audio: reuse the bundled OG boot chime (respects the mute toggle).
    try { if (window.PassleOGBoot) PassleOGBoot.play(opts || { gestured: true }); } catch (e) {}

    var canvas = ov.querySelector('.ogi-canvas');
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, cx = 0, cy = 0;
    function resize() {
      W = ov.clientWidth; H = ov.clientHeight;
      canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = W / 2; cy = H / 2;
    }
    resize();
    window.addEventListener('resize', resize);

    // Particle field converging on the centre.
    var N = reduced ? 0 : Math.min(200, Math.round((W * H) / 9000));
    var parts = [];
    var maxR = Math.max(W, H) * 0.62;
    for (var i = 0; i < N; i++) {
      var ang = Math.random() * Math.PI * 2;
      var r = maxR * (0.55 + Math.random() * 0.6);
      parts.push({
        a: ang, r0: r,
        delay: Math.random() * 0.5,
        speed: 0.7 + Math.random() * 0.6,
        size: 0.8 + Math.random() * 1.8,
        hue: 118 + Math.random() * 18
      });
    }

    var DUR = reduced ? 2.4 : 4.8;
    var CONVERGE = 1.15;   // particles arrive
    var RING_AT = 1.05;    // ring flares
    var REVEAL_AT = 1.25;  // logo reveals
    var FADE_AT = DUR - 0.5;
    var revealed = false, fading = false, done = false;
    var t0 = performance.now();
    var rafId = 0;

    function ease(x) { return 1 - Math.pow(1 - x, 3); }

    function frame(now) {
      var t = (now - t0) / 1000;
      ctx.clearRect(0, 0, W, H);

      // converging particles
      if (N) {
        for (var i = 0; i < parts.length; i++) {
          var p = parts[i];
          var lt = (t - p.delay) / (CONVERGE - p.delay);
          if (lt < 0) lt = 0; if (lt > 1) lt = 1;
          var e = ease(lt);
          var rr = p.r0 * (1 - e);
          var x = cx + Math.cos(p.a) * rr;
          var y = cy + Math.sin(p.a) * rr;
          var alpha = 0.15 + 0.7 * lt;
          if (t > CONVERGE) alpha *= Math.max(0, 1 - (t - CONVERGE) * 2.2);
          ctx.beginPath();
          ctx.arc(x, y, p.size * (0.6 + lt), 0, Math.PI * 2);
          ctx.fillStyle = 'hsla(' + p.hue + ',90%,60%,' + alpha + ')';
          ctx.fill();
        }
      }

      // central glow orb
      var orbT = Math.min(1, Math.max(0, (t - 0.7) / 0.6));
      if (orbT > 0) {
        var orbR = 10 + 120 * ease(orbT);
        var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, orbR);
        g.addColorStop(0, 'rgba(190,255,180,' + (0.9 * orbT) + ')');
        g.addColorStop(0.35, 'rgba(70,220,60,' + (0.55 * orbT) + ')');
        g.addColorStop(1, 'rgba(16,124,16,0)');
        ctx.fillStyle = g;
        ctx.fillRect(cx - orbR, cy - orbR, orbR * 2, orbR * 2);
      }

      // expanding ring flare
      if (t > RING_AT) {
        var rt = Math.min(1, (t - RING_AT) / 1.0);
        var ringR = 40 + ease(rt) * Math.max(W, H) * 0.55;
        var rAlpha = (1 - rt) * 0.85;
        ctx.lineWidth = 3 + (1 - rt) * 6;
        ctx.strokeStyle = 'rgba(150,255,140,' + rAlpha + ')';
        ctx.beginPath();
        ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
        ctx.stroke();
        // brief white flash at ring birth
        if (rt < 0.16) {
          ctx.fillStyle = 'rgba(255,255,255,' + (0.5 * (1 - rt / 0.16)) + ')';
          ctx.fillRect(0, 0, W, H);
        }
      }

      if (!revealed && t >= REVEAL_AT) { revealed = true; ov.classList.add('reveal'); }
      if (!fading && t >= FADE_AT) { fading = true; ov.classList.add('fade'); }

      if (t >= DUR) { finish(); return; }
      rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);

    // Safety timers so the reveal and teardown still happen even if rAF is
    // throttled (e.g. the tab loses focus mid-boot) — the canvas is decorative,
    // but the logo reveal and cleanup must not get stuck.
    var revealTimer = setTimeout(function () {
      if (!revealed) { revealed = true; ov.classList.add('reveal'); }
    }, REVEAL_AT * 1000);
    var finishTimer = setTimeout(function () { finish(); }, DUR * 1000 + 250);

    function finish() {
      if (done) return;
      done = true;
      cancelAnimationFrame(rafId);
      clearTimeout(revealTimer);
      clearTimeout(finishTimer);
      window.removeEventListener('resize', resize);
      cleanupSkip();
      ov.classList.add('fade');
      setTimeout(function () { if (ov.parentNode) ov.remove(); running = false; }, 480);
    }

    // Skip on any input.
    function onSkip() { try { if (window.PassleOGBoot) PassleOGBoot.stop(); } catch (e) {} finish(); }
    var skipEvs = ['pointerdown', 'keydown', 'gtp:gamepad'];
    function armSkip() { skipEvs.forEach(function (ev) { window.addEventListener(ev, onSkip, true); }); }
    function cleanupSkip() { skipEvs.forEach(function (ev) { window.removeEventListener(ev, onSkip, true); }); }
    // Arm slightly late so the very gesture that launched OG mode doesn't skip it.
    setTimeout(armSkip, 400);
  }

  window.PassleOGIntro = { play: play };
})();
