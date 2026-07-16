/* Passle — lightweight confetti burst on a correct guess. No dependencies.
   Draws to a full-screen canvas overlay, animates ~2.5s, then cleans up.
   Respects prefers-reduced-motion. Exposed as GTP.confetti(). */
(function () {
  const COLORS = ['#107c10', '#3adb3a', '#9bf59b', '#ffffff', '#5ce65c', '#7fffd4'];
  let running = false;

  function reduced() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
  }

  function burst() {
    if (running || reduced()) return;
    running = true;
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999';
    document.body.appendChild(cv);
    const ctx = cv.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = cv.width = innerWidth * dpr, H = cv.height = innerHeight * dpr;
    ctx.scale(dpr, dpr);
    const w = innerWidth, h = innerHeight;

    const N = Math.min(160, Math.round(w / 8));
    const parts = [];
    for (let i = 0; i < N; i++) {
      parts.push({
        x: w / 2 + (Math.random() - 0.5) * w * 0.25,
        y: h * 0.32 + (Math.random() - 0.5) * 40,
        vx: (Math.random() - 0.5) * 9,
        vy: Math.random() * -9 - 4,
        sz: 5 + Math.random() * 6,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        col: COLORS[(Math.random() * COLORS.length) | 0],
        shape: Math.random() < 0.5 ? 0 : 1,
      });
    }

    const start = performance.now();
    const DUR = 2600;
    function frame(t) {
      const el = t - start;
      ctx.clearRect(0, 0, W, H);
      let alive = 0;
      for (const p of parts) {
        p.vy += 0.22;            // gravity
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        if (p.y < h + 20) alive++;
        const fade = Math.max(0, 1 - el / DUR);
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.col;
        if (p.shape === 0) ctx.fillRect(-p.sz / 2, -p.sz / 2, p.sz, p.sz * 0.6);
        else { ctx.beginPath(); ctx.arc(0, 0, p.sz / 2, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      }
      if (el < DUR && alive > 0) requestAnimationFrame(frame);
      else { try { cv.remove(); } catch (e) {} running = false; }
    }
    requestAnimationFrame(frame);
  }

  window.GTP = window.GTP || {};
  window.GTP.confetti = burst;
})();
