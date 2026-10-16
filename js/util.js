/* Bandwise — shared helpers, storage, scoring */
(function () {
  'use strict';
  const BW = window.BW = window.BW || {};

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const words = s => (String(s || '').trim().match(/\S+/g) || []).length;
  const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

  /* ---------- storage ---------- */
  const KEY = 'bandwise.v1';
  const DEFAULTS = () => ({
    profile: { name: '', module: 'academic', target: 7, examDate: '', hours: 6, lang: '', onboarded: false },
    settings: { theme: 'auto', rate: 1, textSize: 'normal', contrast: 'default', voices: {}, ai: { provider: 'none', key: '', model: '', baseUrl: '', preset: 'openai' } },
    attempts: [],
    writing: [],
    speaking: [],
    vocab: {},
    plan: { done: {} },
    guide: null,
    drafts: {},
    learning: { dailyGoal: 30, reviews: {}, days: {}, events: [] }
  });
  const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  function normalize(input) {
    if (!isObject(input)) throw new Error('Invalid backup');
    const d = DEFAULTS();
    // Older backups can omit fields. Present fields must have the expected shape.
    for (const key of ['profile', 'settings', 'vocab', 'plan', 'drafts', 'learning']) if (input[key] != null && !isObject(input[key])) throw new Error('Invalid ' + key);
    for (const key of ['attempts', 'writing', 'speaking']) if (input[key] != null && (!Array.isArray(input[key]) || input[key].some(value => !isObject(value)))) throw new Error('Invalid ' + key);
    const validRecord = value => typeof value.id === 'string' && typeof value.date === 'string' && Number.isFinite(Date.parse(value.date));
    for (const a of input.attempts || []) {
      if (!validRecord(a) || !['reading', 'listening', 'mock'].includes(a.kind)) throw new Error('Invalid attempt');
      if (a.kind !== 'mock' && (!isObject(a.answers) || !isObject(a.byType) || !Number.isFinite(a.raw) || !Number.isFinite(a.max))) throw new Error('Invalid answers');
      if (a.kind !== 'mock' && Object.values(a.byType).some(value => !Array.isArray(value) || value.length !== 2 || value.some(n => !Number.isFinite(n) || n < 0) || value[0] > value[1])) throw new Error('Invalid accuracy');
      if (a.band != null && (!Number.isFinite(a.band) || a.band < 0 || a.band > 9)) throw new Error('Invalid band');
      if (a.parts != null && (!Array.isArray(a.parts) || a.parts.some(n => !Number.isInteger(n) || n < 0))) throw new Error('Invalid parts');
    }
    for (const a of input.writing || []) if (!validRecord(a) || typeof a.text !== 'string' || !['at1', 'gt1', 't2'].includes(a.taskKind)) throw new Error('Invalid writing');
    for (const a of input.speaking || []) if (!validRecord(a) || !Array.isArray(a.items) || a.items.some(item => !isObject(item) || !isObject(item.stats) || typeof item.question !== 'string')) throw new Error('Invalid speaking');
    JSON.stringify(input, (key, value) => { if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Invalid key'); return value; });
    const s = Object.assign(d, input, {
      profile: Object.assign({}, d.profile, input.profile),
      settings: Object.assign({}, d.settings, input.settings, { ai: Object.assign({}, d.settings.ai, input.settings?.ai), voices: Object.assign({}, input.settings?.voices) }),
      plan: Object.assign({}, d.plan, input.plan, { done: Object.assign({}, input.plan?.done) }),
      learning: Object.assign({}, d.learning, input.learning, { reviews: Object.assign({}, input.learning?.reviews), days: Object.assign({}, input.learning?.days), events: Array.isArray(input.learning?.events) ? input.learning.events.filter(isObject) : [] })
    });
    s.profile.module = s.profile.module === 'general' ? 'general' : 'academic';
    s.profile.target = Number.isFinite(s.profile.target) ? clamp(s.profile.target, 4, 9) : 7;
    s.profile.hours = Number.isFinite(s.profile.hours) ? clamp(s.profile.hours, 1, 40) : 6;
    for (const key of ['name', 'lang', 'examDate']) if (typeof s.profile[key] !== 'string') s.profile[key] = '';
    if (!['', 'en', 'ar'].includes(s.profile.lang)) s.profile.lang = '';
    if (!['auto', 'light', 'dark'].includes(s.settings.theme)) s.settings.theme = 'auto';
    for (const key of ['provider', 'key', 'model', 'baseUrl', 'preset']) if (typeof s.settings.ai[key] !== 'string') s.settings.ai[key] = DEFAULTS().settings.ai[key];
    if (![15, 30, 45, 60].includes(s.learning.dailyGoal)) s.learning.dailyGoal = 30;
    for (const [key, value] of Object.entries(s.learning.reviews)) {
      if (!isObject(value)) { delete s.learning.reviews[key]; continue; }
      s.learning.reviews[key] = { note: typeof value.note === 'string' ? value.note.slice(0, 2000) : '', streak: Number.isInteger(value.streak) ? clamp(value.streak, 0, 5) : 0, due: Number.isFinite(value.due) && value.due >= 0 ? value.due : 0, reviewedAt: Number.isFinite(value.reviewedAt) && value.reviewedAt >= 0 ? value.reviewedAt : 0 };
    }
    for (const [key, value] of Object.entries(s.learning.days)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !isObject(value) || typeof value.fingerprint !== 'string' || !Array.isArray(value.tasks) || value.tasks.some(task => !isObject(task) || !['review', 'vocab', 'listening', 'reading', 'writing', 'speaking'].includes(task.id) || task.id !== task.kind || !Number.isFinite(task.min) || task.min < 1 || task.min > 60 || typeof task.href !== 'string' || !/^#\/[\w/%:,-]*$/.test(task.href))) { delete s.learning.days[key]; continue; }
      value.tasks = value.tasks.map(task => Object.assign({}, task, { done: task.done === true, auto: false, title: task.kind === 'review' ? 'learnReviewTask' : task.kind === 'vocab' ? 'learnVocabTask' : 'learnFocusTask' }));
    }
    s.learning.events = s.learning.events.filter(event => ['review', 'vocab'].includes(event.kind) && typeof event.date === 'string' && Number.isFinite(Date.parse(event.date)));
    return s;
  }
  let state;
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const d = DEFAULTS();
      if (!raw) return d;
      return normalize(JSON.parse(raw));
    } catch (e) { return DEFAULTS(); }
  }
  let saveTimer = null, storageOk = true;
  function save(now) {
    clearTimeout(saveTimer);
    const write = () => {
      try { localStorage.setItem(KEY, JSON.stringify(state)); storageOk = true; }
      catch (e) {
        if (storageOk) { storageOk = false; BW.toast && BW.toast(BW.t ? BW.t('storageFull') : 'Storage is full.'); }
      }
    };
    if (now) write(); else saveTimer = setTimeout(write, 250);
  }
  state = load();
  const store = {
    get s() { return state; },
    save,
    reset() { state = DEFAULTS(); save(true); },
    replace(obj) { state = normalize(obj); save(true); },
    validate: normalize,
    addAttempt(a) { a.id = a.id || uid(); a.date = a.date || new Date().toISOString(); state.attempts.push(a); save(); return a; },
    attempts(kind) { return state.attempts.filter(a => !kind || a.kind === kind); },
    attempt(id) { return state.attempts.find(a => a.id === id); }
  };

  /* ---------- scoring ---------- */
  // Indicative raw-score thresholds [minimum correct, band], anchored on the averages ielts.org publishes.
  const TABLES = {
    listening: [[39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6], [18, 5.5], [16, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [2, 2], [1, 1], [0, 0]],
    academic: [[39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6], [19, 5.5], [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [2, 2], [1, 1], [0, 0]],
    general: [[40, 9], [39, 8.5], [37, 8], [36, 7.5], [35, 7], [32, 6.5], [30, 6], [27, 5.5], [23, 5], [19, 4.5], [15, 4], [12, 3.5], [9, 3], [6, 2.5], [3, 2], [1, 1], [0, 0]]
  };
  function bandFromRaw(raw, table) {
    const t = TABLES[table] || TABLES.listening;
    for (const [min, band] of t) if (raw >= min) return band;
    return 0;
  }
  function rawRangeFor(band, table) {
    const t = TABLES[table];
    const i = t.findIndex(r => r[1] === band);
    if (i < 0) return null;
    const lo = t[i][0], hi = i === 0 ? 40 : t[i - 1][0] - 1;
    return [lo, hi];
  }
  function roundBand(avg) {
    const f = Math.floor(avg), frac = +(avg - f).toFixed(4);
    if (frac < 0.25) return f;
    if (frac < 0.75) return f + 0.5;
    return f + 1;
  }
  function overallBand(l, r, w, s) {
    const v = [l, r, w, s];
    if (v.some(x => !Number.isFinite(x) || x < 0 || x > 9)) return null;
    const avg = (l + r + w + s) / 4;
    return { avg, band: roundBand(avg) };
  }
  // Task 2 carries more weight than Task 1; a 1:2 weighting is the usual approximation.
  function writingBand(t1, t2) {
    if (t1 == null && t2 == null) return null;
    if (t1 == null) return t2;
    if (t2 == null) return t1;
    return roundBand((t1 + 2 * t2) / 3);
  }
  const halfRound = v => Math.round(v * 2) / 2;
  const fmtBand = b => (b == null || isNaN(b)) ? '–' : Number(b).toFixed(1);

  /* ---------- answer checking ---------- */
  function normAns(s) {
    return String(s == null ? '' : s).toLowerCase()
      .replace(/[‘’`´]/g, "'").replace(/[“”"]/g, '')
      .replace(/(\d),(?=\d{3}\b)/g, '$1')
      .replace(/\bper ?cent\b/g, '%').replace(/\s+%/g, '%')
      .replace(/(\d)\s*:\s*(\d)/g, '$1.$2')
      .replace(/\b(a\.m\.|a\.m)\b/g, 'am').replace(/\b(p\.m\.|p\.m)\b/g, 'pm')
      .replace(/(\d)\s+(am|pm)\b/g, '$1$2')
      .replace(/[–—-]+/g, ' ').replace(/\//g, ' ')
      .replace(/(?<!\d)\.|\.(?!\d)/g, ' ')
      .replace(/[^a-z0-9£$€%.' ]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }
  function limitWords(limit) {
    const L = String(limit || '').toUpperCase();
    const m = L.match(/\b(ONE|TWO|THREE|FOUR|FIVE)\s+WORDS?\b/);
    return m ? { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }[m[1]] : null;
  }
  function checkGap(user, q, limit) {
    const u = normAns(user);
    if (!u) return false;
    const variants = [q.answer].concat(q.accept || []).map(normAns);
    if (variants.includes(u)) return true;
    const max = limitWords(limit);
    const stripped = u.replace(/^(the|a|an) /, '');
    if (stripped !== u && variants.includes(stripped) && (max == null || words(u) <= max + (/NUMBER/i.test(limit) ? 1 : 0))) return true;
    return false;
  }
  // Returns {score, max, right:[bool per mark]}
  function scoreQuestion(q, group, ans) {
    if (Array.isArray(q.n)) {
      const chosen = Array.isArray(ans) ? Array.from(new Set(ans)) : [];
      const right = q.n.map((_, i) => false);
      if (chosen.length > q.n.length) return { score: 0, max: q.n.length, right };
      let hits = chosen.filter(c => q.answer.includes(c)).length;
      hits = Math.min(hits, q.n.length);
      for (let i = 0; i < hits; i++) right[i] = true;
      return { score: hits, max: q.n.length, right };
    }
    let ok;
    if (q.choices || group.options || ['tfng', 'ynng'].includes(group.type)) ok = String(ans || '').trim() === String(q.answer);
    else ok = checkGap(ans, q, group.limit);
    return { score: ok ? 1 : 0, max: 1, right: [ok] };
  }
  const qKey = q => Array.isArray(q.n) ? q.n.join(',') : String(q.n);
  const qNums = q => Array.isArray(q.n) ? q.n : [q.n];

  /* ---------- dates ---------- */
  function daysUntil(iso) {
    if (!iso) return null;
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return null;
    const now = new Date(); now.setHours(0, 0, 0, 0);
    return Math.round((d - now) / 86400000);
  }
  function fmtDate(iso, lang) {
    try { return new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch (e) { return iso; }
  }
  function fmtClock(sec) {
    sec = Math.max(0, Math.round(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  /* ---------- downloads ---------- */
  function download(name, text, type) {
    const blob = text instanceof Blob ? text : new Blob([text], { type: type || 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  /* ---------- icons (24px line icons) ---------- */
  const P = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h5v-6h4v6h5V9.5"/>',
    guide: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H11v17H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M20 4.5A1.5 1.5 0 0 0 18.5 3H13v17h5.5a1.5 1.5 0 0 0 1.5-1.5z"/>',
    listening: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4.5" height="6.5" rx="1.5"/><rect x="16.5" y="14" width="4.5" height="6.5" rx="1.5"/>',
    reading: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M9 11h7M9 14.5h7M9 18h4.5"/>',
    writing: '<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-4-4L4 16z"/><path d="m14 6 4 4"/>',
    speaking: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
    mock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2.5h5"/>',
    vocab: '<rect x="3" y="6" width="13" height="15" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v12"/>',
    progress: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    plan: '<rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4M7.5 14h3M13.5 14h3M7.5 17.5h3"/>',
    tips: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3z"/>',
    drills: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8" fill="currentColor"/>',
    coach: '<path d="m4 19 5-7 4 3 7-11M15 4h5v5"/><path d="M4 5v14h16"/>',
    notebook: '<rect x="5" y="3" width="15" height="18" rx="2"/><path d="M3 7h4M3 12h4M3 17h4M10 8h6M10 12h6M10 16h3"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none"/>',
    pause: '<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
    download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 20V9M7 13.5l5-5 5 5M5 4h14"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5L20 16M20 20v-4h-4"/>',
    calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8.5 7h7M8.5 11h1M11.5 11h1M14.5 11h1M8.5 14.5h1M11.5 14.5h1M14.5 14.5h1M8.5 18h1M11.5 18h4"/>'
  };
  const icon = (name, cls) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${cls ? ` class="${cls}"` : ''}>${P[name] || ''}</svg>`;
  const brandMark = () => `<svg class="brand-mark" viewBox="0 0 1024 1024" aria-hidden="true"><defs><clipPath id="bwhb"><rect x="150" y="575" width="724" height="150" rx="22" transform="rotate(-4 512 650)"/></clipPath></defs><rect width="1024" height="1024" rx="225" fill="#17233B"/><g fill="#F7D547"><rect x="150" y="575" width="724" height="150" rx="22" transform="rotate(-4 512 650)"/></g><path d="M107 -20C385 31 572 206 572 445C572 645 474 764 299 764C159 764 39 679 39 511C39 370 133 290 263 290C320 290 366 306 398 330C368 166 276 69 101 9ZM403 361C380 344 357 337 326 337C247 337 198 410 198 533C198 671 246 730 303 730C365 730 409 665 409 467C409 429 407 394 403 361Z" transform="translate(285.9 770.4) scale(0.74 -0.74)" fill="#F4F6F3"/><g clip-path="url(#bwhb)"><path d="M107 -20C385 31 572 206 572 445C572 645 474 764 299 764C159 764 39 679 39 511C39 370 133 290 263 290C320 290 366 306 398 330C368 166 276 69 101 9ZM403 361C380 344 357 337 326 337C247 337 198 410 198 533C198 671 246 730 303 730C365 730 409 665 409 467C409 429 407 394 403 361Z" transform="translate(285.9 770.4) scale(0.74 -0.74)" fill="#17233B"/></g></svg>`;

  /* ---------- toast & modal ---------- */
  function toast(msg, ms) {
    const host = document.getElementById('toast');
    if (!host) return;
    const el = document.createElement('div');
    el.className = 't'; el.textContent = msg;
    host.appendChild(el);
    setTimeout(() => el.remove(), ms || 3200);
  }
  let closeModal = null;
  function modal(html, opts) {
    opts = opts || {};
    if (closeModal) closeModal();
    const previous = document.activeElement;
    const host = document.getElementById('overlay');
    host.innerHTML = `<div class="modal-back"><div class="modal" role="dialog" aria-modal="true" tabindex="-1">${html}</div></div>`;
    const back = host.firstChild;
    const dialog = back.firstChild, heading = dialog.querySelector('h1,h2,h3');
    if (heading) { heading.id = heading.id || 'modal-' + uid(); dialog.setAttribute('aria-labelledby', heading.id); }
    else dialog.setAttribute('aria-label', document.title);
    let closed = false;
    const close = () => { if (closed) return; closed = true; host.innerHTML = ''; document.removeEventListener('keydown', onKey); closeModal = null; if (previous?.isConnected) previous.focus({ preventScroll: true }); if (opts.onClose) opts.onClose(); };
    const onKey = e => {
      if (e.key === 'Escape' && !opts.sticky) { e.preventDefault(); close(); }
      if (e.key === 'Tab') {
        const elements = Array.from(dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')).filter(el => el.getClientRects().length);
        const first = elements[0], last = elements[elements.length - 1];
        if (!first) { e.preventDefault(); dialog.focus(); }
        else if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    closeModal = close;
    document.addEventListener('keydown', onKey);
    back.addEventListener('click', e => { if (e.target === back && !opts.sticky) close(); });
    const first = back.querySelector('button, input, select, textarea, a[href]');
    setTimeout(() => { if (!closed) (first || dialog).focus(); }, 30);
    return { el: back.firstChild, close };
  }
  function confirmBox(msg, yes, no) {
    return new Promise(res => {
      let answer = false;
      const m = modal(`<p>${esc(msg)}</p><div class="btn-row"><button class="btn" data-a="no">${esc(no || BW.t('cancel'))}</button><button class="btn btn-ink" data-a="yes">${esc(yes || BW.t('ok'))}</button></div>`, { onClose: () => res(answer) });
      m.el.addEventListener('click', e => {
        const a = e.target.closest('[data-a]');
        if (!a) return;
        answer = a.dataset.a === 'yes';
        m.close();
      });
    });
  }

  Object.assign(BW, { $, $$, esc, uid, clamp, sleep, words, shuffle, store, TABLES, bandFromRaw, rawRangeFor, roundBand, overallBand, writingBand,
    halfRound, fmtBand, normAns, checkGap, scoreQuestion, qKey, qNums, limitWords, daysUntil, fmtDate, fmtClock, download, icon, brandMark, toast, modal, confirmBox });
})();
