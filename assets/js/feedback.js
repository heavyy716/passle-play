/* Passle — persistent feedback button.
 *
 * Injects a small fixed "Feedback" pill on every page that links straight to the
 * feedback form. One source of truth so the button appears everywhere without
 * editing each page's markup. Excluded from controller/D-pad navigation
 * (data-gp-skip) so it doesn't interfere with the tuned spatial focus.
 */
(function () {
  'use strict';
  var FORM_URL = 'https://forms.cloud.microsoft/r/fxtvshUXp3';

  function build() {
    if (document.getElementById('passle-feedback')) return;
    if (!document.body) return;
    var a = document.createElement('a');
    a.id = 'passle-feedback';
    a.href = FORM_URL;
    a.target = '_blank';
    a.rel = 'noopener';
    a.title = 'Share feedback';
    a.setAttribute('aria-label', 'Share feedback');
    a.setAttribute('data-gp-skip', '');
    a.innerHTML = '<span class="pfb-ic" aria-hidden="true">\uD83D\uDCAC</span>' +
      '<span class="pfb-t">Feedback</span>';
    document.body.appendChild(a);
  }

  if (document.body) build();
  else document.addEventListener('DOMContentLoaded', build);
})();
