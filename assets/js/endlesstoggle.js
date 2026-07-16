/* Passle — Daily / Endless mode toggle.

   The global Daily vs Endless choice used to be buried in the index settings
   panel, so players rarely found Endless. This puts a clear segmented toggle on
   the topbar of every screen. Flipping it updates gtp_settings.daily and reloads
   so the active game (and the menu) rebuild in the chosen mode — meaning a replay
   naturally drops you into an endless loop instead of the fixed daily round. */
(function () {
  function settings() {
    try { return GTPEngine.getSettings(); } catch (e) {
      try { return JSON.parse(localStorage.getItem('gtp_settings')) || {}; } catch (e2) { return {}; }
    }
  }
  function save(s) {
    try { GTPEngine.saveSettings(s); return; } catch (e) {}
    try { localStorage.setItem('gtp_settings', JSON.stringify(s)); } catch (e2) {}
  }

  function paint(seg, isDaily) {
    var d = seg.querySelector('[data-daily="true"]');
    var e = seg.querySelector('[data-daily="false"]');
    if (d) d.classList.toggle('on', isDaily);
    if (e) e.classList.toggle('on', !isDaily);
  }

  function choose(daily) {
    var s = settings();
    if (!!s.daily === daily) return;      // no change
    s.daily = daily;
    save(s);
    try { if (window.GTPSfx) GTPSfx.click(); } catch (e) {}
    // Rebuild the page in the new mode (restores daily progress, or starts a
    // fresh endless run). Keeps the engine, trivia and menu all consistent.
    location.reload();
  }

  function mount() {
    // Game pages carry a .topbar; the home dashboard uses a .dash-actions
    // cluster instead. Surface the Daily/Endless toggle on both so Endless is
    // reachable straight from the main screen.
    var bar = document.querySelector('.topbar');
    var dash = false;
    if (!bar) { bar = document.querySelector('.dash-actions'); dash = true; }
    if (!bar || document.getElementById('modeSeg')) return;
    var isDaily = !!settings().daily;
    var seg = document.createElement('div');
    seg.id = 'modeSeg';
    seg.className = dash ? 'modeseg indash' : 'modeseg';
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-label', 'Daily or Endless mode');
    seg.innerHTML =
      '<button type="button" data-daily="true"><span class="mseg-ic">\uD83D\uDCC5</span><span class="mseg-tx">Daily</span></button>' +
      '<button type="button" data-daily="false"><span class="mseg-ic">\u267E\uFE0F</span><span class="mseg-tx">Endless</span></button>';
    paint(seg, isDaily);
    seg.querySelector('[data-daily="true"]').onclick = function () { choose(true); };
    seg.querySelector('[data-daily="false"]').onclick = function () { choose(false); };
    if (dash) bar.insertBefore(seg, bar.firstChild);
    else bar.appendChild(seg);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
