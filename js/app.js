/* Bandwise — boot, language, theme, navigation, router */
(function () {
  'use strict';
  const BW = window.BW;
  const { esc, $ } = BW;
  BW.VERSION = '1.1.0';
  BW.data = window.BW_DATA || { reading: [], listening: [], writing: {}, speaking: {}, vocab: {}, strategies: {}, guide: {} };

  /* ---------- i18n ---------- */
  BW.lang = () => {
    const l = BW.store.s.profile.lang;
    if (l) return l;
    return /^ar\b/i.test(navigator.language || '') ? 'ar' : 'en';
  };
  BW.t = (k, params) => {
    const dict = window.BW_I18N || {};
    let s = (dict[BW.lang()] || {})[k];
    if (s == null) s = (dict.en || {})[k];
    if (s == null) { if (window.BW_DEBUG) console.warn('i18n missing:', k); s = k; }
    if (params) s = s.replace(/\{(\w+)\}/g, (m, p) => params[p] != null ? params[p] : m);
    return s;
  };
  BW.L = obj => obj == null ? '' : typeof obj === 'string' ? obj : (obj[BW.lang()] || obj.en || '');
  function applyLang() {
    const l = BW.lang();
    document.documentElement.lang = l;
    document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
    document.title = 'Bandwise – IELTS Practice';
    const skip = document.querySelector('.skip-link');
    if (skip) skip.textContent = BW.t('skipToContent');
  }
  BW.setLang = l => { BW.store.s.profile.lang = l; BW.store.save(true); applyLang(); renderNav(); render(); };
  BW.applyTheme = () => {
    const th = BW.store.s.settings.theme, root = document.documentElement;
    if (th === 'light' || th === 'dark') { root.setAttribute('data-theme', th); root.dataset.bwTheme = '1'; }
    else if (root.dataset.bwTheme) { root.removeAttribute('data-theme'); delete root.dataset.bwTheme; } // leave a host-set theme alone
  };

  /* ---------- navigation ---------- */
  const NAV = [
    ['home', '#/', 'home'], ['guide', '#/guide', 'guide'], ['listening', '#/listening', 'listening'], ['reading', '#/reading', 'reading'],
    ['writing', '#/writing', 'writing'], ['speaking', '#/speaking', 'speaking'], ['mock', '#/mock', 'mockShort']
  ];
  const NAV2 = [['coach', '#/coach', 'coach'], ['notebook', '#/mistakes', 'mistakes'], ['drills', '#/drills', 'drills'], ['tips', '#/tips', 'strategies'], ['vocab', '#/vocab', 'vocabulary'], ['progress', '#/progress', 'progress'], ['plan', '#/plan', 'studyPlan'], ['settings', '#/settings', 'settings']];
  const MOBILE = ['home', 'listening', 'reading', 'writing', 'speaking'];
  function section() {
    const h = location.hash.replace(/^#\/?/, '');
    const first = h.split('/')[0] || 'home';
    if (first === 'mistakes') return 'notebook';
    const map = { soundcheck: 'listening', test: null, result: null, review: null, write: 'writing', 'writing-result': 'writing', speak: 'speaking', 'speaking-result': 'speaking', drill: 'drills', flash: 'vocab', 'vocab-linking': 'vocab', 'vocab-phrases': 'vocab', calculator: 'guide' };
    return first in map ? map[first] : first;
  }
  function renderNav() {
    const cur = section();
    const t = BW.t;
    const link = ([id, href, label], secondary) => `<a class="nav-link${secondary || !MOBILE.includes(id) ? ' secondary' : ''}" href="${href}" ${cur === id ? 'aria-current="page"' : ''}>${BW.icon(id === 'tips' ? 'tips' : id)}<span>${esc(t(label))}</span></a>`;
    $('#nav').innerHTML = `<a class="brand" href="#/">${BW.brandMark()}<span class="brand-name">Bandwise</span></a>
      ${NAV.map(n => link(n)).join('')}
      <div class="nav-group">${esc(t('more'))}</div>
      ${NAV2.map(n => link(n, true)).join('')}
      <a class="nav-link mobile-more" href="#/more" ${['guide', 'mock', 'drills', 'tips', 'vocab', 'progress', 'plan', 'settings', 'coach', 'notebook', 'more'].includes(cur) ? 'aria-current="page"' : ''}>${BW.icon('settings')}<span>${esc(t('more'))}</span></a>
      <div class="rail-foot"><div class="lang-switch" role="group" aria-label="${esc(t('language'))}"><button data-lang="en" aria-pressed="${BW.lang() === 'en'}">EN</button><button data-lang="ar" aria-pressed="${BW.lang() === 'ar'}">ع</button></div></div>`;
  }
  function moreMenu() {
    const t = BW.t;
    const items = [['guide', '#/guide', 'guideTitle'], ['mock', '#/mock', 'mockTitle'], ...NAV2];
    return `<div class="page"><div class="page-head"><h1 class="h1">${t('more')}</h1></div><ul class="ruled">${items.map(([id, href, label]) => `<li><a class="row" href="${href}" style="grid-template-columns:auto 1fr"><span>${BW.icon(id)}</span><span class="row-title">${esc(t(label))}</span></a></li>`).join('')}</ul>
      <div class="section"><div class="lang-switch"><button data-lang="en" aria-pressed="${BW.lang() === 'en'}">English</button><button data-lang="ar" aria-pressed="${BW.lang() === 'ar'}">العربية</button></div></div></div>`;
  }

  /* ---------- router ---------- */
  const V = () => BW.views;
  const ROUTES = [
    [/^$/, () => ({ html: V().home() })],
    [/^more$/, () => ({ html: moreMenu() })],
    [/^coach$/, () => ({ html: V().coach(), after: () => V().bindCoach() })],
    [/^mistakes$/, () => ({ html: V().mistakes(), after: () => V().bindMistakes() })],
    [/^mistakes\/review(?:\/(.+))?$/, m => ({ html: V().mistakeReview(m[1]), after: () => V().bindMistakeReview() })],
    [/^guide(?:\/(\w+))?$/, m => ({ html: V().guide(m[1]), after: () => { V().bindGuide(); if (m[1]) { const el = document.getElementById('g-' + m[1]); if (el) el.scrollIntoView(); } } })],
    [/^calculator$/, () => ({ html: V().calculatorPage(), after: () => V().bindGuide() })],
    [/^listening$/, () => ({ html: V().listening() })],
    [/^soundcheck\/([\w-]+)$/, m => ({ html: V().soundcheck(m[1]), after: () => V().bindSoundcheck() })],
    [/^reading(?:\/(academic|general))?$/, m => ({ html: V().reading(m[1]) })],
    [/^test\/([\w-]+)\/(exam|practice)(?:\/(\d+))?$/, m => ({ launch: () => V().launchTest(m[1], m[2], m[3]) })],
    [/^result\/(\w+)$/, m => ({ html: V().result(m[1]) })],
    [/^review\/(\w+)$/, m => ({ launch: () => V().review(m[1]) })],
    [/^writing(?:\/(t1|t1other|t2|history))?$/, m => ({ html: V().writingList(m[1]), after: () => V().bindWritingList() })],
    [/^write\/([\w-]+)$/, m => ({ html: V().writeSetup(m[1]), after: () => V().bindWriteSetup() })],
    [/^writing-result\/(\w+)$/, m => ({ html: BW.writing.resultPage(m[1]), after: () => BW.writing.bindResult(m[1]) })],
    [/^speaking$/, () => ({ html: V().speakingList() })],
    [/^speak\/(full|part1|part2|part3)(?:\/([\w-]+))?$/, m => ({ launch: () => V().launchSpeak(m[1], m[2]) })],
    [/^speaking-result\/(\w+)$/, m => ({ html: BW.speaking.resultPage(m[1]), after: () => BW.speaking.bindResult(m[1]) })],
    [/^drills(?:\/(reading|listening))?$/, m => ({ html: V().drills(m[1]) })],
    [/^drill\/(\w+)(?:\/(reading|listening))?$/, m => ({ launch: () => V().launchDrill(m[1], m[2]) })],
    [/^tips(?:\/(\w+))?$/, m => ({ html: V().tips(m[1]) })],
    [/^mock$/, () => ({ html: V().mock(), after: () => V().bindMock() })],
    [/^vocab$/, () => ({ html: V().vocab() })],
    [/^vocab\/([\w-]+)$/, m => ({ html: V().vocabTopic(m[1]), after: () => V().bindVocabTopic() })],
    [/^vocab-linking$/, () => ({ html: V().vocabLinking() })],
    [/^vocab-phrases$/, () => ({ html: V().vocabPhrases() })],
    [/^flash\/([\w-]+)$/, m => ({ html: V().flash(m[1]), after: () => V().bindFlash() })],
    [/^progress$/, () => ({ html: V().progress(), after: () => V().bindData() })],
    [/^plan$/, () => ({ html: V().plan(), after: () => V().bindPlan() })],
    [/^settings$/, () => ({ html: V().settings(), after: () => { V().bindSettings(); if (location.hash.includes('#ai')) { const el = document.getElementById('ai'); if (el) el.scrollIntoView(); } } })]
  ];
  function freshMain() {
    const old = document.getElementById('main');
    const fresh = old.cloneNode(false);
    old.replaceWith(fresh);
    return fresh;
  }
  function render() {
    const path = location.hash.replace(/^#\/?/, '').split('#')[0].replace(/\/+$/, '');
    if (BW.runner.active()) BW.runner.abort();
    if (BW.writing.active()) BW.writing.close();
    if (BW.speaking.active()) BW.speaking.close();
    BW.tts.cancelAll();
    document.body.classList.remove('exam-mode');
    renderNav();
    let r = null;
    for (const [re, fn] of ROUTES) { const m = path.match(re); if (m) { r = fn(m); break; } }
    const main = freshMain();
    if (!r) { main.innerHTML = `<div class="page"><div class="empty">${BW.t('notFound')} <a href="#/">${BW.t('home')}</a></div></div>`; return; }
    if (r.launch) { main.innerHTML = ''; r.launch(); return; }
    main.innerHTML = r.html || '';
    if (r.after) r.after();
    if (!/^guide\/|^settings/.test(path) || !path.includes('/')) window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  }
  BW.app = { render };

  /* ---------- onboarding ---------- */
  function onboarding() {
    const t = BW.t, p = BW.store.s.profile;
    const m = BW.modal(`<h2>${t('welcomeTitle')}</h2><p class="muted">${t('welcomeText')}</p>
      <div class="field"><span>${t('language')}</span><div class="seg" data-ob="lang"><button aria-pressed="${BW.lang() === 'en'}" data-v="en">English</button><button aria-pressed="${BW.lang() === 'ar'}" data-v="ar">العربية</button></div></div>
      <div class="field"><span>${t('whichTest')}</span><div class="seg" data-ob="module"><button aria-pressed="${p.module !== 'general'}" data-v="academic">${t('academic')}</button><button aria-pressed="${p.module === 'general'}" data-v="general">${t('generalTraining')}</button></div><small>${t('whichTestHelp')}</small></div>
      <div class="grid-2"><label class="field"><span>${t('targetBand')}</span><select class="input" data-obf="target">${[5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9].map(b => `<option value="${b}" ${b === p.target ? 'selected' : ''}>${b.toFixed(1)}</option>`).join('')}</select></label>
      <label class="field"><span>${t('examDateOptional')}</span><input class="input" type="date" data-obf="examDate" value="${esc(p.examDate)}"></label></div>
      <label class="field"><span>${t('yourNameOptional')}</span><input class="input" data-obf="name" value="${esc(p.name)}" autocomplete="given-name"></label>
      <div class="btn-row"><button class="btn btn-ink" data-ob-done>${t('getStarted')}</button></div>`, { sticky: true });
    m.el.addEventListener('click', e => {
      const b = e.target.closest('[data-v]');
      if (b) {
        const k = b.closest('[data-ob]').dataset.ob;
        if (k === 'lang') { p.lang = b.dataset.v; BW.store.save(true); applyLang(); m.close(); onboarding(); renderNav(); render(); return; }
        p[k] = b.dataset.v; BW.$$('button', b.parentElement).forEach(x => x.setAttribute('aria-pressed', x === b));
      }
      if (e.target.closest('[data-ob-done]')) {
        m.el.querySelectorAll('[data-obf]').forEach(i => { p[i.dataset.obf] = i.dataset.obf === 'target' ? +i.value : i.value.trim(); });
        p.lang = BW.lang(); p.onboarded = true; BW.store.save(true); m.close(); render();
      }
    });
  }

  /* ---------- background: guide refresh & offline support ---------- */
  async function refreshGuide() {
    if (!/^https?:$/.test(location.protocol) || navigator.onLine === false) return;
    try {
      const r = await fetch('data/guide.json', { cache: 'no-store' });
      if (!r.ok) return;
      const g = await r.json();
      const cur = BW.views.guideData();
      if (g && g.kind === 'guide' && g.version > (cur.version || 0)) { BW.store.s.guide = g; BW.store.save(true); BW.toast(BW.t('guideUpdated', { date: g.lastReviewed })); }
    } catch (e) { /* offline */ }
  }
  function registerSW() {
    if (!('serviceWorker' in navigator) || !['https:', 'http:'].includes(location.protocol)) return;
    navigator.serviceWorker.register('sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw && nw.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) BW.toast(BW.t('updateReady'), 8000); });
      });
    }).catch(() => { /* not fatal */ });
  }

  function boot() {
    applyLang();
    BW.applyTheme();
    document.addEventListener('click', e => {
      const l = e.target.closest('[data-lang]'); if (l) BW.setLang(l.dataset.lang);
      if (e.target.closest('.skip-link')) { e.preventDefault(); document.getElementById('main').focus(); }
    });
    window.addEventListener('hashchange', render);
    render();
    if (!BW.store.s.profile.onboarded) onboarding();
    BW.tts.ready.then(() => { if (section() === 'settings') render(); });
    registerSW();
    setTimeout(refreshGuide, 1500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
