/* Passle — soft-touch local profile (display name + avatar).
   No login, no server: stored in localStorage on this device only.
   Avatars are classic Xbox 360 dashboard gamerpics (Microsoft first-party
   art), bundled locally under assets/img/avatars/. */
(function () {
  const KEY = 'gtp_profile';
  const IMG = 'assets/img/avatars/';

  // Curated classic Xbox 360 dashboard gamerpics (filename ids).
  const AV_ORDER = [
    '20000', '20001', '20003', '20004', '20005', '20006', '20007', '20008',
    '20009', '21016', '21030', '21024', '21025', '21026', '21027', '21028',
    '21029', '21034', '20002', '8000',
  ];
  const DEFAULT_AV = '20003';

  const COLORS = ['#107C10', '#0e7ec8', '#e07b00', '#c81e2b', '#7a3ff2', '#0aa89e', '#d63b8a', '#c9a800'];

  function isValid(id) { return AV_ORDER.indexOf(id) !== -1; }
  function imgHtml(id) {
    const src = IMG + (isValid(id) ? id : DEFAULT_AV) + '.png';
    return '<img src="' + src + '" alt="" draggable="false">';
  }

  const Profile = {
    get() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; } },
    save(p) { localStorage.setItem(KEY, JSON.stringify(p)); },
    current() {
      const p = this.get() || {};
      return {
        name: p.name || 'Player',
        avatar: isValid(p.avatar) ? p.avatar : DEFAULT_AV,
        color: p.color || COLORS[0],
        share: !!p.share,
      };
    },
    name() { const p = this.get(); return p && p.name ? p.name : ''; },
    share() { const p = this.get(); return !!(p && p.share); },
    img: imgHtml,
  };
  window.GTPProfile = Profile;
  Profile.edit = function () { openModal(); };

  // ---- header chip ----
  function tileHtml(p, cls) {
    return '<span class="pavatar ' + (cls || '') + '" style="border-color:' + p.color + '">' + imgHtml(p.avatar) + '</span>';
  }
  function mountChip() {
    const bar = document.querySelector('.topbar');
    if (!bar || document.getElementById('profileChip')) return;
    const p = Profile.current();
    const btn = document.createElement('button');
    btn.id = 'profileChip';
    btn.className = 'profilechip';
    btn.title = 'Your profile';
    btn.innerHTML = tileHtml(p) + '<span class="pname">' + esc(p.name) + '</span>';
    btn.onclick = openModal;
    bar.appendChild(btn);
  }
  function refreshChip() {
    const chip = document.getElementById('profileChip');
    if (!chip) return;
    const p = Profile.current();
    chip.innerHTML = tileHtml(p) + '<span class="pname">' + esc(p.name) + '</span>';
  }

  // ---- editor modal ----
  let sel = { avatar: DEFAULT_AV, color: COLORS[0] };
  function openModal() {
    const p = Profile.current();
    sel = { avatar: p.avatar, color: p.color };
    let ov = document.getElementById('profileOverlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'profileOverlay';
      ov.className = 'overlay';
      ov.innerHTML =
        '<div class="modal">' +
        '<h2>&#127918; Your Profile</h2>' +
        '<div class="small" style="margin-bottom:6px">Display name</div>' +
        '<input id="pgName" class="pgtag" maxlength="20" placeholder="Enter a display name" autocomplete="off" spellcheck="false">' +
        '<label class="pgshare"><input type="checkbox" id="pgShare"> ' +
        'Show my name on the shared leaderboard' +
        '<span class="small pgshare-note">If on, your Passle name is visible to everyone playing this hosted Passle. Leave off to appear as \u201cAnonymous.\u201d</span>' +
        '</label>' +
        '<div class="small" style="margin:14px 0 6px">Gamerpic</div>' +
        '<div class="avatargrid" id="pgAvatars"></div>' +
        '<div class="small" style="margin:14px 0 6px">Ring color</div>' +
        '<div class="colorgrid" id="pgColors"></div>' +
        '<div class="btnrow" style="margin-top:18px">' +
        '<button class="btn primary" id="pgSave">Save</button>' +
        '<button class="btn" id="pgCancel">Cancel</button>' +
        '</div></div>';
      document.body.appendChild(ov);
      ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('show'); });
    }
    ov.querySelector('#pgName').value = p.name === 'Player' && !Profile.get() ? '' : p.name;
    ov.querySelector('#pgShare').checked = !!p.share;
    renderAvatars(); renderColors();
    ov.querySelector('#pgSave').onclick = doSave;
    ov.querySelector('#pgCancel').onclick = () => ov.classList.remove('show');
    ov.classList.add('show');
    setTimeout(() => { try { ov.querySelector('#pgName').focus(); } catch (e) {} }, 30);
  }
  function renderAvatars() {
    const box = document.getElementById('pgAvatars');
    box.innerHTML = AV_ORDER.map(id =>
      '<button class="avatartile' + (id === sel.avatar ? ' sel' : '') + '" data-id="' + id + '" ' +
      'style="border-color:' + (id === sel.avatar ? sel.color : 'transparent') + '">' + imgHtml(id) + '</button>').join('');
    box.querySelectorAll('.avatartile').forEach(b => b.onclick = () => { sel.avatar = b.dataset.id; renderAvatars(); });
  }
  function renderColors() {
    const box = document.getElementById('pgColors');
    box.innerHTML = COLORS.map(c =>
      '<button class="colordot' + (c === sel.color ? ' sel' : '') + '" data-c="' + c + '" ' +
      'style="background:' + c + '"></button>').join('');
    box.querySelectorAll('.colordot').forEach(b => b.onclick = () => { sel.color = b.dataset.c; renderColors(); renderAvatars(); });
  }
  function doSave() {
    const nameEl = document.getElementById('pgName');
    const name = (nameEl.value || '').trim().slice(0, 20) || 'Player';
    const share = !!document.getElementById('pgShare').checked;
    Profile.save({ name: name, avatar: sel.avatar, color: sel.color, share: share });
    refreshChip();
    try { document.dispatchEvent(new Event('gtp:profilechange')); } catch (e) {}
    try { if (window.GTPLeaderboard) GTPLeaderboard.submit(true); } catch (e) {}
    document.getElementById('profileOverlay').classList.remove('show');
  }

  function esc(s) { return (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  function init() {
    mountChip();
    if (!Profile.get()) openModal(); // soft prompt on first visit
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
