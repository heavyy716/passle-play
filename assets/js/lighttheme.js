/* Passle — light-mode toggle.

   Adds a sun/moon button to the topbar that switches the regular pass between
   the default dark theme and a light theme. Light mode is intentionally scoped
   to the regular game only — it does nothing under OG or Gears themes, and the
   toggle hides itself there (see CSS). State persists in gtp_settings.light and
   is applied on every page via GTPEngine.applyTheme + the early inline script. */
(function () {
  var SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

  function settings() {
    try { return GTPEngine.getSettings(); } catch (e) {
      try { return JSON.parse(localStorage.getItem('gtp_settings')) || {}; } catch (e2) { return {}; }
    }
  }
  function save(s) {
    try { GTPEngine.saveSettings(s); return; } catch (e) {}
    try { localStorage.setItem('gtp_settings', JSON.stringify(s)); } catch (e2) {}
  }
  function apply(s) {
    try { GTPEngine.applyTheme(s); return; } catch (e) {}
    document.body.classList.toggle('light-theme', !s.og && s.theme !== 'gears' && !!s.light);
  }

  function icon(b, isLight) { b.innerHTML = isLight ? MOON : SUN; b.title = isLight ? 'Switch to dark' : 'Switch to light'; }

  function mount() {
    // Game pages have a .topbar; the main dashboard has a .dash-actions cluster
    // instead, so the light toggle can live on the home screen too.
    var bar = document.querySelector('.topbar');
    var dash = false;
    if (!bar) { bar = document.querySelector('.dash-actions'); dash = true; }
    if (!bar || document.getElementById('lightToggle')) return;
    var s = settings();
    var b = document.createElement('button');
    b.id = 'lightToggle';
    b.className = dash ? 'lighttoggle dash-ib indash' : 'lighttoggle';
    b.setAttribute('aria-label', 'Toggle light mode');
    icon(b, !!s.light);
    b.onclick = function () {
      var cur = settings();
      cur.light = !cur.light;
      save(cur);
      apply(cur);
      icon(b, !!cur.light);
      try { if (window.GTPSfx) GTPSfx.click(); } catch (e) {}
    };
    if (dash) {
      var ref = bar.querySelector('.dash-ib');
      bar.insertBefore(b, ref || null);
    } else {
      bar.appendChild(b);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
