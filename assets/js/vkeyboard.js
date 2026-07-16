/* Passle — on-screen virtual keyboard for full controller support.

   When a controller user activates a text field (presses A on it), a themed
   on-screen keyboard docks at the bottom. The D-pad / stick navigate the keys
   (gamepad.js scopes focus to the panel), A types, and the panel edits the
   bound field, dispatching real `input` events so autocomplete/guess logic
   reacts exactly as if the user had typed. GO submits (picks the top match on
   guess screens); B or Close dismisses it.

   Mouse/keyboard users never see it — it only opens on a controller A-press, so
   native typing is untouched. */
(function () {
  var target = null;      // the bound <input>/<textarea>
  var panel = null;

  var ROWS = ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

  function build() {
    if (panel) return;
    panel = document.createElement('div');
    panel.className = 'vkbd';
    panel.setAttribute('role', 'group');
    panel.setAttribute('aria-label', 'On-screen keyboard');
    var html = '<div class="vkbd-inner">';
    html += '<div class="vkbd-suggest" role="listbox" aria-label="Suggested titles"></div>';
    html += '<div class="vkbd-head"><span class="vkbd-title">KEYBOARD</span>' +
      '<button class="vkbd-key vkbd-x" data-act="close" aria-label="Close">\u2715</button></div>';
    ROWS.forEach(function (row) {
      html += '<div class="vkbd-row">';
      for (var i = 0; i < row.length; i++) {
        var c = row[i];
        html += '<button class="vkbd-key" data-ch="' + c + '">' + c.toUpperCase() + '</button>';
      }
      html += '</div>';
    });
    html += '<div class="vkbd-row vkbd-actions">' +
      '<button class="vkbd-key vkbd-wide" data-act="space">SPACE</button>' +
      '<button class="vkbd-key" data-act="back" aria-label="Backspace">\u232B</button>' +
      '<button class="vkbd-key" data-act="clear">CLEAR</button>' +
      '<button class="vkbd-key vkbd-go" data-act="go">GO</button>' +
      '</div>';
    html += '</div>';
    panel.innerHTML = html;
    document.body.appendChild(panel);

    panel.addEventListener('mousedown', function (e) { e.preventDefault(); }); // keep field's context; don't steal focus on click
    panel.querySelectorAll('.vkbd-key').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.dataset.ch != null) insert(b.dataset.ch);
        else act(b.dataset.act);
        try { if (window.GTPSfx) GTPSfx.click(); } catch (e) {}
      });
    });
  }

  function fireInput() {
    if (!target) return;
    try { target.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
    syncSuggest();
  }

  // Mirror the page's own autocomplete list (#ac) into a strip along the top of
  // the keyboard, so controller users can still SEE the candidate titles the
  // keyboard would otherwise cover — and pick one directly (D-pad up to the
  // strip, A to choose). Each mirrored button clicks the real #ac row, so the
  // exact same guess is submitted through the engine.
  function pageAC() { return document.getElementById('ac'); }
  function syncSuggest() {
    if (!panel) return;
    var strip = panel.querySelector('.vkbd-suggest');
    if (!strip) return;
    var ac = pageAC();
    var kids = (ac && ac.classList.contains('show')) ? Array.prototype.slice.call(ac.children) : [];
    if (!kids.length) { strip.innerHTML = ''; strip.classList.remove('has'); return; }
    strip.innerHTML = kids.map(function (c, i) {
      return '<button class="vkbd-key vkbd-sug" data-i="' + i + '">' + c.innerHTML + '</button>';
    }).join('');
    strip.classList.add('has');
    Array.prototype.forEach.call(strip.children, function (b) {
      b.addEventListener('mousedown', function (e) { e.preventDefault(); });
      b.addEventListener('click', function () {
        var real = pageAC();
        var rc = real && real.children[+b.dataset.i];
        if (rc) rc.click();                         // submits via engine's onclick
        try { if (window.GTPSfx) GTPSfx.click(); } catch (e) {}
        // Field usually clears after a guess; keep the keyboard up and refresh.
        setTimeout(function () { if (!target || !isTypeable(target)) close(); else syncSuggest(); }, 60);
      });
    });
  }
  function insert(ch) {
    if (!target) return;
    target.value = (target.value || '') + ch;
    fireInput();
  }
  function act(a) {
    if (!target) return;
    if (a === 'space') { insert(' '); return; }
    if (a === 'back') { target.value = (target.value || '').slice(0, -1); fireInput(); return; }
    if (a === 'clear') { target.value = ''; fireInput(); return; }
    if (a === 'close') { close(); return; }
    if (a === 'go') {
      // Pick the top autocomplete match (ArrowDown selects it) then submit.
      // On plain fields with no such handlers this is a harmless no-op.
      try {
        target.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      } catch (e) {}
      // Keep the keyboard up for the next guess; if the field was removed/hidden
      // (e.g. the round ended) drop it, otherwise refresh the suggestion strip.
      setTimeout(function () { if (!target || !isTypeable(target)) close(); else syncSuggest(); }, 60);
    }
  }

  function isTypeable(el) {
    if (!el || el.disabled || el.readOnly) return false;
    if (el.offsetParent === null) return false;
    var t = el.tagName;
    if (t === 'TEXTAREA') return true;
    if (t !== 'INPUT') return false;
    return /^(text|search|email|url|tel|password|)$/i.test(el.type || 'text');
  }

  function firstKey() { return panel && panel.querySelector('.vkbd-key[data-ch]'); }

  function open(input) {
    if (!isTypeable(input)) return;
    build();
    target = input;
    panel.classList.add('open');
    document.body.classList.add('vkbd-open');
    syncSuggest();
    // Move gamepad focus into the keyboard so the D-pad drives the keys.
    var k = firstKey();
    if (k) { try { k.focus(); } catch (e) {} }
  }
  function close() {
    if (!panel) return;
    panel.classList.remove('open');
    document.body.classList.remove('vkbd-open');
    var t = target;
    target = null;
    if (t && isTypeable(t)) { try { t.focus(); } catch (e) {} }
  }
  function isOpen() { return !!(panel && panel.classList.contains('open')); }
  function root() { return isOpen() ? panel : null; }

  window.PassleVKbd = { open: open, close: close, isOpen: isOpen, root: root };
})();
