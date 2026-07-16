/* Passle access gate — lightweight passphrase overlay.
 *
 * NOTE: this is a DETERRENT, not real security. Passle is a static site, so the
 * game data is still fetchable directly and a determined visitor can bypass any
 * client-side check. The gate exists to stop casual/accidental use of the
 * unlisted public build. For real access control use Cloudflare Access or an
 * authenticated host (Azure Static Web Apps + Entra).
 *
 * The passphrase is never stored in plaintext — only a salted SHA-256 hash is
 * embedded below. To change it, recompute:
 *   sha256("passle-gate-v1:" + <new passphrase>)
 * and replace HASH.
 */
(function () {
  'use strict';
  var SALT = 'passle-gate-v1:';
  var HASH = 'bcf7aff9b281712412073db87ef8e29db2080d42d1512b9ead4997318d042d93';
  var KEY = 'passle_gate_ok_v1';

  // Already unlocked this session/device? Skip the gate.
  try {
    if (localStorage.getItem(KEY) === HASH) return;
  } catch (e) { /* storage blocked — show the gate anyway */ }

  // Hide the page until unlocked (covers the flash before body exists).
  var hide = document.createElement('style');
  hide.setAttribute('data-passle-gate', '');
  hide.textContent = 'html.passle-locked body{visibility:hidden!important}' +
    '#passle-gate,#passle-gate *{visibility:visible!important}';
  (document.head || document.documentElement).appendChild(hide);
  document.documentElement.className += ' passle-locked';

  function sha256Hex(str) {
    var enc = new TextEncoder().encode(str);
    return crypto.subtle.digest('SHA-256', enc).then(function (buf) {
      var b = new Uint8Array(buf), h = '';
      for (var i = 0; i < b.length; i++) h += b[i].toString(16).padStart(2, '0');
      return h;
    });
  }

  function unlock() {
    try { localStorage.setItem(KEY, HASH); } catch (e) {}
    document.documentElement.className =
      document.documentElement.className.replace(/\bpassle-locked\b/, '').trim();
    var o = document.getElementById('passle-gate');
    if (o) o.parentNode.removeChild(o);
  }

  function build() {
    if (document.getElementById('passle-gate')) return;
    var o = document.createElement('div');
    o.id = 'passle-gate';
    o.setAttribute('style', [
      'position:fixed', 'inset:0', 'z-index:2147483647',
      'display:flex', 'align-items:center', 'justify-content:center',
      'background:#0b0f0b',
      'font-family:"Segoe UI",system-ui,sans-serif'
    ].join(';'));
    o.innerHTML =
      '<form id="passle-gate-form" autocomplete="off" style="width:min(340px,86vw);text-align:center;color:#e8ffe8">' +
        '<div style="font-size:44px;line-height:1;margin-bottom:14px">\uD83C\uDFAE</div>' +
        '<h1 style="font:600 22px/1.2 \'Segoe UI\',system-ui;margin:0 0 6px;color:#fff">Passle</h1>' +
        '<p style="margin:0 0 18px;color:#8fb98f;font-size:14px">Enter the passphrase to play.</p>' +
        '<input id="passle-gate-input" type="password" inputmode="text" autofocus ' +
          'placeholder="Passphrase" ' +
          'style="width:100%;box-sizing:border-box;padding:12px 14px;border-radius:10px;border:1px solid #1f5c1f;' +
          'background:#0f160f;color:#fff;font-size:16px;outline:none">' +
        '<div id="passle-gate-err" style="height:18px;margin:8px 0 0;color:#ff6b6b;font-size:13px"></div>' +
        '<button type="submit" ' +
          'style="margin-top:10px;width:100%;padding:12px 14px;border:0;border-radius:10px;cursor:pointer;' +
          'background:#107C10;color:#fff;font-size:16px;font-weight:600">Enter</button>' +
      '</form>';
    // Append to <html>, NOT <body> — body is visibility:hidden while locked,
    // and visibility inherits, so a body-child overlay would be invisible too.
    document.documentElement.appendChild(o);

    var form = o.querySelector('#passle-gate-form');
    var input = o.querySelector('#passle-gate-input');
    var err = o.querySelector('#passle-gate-err');
    input.focus();
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      err.textContent = '';
      sha256Hex(SALT + input.value).then(function (h) {
        if (h === HASH) { unlock(); }
        else {
          err.textContent = 'Nope. Try again.';
          input.value = '';
          input.focus();
        }
      }).catch(function () { err.textContent = 'Gate error — reload.'; });
    });
  }

  if (document.body) build();
  else document.addEventListener('DOMContentLoaded', build);
})();
