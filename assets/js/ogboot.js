/* Passle — OG Xbox boot jingle.

   When OG mode powers on, play the classic Original Xbox boot chime. The audio
   is bundled locally (assets/audio/og-boot.mp3, trimmed to start at the 3s
   mark). Respects the site mute toggle.

   Triggers (wired from index.html):
   - Auto once per session when the OG dashboard loads already in OG mode.
   - Explicitly when OG mode is toggled on or unlocked (a real user gesture, so
     playback is allowed immediately). */
(function () {
  var SRC = 'assets/audio/og-boot.mp3?v=1';
  var VOL = 0.55;
  var SESSION_KEY = 'gtp_ogboot_played';
  var audio = null;
  var armed = false;

  function muted() {
    try { return !!(window.GTPSfx && GTPSfx.muted && GTPSfx.muted()); } catch (e) { return false; }
  }

  function el() {
    if (!audio) { audio = new Audio(SRC); audio.preload = 'auto'; }
    return audio;
  }

  function start() {
    if (muted()) return;
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) {}
    try {
      var a = el();
      a.volume = VOL;
      a.currentTime = 0;
      var p = a.play();
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }

  function stop() {
    if (audio) { try { audio.pause(); audio.currentTime = 0; } catch (e) {} }
  }

  // Autoplay-with-sound needs a user activation. If we already have one (the
  // caller passed {gestured:true} from a click, or the browser reports an
  // active activation) start immediately; otherwise arm a one-shot on the first
  // input — mirrors GTPSfx.themeChime.
  function play(opts) {
    if (muted()) return;
    var active = false;
    try { active = !!(navigator.userActivation && navigator.userActivation.isActive); } catch (e) {}
    if ((opts && opts.gestured) || active) { start(); return; }
    if (armed) return;
    armed = true;
    var evs = ['pointerdown', 'keydown', 'touchstart', 'gtp:gamepad'];
    function go() {
      evs.forEach(function (ev) { window.removeEventListener(ev, go, true); });
      armed = false;
      start();
    }
    evs.forEach(function (ev) { window.addEventListener(ev, go, true); });
  }

  window.PassleOGBoot = { play: play, stop: stop };

  // Auto power-on once per session if this page loaded already in OG mode.
  function auto() {
    if (!document.body || !document.body.classList.contains('og-theme')) return;
    try { if (sessionStorage.getItem(SESSION_KEY)) return; } catch (e) {}
    play();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto);
  else auto();
})();
