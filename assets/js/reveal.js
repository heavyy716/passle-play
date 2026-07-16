/* Passle — round-complete rich reveal (description, genre, ratings, store/cloud
   links, and a morph modal with the Xbox store trailer). */
(function () {
  const STORE = 'https://www.xbox.com/en-US/games/store/-/';
  const CLOUD = 'https://www.xbox.com/play/games/-/';
  let _dashP = null;

  function esc(s) {
    return (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function storeUrl(g) { return (g && g.id && !g.og) ? STORE + encodeURIComponent(g.id) : null; }
  function cloudUrl(g) { return (g && g.id && !g.og && g.tiers && g.tiers.ultimate) ? CLOUD + encodeURIComponent(g.id) : null; }
  function genres(g) {
    const c = (g.categories && g.categories.length ? g.categories : (g.category ? [g.category] : []));
    return c.slice(0, 3);
  }
  function poster(g) {
    return (g.images && (g.images.hero || g.images.boxart || g.images.poster)) || g.trailerPoster || '';
  }
  // The "game square" — the box art, shown next to the description on reveal.
  function boxImg(g) {
    return (g.images && (g.images.boxart || g.images.poster || g.images.hero)) || g.trailerPoster || '';
  }

  function stars(r) {
    if (!r) return '';
    const full = Math.floor(r), half = (r - full) >= 0.5;
    let s = '';
    for (let i = 0; i < 5; i++) s += (i < full) ? '\u2605' : (i === full && half ? '\u2605' : '\u2606');
    return s;
  }

  // Ratings row: store rating, metacritic (if enriched), ESRB.
  function ratingsRow(g, full) {
    const bits = [];
    if (g.rating) {
      bits.push('<span class="rv-rate" title="Microsoft Store rating">' +
        '<span class="rv-stars">' + stars(g.rating) + '</span> ' +
        g.rating.toFixed(1) + (g.ratingCount ? ' <span class="rv-cnt">(' + g.ratingCount.toLocaleString() + ')</span>' : '') +
        '</span>');
    }
    if (g.metacritic) {
      const cls = g.metacritic >= 75 ? 'good' : (g.metacritic >= 50 ? 'mid' : 'bad');
      bits.push('<span class="rv-mc ' + cls + '" title="Metacritic">MC ' + g.metacritic + '</span>');
    } else if (full) {
      bits.push('<span class="rv-mc wip" title="Metacritic scores coming soon">MC \u2014 WIP</span>');
    }
    if (g.esrb) {
      bits.push('<span class="rv-esrb"' + (g.esrbLogo ? ' style="background-image:url(\'' + g.esrbLogo + '\')"' : '') + '>' +
        (g.esrbLogo ? '' : esc(g.esrb)) + '</span>');
    }
    return bits.length ? '<div class="rv-ratings">' + bits.join('') + '</div>' : '';
  }

  function chips(g) {
    const gs = genres(g);
    return gs.length ? '<div class="rv-chips">' + gs.map(c => '<span class="rv-chip">' + esc(c) + '</span>').join('') + '</div>' : '';
  }

  // Partner / perk highlights — shown separately from the core plan tiers because
  // EA Play, Ubisoft+ Classics and free-to-play perks are NOT Game Pass plans.
  function servicesRow(g) {
    const s = g.services || {};
    const out = [];
    if (s.eaplay) out.push('<span class="svc-chip ea" title="Included via EA Play">\uD83C\uDFAE EA Play</span>');
    if (s.ubisoft) out.push('<span class="svc-chip ubi" title="Included via Ubisoft+ Classics (Ultimate)">\uD83D\uDD37 Ubisoft+ Classics</span>');
    if (s.free) out.push('<span class="svc-chip free" title="Free-to-play \u2014 Game Pass adds perks">\uD83D\uDD79\uFE0F Free to Play</span>');
    if (g.onPC) out.push('<span class="svc-chip pc" title="Also available on PC Game Pass">\uD83D\uDDA5\uFE0F Also on PC</span>');
    return out.length ? '<div class="rv-svcs">' + out.join('') + '</div>' : '';
  }

  function links(g, primary) {
    const su = storeUrl(g), cu = cloudUrl(g);
    let h = '';
    if (g && g.og) {
      // Original Xbox classics are delisted; point players at the backward-
      // compatibility hub instead of a (dead) store page.
      h += '<a class="btn' + (primary ? ' primary' : '') + '" href="https://www.xbox.com/en-US/games/backward-compatibility" ' +
        'target="_blank" rel="noopener">\uD83D\uDD79\uFE0F Backward compat</a>';
      return h;
    }
    if (su) h += '<a class="btn' + (primary ? ' primary' : '') + '" href="' + su +     '" target="_blank" rel="noopener">\uD83D\uDED2 Get on XBOX</a>';
    if (cu) h += '<a class="btn" href="' + cu + '" target="_blank" rel="noopener">\u2601\uFE0F Play in cloud</a>';
    return h;
  }

  // Inline block appended to the result card.
  function card(g) {
    const desc = g.shortDesc || g.longDesc || '';
    const hasTrailer = !!g.trailer;
    const bv = boxImg(g);
    return '<div class="reveal">' +
      (bv ? '<div class="rv-thumb' + (hasTrailer ? ' has-trailer' : '') + '">' +
        '<img src="' + bv + '" alt="" loading="lazy">' +
        (hasTrailer ? '<span class="rv-play">\u25B6</span>' : '') + '</div>' : '') +
      '<div class="rv-info">' +
      ratingsRow(g) + chips(g) + servicesRow(g) +
      (desc ? '<p class="rv-desc">' + esc(desc.length > 240 ? desc.slice(0, 237) + '\u2026' : desc) + '</p>' : '') +
      '<div class="rv-links">' + links(g, false) +
      '<button class="btn rv-more" type="button">' + (hasTrailer ? '\u25B6 Trailer & details' : '\u2139\uFE0F Details') + '</button>' +
      '</div></div></div>';
  }

  // Insert the reveal block into a .result element and wire the details button.
  function attach(resultEl, g) {
    if (!resultEl || !g) return;
    const box = resultEl.querySelector('.result') || resultEl;
    const wrap = document.createElement('div');
    wrap.innerHTML = card(g);
    const node = wrap.firstChild;
    const btnrow = box.querySelector('.btnrow');
    if (btnrow) box.insertBefore(node, btnrow); else box.appendChild(node);
    const open = () => show(g, node.querySelector('.rv-thumb'));
    const more = node.querySelector('.rv-more');
    if (more) more.onclick = open;
    const thumb = node.querySelector('.rv-thumb');
    if (thumb) thumb.onclick = open;
  }

  // ---------- morph modal ----------
  function loadDash() {
    if (window.dashjs) return Promise.resolve();
    if (_dashP) return _dashP;
    _dashP = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'assets/vendor/dash.all.min.js?v=47';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
    return _dashP;
  }

  function playTrailer(media, g) {
    const v = document.createElement('video');
    v.className = 'rv-video'; v.controls = true; v.autoplay = true;
    v.playsInline = true; v.setAttribute('playsinline', '');
    if (g.trailerPoster) v.poster = g.trailerPoster;
    media.innerHTML = ''; media.appendChild(v);
    loadDash().then(() => {
      if (window.dashjs && dashjs.MediaPlayer) {
        try { dashjs.MediaPlayer().create().initialize(v, g.trailer, true); return; } catch (e) { /* fall through */ }
      }
      v.src = g.trailer;
    }).catch(() => {
      media.innerHTML = '<a class="btn primary" href="' + storeUrl(g) + '" target="_blank" rel="noopener">Watch on XBOX</a>';
    });
  }

  let _cur = null;
  function buildModal(g) {
    const back = document.createElement('div');
    back.className = 'rvmodal-back';
    const pv = poster(g);
    const desc = g.longDesc || g.shortDesc || '';
    const sub = [esc(g.developer), g.publisher && g.publisher !== g.developer ? esc(g.publisher) : '', g.year || '']
      .filter(Boolean).join(' \u2022 ');
    back.innerHTML =
      '<div class="rvmodal" role="dialog" aria-modal="true">' +
      '<button class="rvmodal-x" aria-label="Close">\u2715</button>' +
      '<div class="rvmodal-media' + (g.trailer ? ' has-trailer' : '') + '"' +
      (pv ? ' style="background-image:url(\'' + pv + '\')"' : '') + '>' +
      (g.trailer ? '<button class="rvmodal-playbtn" aria-label="Play trailer">\u25B6</button>' : '') +
      '</div>' +
      '<div class="rvmodal-body">' +
      '<h2 class="rvmodal-title">' + esc(g.title) + '</h2>' +
      (sub ? '<div class="rvmodal-sub">' + sub + '</div>' : '') +
      ratingsRow(g, true) + chips(g) + servicesRow(g) +
      (desc ? '<p class="rvmodal-desc">' + esc(desc) + '</p>' : '') +
      '<div class="rvmodal-links">' + links(g, true) + '</div>' +
      '</div></div>';
    const media = back.querySelector('.rvmodal-media');
    const playbtn = back.querySelector('.rvmodal-playbtn');
    if (playbtn) playbtn.onclick = () => playTrailer(media, g);
    const close = () => hide();
    back.querySelector('.rvmodal-x').onclick = close;
    back.addEventListener('click', e => { if (e.target === back) close(); });
    return back;
  }

  function show(g, thumbEl) {
    if (_cur) return;
    const back = buildModal(g);
    const doOpen = () => { document.body.appendChild(back); _cur = back; requestAnimationFrame(() => back.classList.add('in')); };
    // View Transitions morph (Edge/Chrome); graceful fallback elsewhere.
    if (document.startViewTransition && thumbEl) {
      const media = back.querySelector('.rvmodal-media');
      thumbEl.style.viewTransitionName = 'passle-hero';
      media.style.viewTransitionName = 'passle-hero';
      const t = document.startViewTransition(doOpen);
      t.finished.finally(() => { try { thumbEl.style.viewTransitionName = ''; media.style.viewTransitionName = ''; } catch (e) {} });
    } else {
      doOpen();
    }
    document.addEventListener('keydown', onKey);
  }
  function onKey(e) { if (e.key === 'Escape') hide(); }
  function hide() {
    if (!_cur) return;
    const back = _cur; _cur = null;
    document.removeEventListener('keydown', onKey);
    back.classList.remove('in');
    const v = back.querySelector('video');
    if (v) { try { v.pause(); } catch (e) {} }
    setTimeout(() => { try { back.remove(); } catch (e) {} }, 260);
  }

  window.GTP = window.GTP || {};
  window.GTP.reveal = { card, attach, show, storeUrl, cloudUrl };
})();
