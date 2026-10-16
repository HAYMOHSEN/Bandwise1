/* Bandwise — vocabulary, progress, study plan, settings */
(function () {
  'use strict';
  const BW = window.BW;
  const { esc } = BW;
  const t = (...a) => BW.t(...a);
  const V = BW.views;
  const D = () => BW.data;
  const head = (title, lede, extra) => `<div class="page-head"><div><h1 class="h1">${esc(title)}</h1>${lede ? `<p class="lede">${esc(lede)}</p>` : ''}</div>${extra || ''}</div>`;

  /* ---------- Vocabulary ---------- */
  const wid = (topic, w) => topic + ':' + w.w;
  const INTERVALS = [0, 0, 1, 3, 7, 16, 35]; // days per Leitner box
  function boxOf(id) { return (BW.store.s.vocab[id] || {}).box || 0; }
  V.vocab = function () {
    const vb = D().vocab || {};
    const now = Date.now();
    const due = Object.values(BW.store.s.vocab).filter(x => x.due <= now).length;
    return `<div class="page">${head(t('vocabulary'), t('vocabLede'), `<div class="btn-row"><a class="btn btn-ink ${due ? '' : 'disabled'}" href="#/flash/due">${t('reviewDue', { n: due })}</a></div>`)}
      <div class="tabs"><a href="#/vocab" aria-selected="true">${t('topics')}</a><a href="#/vocab-linking">${t('linkingWords')}</a><a href="#/vocab-phrases">${t('usefulPhrases')}</a></div>
      <ul class="ruled">${(vb.topics || []).map(tp => {
        const learned = tp.words.filter(w => boxOf(wid(tp.id, w)) >= 4).length;
        return `<li class="row"><div><div class="row-title">${esc(BW.lang() === 'ar' ? tp.ar + ' · ' + tp.name : tp.name)}</div><div class="row-meta">${t('learnedOf', { a: learned, b: tp.words.length })}</div></div><div class="btn-row"><a class="btn btn-sm" href="#/vocab/${esc(tp.id)}">${t('browse')}</a><a class="btn btn-sm btn-ink" href="#/flash/${esc(tp.id)}">${t('study')}</a></div></li>`;
      }).join('')}</ul></div>`;
  };
  V.vocabTopic = function (id) {
    const tp = ((D().vocab || {}).topics || []).find(x => x.id === id);
    if (!tp) return `<div class="page"><div class="empty">${t('notFound')}</div></div>`;
    const showAr = BW.store.s.settings.showArabic !== false;
    return `<div class="page"><a class="back" href="#/vocab">${BW.icon('back')} ${t('vocabulary')}</a>${head(tp.name, BW.lang() === 'ar' ? tp.ar : '', `<div class="btn-row"><label class="small"><input type="checkbox" data-toggle-ar ${showAr ? 'checked' : ''}> ${t('showArabic')}</label><a class="btn btn-ink" href="#/flash/${esc(tp.id)}">${t('study')}</a></div>`)}
      <div>${tp.words.map(w => `<div class="word-row"><div><div class="w" lang="en">${esc(w.w)}<small>${esc(w.pos || '')}</small></div>${showAr ? `<div class="ar" lang="ar">${esc(w.ar)}</div>` : ''}<div class="box-meter" style="justify-content:flex-start;margin-top:6px">${[1, 2, 3, 4, 5].map(i => `<i class="${boxOf(wid(tp.id, w)) >= i ? 'on' : ''}"></i>`).join('')}</div></div><div lang="en"><div>${esc(w.def)}</div><div class="ex">${esc(w.ex)}</div>${(w.col || []).length ? `<div class="col">${esc(w.col.join(' · '))}</div>` : ''}</div></div>`).join('')}</div></div>`;
  };
  V.vocabLinking = function () {
    const vb = D().vocab || {};
    return `<div class="page">${head(t('vocabulary'), t('linkingLede'))}<div class="tabs"><a href="#/vocab">${t('topics')}</a><a href="#/vocab-linking" aria-selected="true">${t('linkingWords')}</a><a href="#/vocab-phrases">${t('usefulPhrases')}</a></div>
      <ul class="ruled">${(vb.linking || []).map(g => `<li style="padding:14px 4px"><div class="row-title">${esc(BW.lang() === 'ar' && g.ar ? g.ar + ' · ' + g.function : g.function)}</div><div class="btn-row" style="margin:8px 0">${g.items.map(i => `<span class="chip" lang="en">${esc(i)}</span>`).join('')}</div>${g.example ? `<div class="small" lang="en" style="font-family:var(--font-read)"><i>${esc(g.example)}</i></div>` : ''}${g.tip ? `<div class="small muted" style="margin-top:4px">${esc(BW.lang() === 'ar' && g.tipAr ? g.tipAr : g.tip)}</div>` : ''}</li>`).join('')}</ul></div>`;
  };
  V.vocabPhrases = function () {
    const ph = (D().vocab || {}).phrases || {};
    const sec = (k, title) => (ph[k] || []).length ? `<h2 class="h3" style="margin-top:28px">${esc(title)}</h2><ul class="ruled">${ph[k].map(p => `<li class="row"><b lang="en">${esc(p.en)}</b><span class="small muted">${esc(p.use || '')}</span></li>`).join('')}</ul>` : '';
    return `<div class="page">${head(t('vocabulary'), t('phrasesLede'))}<div class="tabs"><a href="#/vocab">${t('topics')}</a><a href="#/vocab-linking">${t('linkingWords')}</a><a href="#/vocab-phrases" aria-selected="true">${t('usefulPhrases')}</a></div>
      ${sec('task1', t('task1Phrases'))}${sec('task2', t('task2Phrases'))}${sec('speaking', t('speakingPhrases'))}</div>`;
  };

  let FC = null;
  V.flash = function (which) {
    const vb = D().vocab || {};
    const now = Date.now();
    let cards = [];
    for (const tp of vb.topics || []) for (const w of tp.words) {
      const id = wid(tp.id, w), st = BW.store.s.vocab[id];
      if (which === 'due' ? (st && st.due <= now) : tp.id === which) cards.push({ id, w, tp, st });
    }
    if (which !== 'due') cards = cards.filter(c => !c.st || c.st.due <= now).concat(cards.filter(c => c.st && c.st.due > now)).slice(0, 20);
    FC = { cards: which === 'due' ? cards : BW.shuffle(cards.slice(0, 20)), i: 0, flipped: false, which, done: 0 };
    return `<div class="page"><a class="back" href="#/vocab">${BW.icon('back')} ${t('vocabulary')}</a><div id="fcwrap">${fcHTML()}</div></div>`;
  };
  function fcHTML() {
    if (!FC.cards.length) return `<div class="empty">${t('nothingDue')}</div>`;
    if (FC.i >= FC.cards.length) return `<div class="empty"><div class="h3">${t('sessionDone', { n: FC.done })}</div><a class="btn" href="#/vocab">${t('backToTopics')}</a></div>`;
    const c = FC.cards[FC.i], showAr = BW.store.s.settings.showArabic !== false;
    const box = boxOf(c.id);
    return `<div class="muted small" style="text-align:center">${FC.i + 1} / ${FC.cards.length} · ${esc(c.tp.name)}</div>
      <div class="flashcard" data-fc="flip" tabindex="0" role="button" aria-label="${t('flipCard')}"><div class="word" lang="en">${esc(c.w.w)}</div><div class="pos">${esc(c.w.pos || '')}</div>
      ${FC.flipped ? `<div class="def" lang="en">${esc(c.w.def)}</div><div class="ex" lang="en">${esc(c.w.ex)}</div>${showAr ? `<div class="arw" lang="ar">${esc(c.w.ar)}</div>` : ''}${(c.w.col || []).length ? `<div class="small faint" style="margin-top:10px" lang="en">${esc(c.w.col.join(' · '))}</div>` : ''}` : `<div class="small faint" style="margin-top:22px">${t('tapToReveal')}</div>`}
      <div class="box-meter">${[1, 2, 3, 4, 5].map(i => `<i class="${box >= i ? 'on' : ''}"></i>`).join('')}</div></div>
      <div class="btn-row" style="justify-content:center;margin-top:18px">${FC.flipped ? `<button class="btn" data-fc="again">${t('again')}</button><button class="btn" data-fc="hard">${t('hard')}</button><button class="btn btn-ink" data-fc="good">${t('good')}</button><button class="btn" data-fc="easy">${t('easy')}</button>` : `<button class="btn btn-ink" data-fc="flip">${t('showAnswer')}</button>`}<button class="btn btn-ghost" data-fc="say" aria-label="${t('pronounce')}">${BW.icon('listening')}</button></div>`;
  }
  V.bindFlash = function () {
    const wrap = document.getElementById('fcwrap');
    if (!wrap) return;
    const act = a => {
      const c = FC.cards[FC.i];
      if (!c) return;
      if (a === 'flip') { FC.flipped = !FC.flipped; }
      else if (a === 'say') { BW.tts.speak(c.w.w + '. ' + c.w.ex, { accent: 'en-GB', gender: 'female' }); return; }
      else {
        const st = BW.store.s.vocab[c.id] || { box: 0 };
        st.box = a === 'again' ? 1 : a === 'hard' ? Math.max(1, st.box) : a === 'good' ? Math.min(6, st.box + 1) : Math.min(6, st.box + 2);
        st.due = Date.now() + INTERVALS[st.box] * 86400000 + (a === 'again' ? 60000 : 0);
        st.reviewedAt = Date.now(); BW.store.s.vocab[c.id] = st;
        if (BW.learning) BW.learning.recordEvent('vocab', { wordId: c.id });
        BW.store.save();
        if (a === 'again') FC.cards.push(c);
        FC.i++; FC.done++; FC.flipped = false;
      }
      wrap.innerHTML = fcHTML();
    };
    wrap.addEventListener('click', e => { const b = e.target.closest('[data-fc]'); if (b) act(b.dataset.fc); });
    document.addEventListener('keydown', function k(e) {
      if (!document.getElementById('fcwrap')) { document.removeEventListener('keydown', k); return; }
      if (e.target.matches('input,textarea,select')) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); act('flip'); }
      else if (FC.flipped && ['1', '2', '3', '4'].includes(e.key)) act(['again', 'hard', 'good', 'easy'][+e.key - 1]);
    });
  };
  V.bindVocabTopic = function () {
    const c = document.querySelector('[data-toggle-ar]');
    if (c) c.addEventListener('change', () => { BW.store.s.settings.showArabic = c.checked; BW.store.save(); BW.app.render(); });
  };

  /* ---------- Progress ---------- */
  V.progress = function () {
    const s = BW.store.s, target = s.profile.target;
    const pts = { listening: [], reading: [], writing: [], speaking: [] };
    s.attempts.filter(a => a.full && a.band != null && (a.kind !== 'reading' || a.module === s.profile.module)).forEach(a => pts[a.kind] && pts[a.kind].push({ band: a.band, label: BW.fmtDate(a.date, BW.lang()) }));
    s.writing.forEach(r => { const b = BW.writing.bandOf(r).band; if (b != null && r.taskKind === 't2') pts.writing.push({ band: b, label: BW.fmtDate(r.date, BW.lang()) + ' (T2)' }); });
    s.speaking.forEach(r => { const b = BW.speaking.bandOf(r).band; if (b != null) pts.speaking.push({ band: b, label: BW.fmtDate(r.date, BW.lang()) }); });
    const acc = V.typeAccuracy();
    const types = Object.entries(acc).filter(([, v]) => v[1] > 0).sort((a, b) => a[1][0] / a[1][1] - b[1][0] / b[1][1]);
    const hist = [
      ...s.attempts.filter(a => a.kind !== 'mock').map(a => ({ date: a.date, title: a.title || a.kind, sub: `${t(a.kind)} · ${a.raw}/${a.max}`, band: a.band, href: '#/result/' + a.id })),
      ...s.writing.map(r => ({ date: r.date, title: BW.writing.kindName(r.taskKind), sub: `${t('writing')} · ${r.wc} ${t('words')}`, band: BW.writing.bandOf(r).band, href: '#/writing-result/' + r.id })),
      ...s.speaking.map(r => ({ date: r.date, title: t('sp_mode_' + r.mode), sub: t('speaking'), band: BW.speaking.bandOf(r).band, href: '#/speaking-result/' + r.id }))
    ].sort((a, b) => b.date.localeCompare(a.date));
    return `<div class="page">${head(t('progress'), t('progressLede'), `<div class="btn-row no-print"><a class="btn btn-sm" href="#/coach">${esc(t('coach'))}</a><button class="btn btn-sm" data-learn-csv>${esc(t('learnCSV'))}</button><button class="btn btn-sm" data-learn-print>${esc(t('learnPrint'))}</button></div>`)}
      <div class="small-multiples">${['listening', 'reading', 'writing', 'speaking'].map(k => `<div class="sm-chart"><h4><span>${t(k)}</span><span class="faint small">${pts[k].length} ${t('scored')}</span></h4>${pts[k].length ? BW.charts.trend(pts[k], target) : `<div class="small muted" style="padding:30px 0;text-align:center">${t('noScoresYet')}</div>`}</div>`).join('')}</div>
      <p class="small faint" style="margin-top:8px">${t('trendNote')}</p>
      <div class="section"><div class="section-head"><h2 class="h3">${t('byQuestionType')}</h2><span class="small muted">${t('weakestFirst')}</span></div>${types.length ? `<div class="bars">${types.map(([k, v]) => { const p = v[0] / v[1]; return `<div class="bar-row"><span>${esc(V.typeName(k))}</span><span class="bar-track"><i class="${p < 0.5 ? 'low' : p < 0.75 ? 'mid' : 'high'}" style="width:${Math.round(p * 100)}%"></i></span><span class="num">${Math.round(p * 100)}% <a class="small" href="#/drill/${esc(k)}">${t('drill')}</a></span></div>`; }).join('')}</div>` : `<div class="empty">${t('noAttemptsYet')}</div>`}</div>
      <div class="section"><div class="section-head"><h2 class="h3">${t('history')}</h2></div>${hist.length ? `<ul class="ruled">${hist.slice(0, 60).map(h => `<li><a class="row" href="${h.href}"><div><div class="row-title">${esc(h.title)}</div><div class="row-meta">${BW.fmtDate(h.date, BW.lang())} · ${esc(h.sub)}</div></div><span class="skill-band">${BW.fmtBand(h.band)}</span></a></li>`).join('')}</ul>` : `<div class="empty">${t('noAttemptsYet')}</div>`}</div>
      <div class="section no-print"><h2 class="h3">${t('backup')}</h2><p class="small muted">${t('backupHelp')}</p><div class="btn-row"><button class="btn" data-export>${BW.icon('download')} ${t('exportData')}</button><label class="btn">${BW.icon('upload')} ${t('importData')}<input type="file" accept="application/json,.json" data-import hidden></label></div></div></div>`;
  };
  V.bindData = function () {
    if (V.bindLearningExports) V.bindLearningExports();
    const ex = document.querySelector('[data-export]');
    if (ex) ex.addEventListener('click', () => {
      const s = JSON.parse(JSON.stringify(BW.store.s));
      if (s.settings && s.settings.ai) s.settings.ai.key = '';
      BW.download(`bandwise-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(s, null, 1));
    });
    const im = document.querySelector('[data-import]');
    if (im) im.addEventListener('change', async () => {
      const f = im.files[0]; if (!f) return;
      if (f.size > 10 * 1024 * 1024) { BW.toast(t('importTooLarge')); im.value = ''; return; }
      try {
        const obj = JSON.parse(await f.text());
        if (!obj || !obj.profile || !Array.isArray(obj.attempts)) throw new Error('format');
        const normalized = BW.store.validate(obj);
        if (!(await BW.confirmBox(t('importConfirm'), t('importData')))) return;
        const key = BW.store.s.settings.ai.key;
        normalized.settings.ai.key = key;
        BW.store.replace(normalized);
        BW.store.save(true); BW.applyTheme(); BW.setLang(BW.lang()); BW.toast(t('imported'));
      } catch (e) { BW.toast(t('importFailed')); }
      finally { im.value = ''; }
    });
  };

  /* ---------- Study plan ---------- */
  V.plan = function () {
    const p = BW.store.s.profile;
    const days = BW.daysUntil(p.examDate);
    const form = `<div class="sheet"><div class="grid-2"><label class="field"><span>${t('examDate')}</span><input class="input" type="date" data-pf="examDate" value="${esc(p.examDate)}"></label><label class="field"><span>${t('targetBand')}</span><select class="input" data-pf="target">${[5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9].map(b => `<option value="${b}" ${b === p.target ? 'selected' : ''}>${b.toFixed(1)}</option>`).join('')}</select></label><label class="field"><span>${t('hoursPerWeek')}</span><input class="input" type="number" min="1" max="40" data-pf="hours" value="${p.hours || 6}"></label><label class="field"><span>${t('testType')}</span><select class="input" data-pf="module"><option value="academic">${t('academic')}</option><option value="general" ${p.module === 'general' ? 'selected' : ''}>${t('generalTraining')}</option></select></label></div></div>`;
    if (days == null || days < 0) return `<div class="page">${head(t('studyPlan'), t('planLede'))}${form}<p class="muted" style="margin-top:14px">${t('planNeedsDate')}</p></div>`;
    const weeks = buildPlan(days);
    const done = BW.store.s.plan.done;
    return `<div class="page">${head(t('studyPlan'), t('planSummary', { d: days, w: weeks.length, b: BW.fmtBand(p.target) }))}${form}
      ${weeks.map((w, wi) => `<div class="section"><div class="section-head"><h2 class="h3">${esc(w.title)}</h2><span class="small muted">${esc(w.focus)}</span></div><ul class="ruled">${w.items.map(it => `<li class="row"><label style="display:flex;gap:12px;align-items:flex-start;cursor:pointer"><input type="checkbox" data-plan="${esc(it.key)}" ${done[it.key] ? 'checked' : ''} style="margin-top:5px;accent-color:var(--ink);width:17px;height:17px"><span><span class="row-title" style="${done[it.key] ? 'text-decoration:line-through;color:var(--ink-3)' : ''}">${esc(it.title)}</span><span class="row-meta" style="display:block">${esc(it.day)} · ${it.min} ${t('min')}</span></span></label>${it.href ? `<a class="btn btn-sm" href="${it.href}">${t('open')}</a>` : ''}</li>`).join('')}</ul></div>`).join('')}</div>`;
  };
  function buildPlan(daysLeft) {
    const p = BW.store.s.profile, b = V.latestBands();
    const target = p.target || 7;
    const skills = ['listening', 'reading', 'writing', 'speaking'];
    const gap = k => Math.max(0.5, target - (b[k] == null ? target - 1 : b[k]));
    const tot = skills.reduce((a, k) => a + gap(k), 0);
    const perWeek = Math.max(3, Math.min(12, Math.round((p.hours || 6) * 60 / 45)));
    const nWeeks = Math.max(1, Math.min(16, Math.ceil(daysLeft / 7)));
    const acc = V.typeAccuracy();
    const weakTypes = skill => Object.entries(V.typeAccuracy(skill)).filter(([k, v]) => v[1] >= 2 && V.countGroups(k, skill).some(item => skill !== 'reading' || item.test.module === p.module)).sort((x, y) => x[1][0] / x[1][1] - y[1][0] / y[1][1]).map(([k]) => k);
    const dayNames = BW.lang() === 'ar' ? ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'] : ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'];
    const lt = D().listening || [], rt = (D().reading || []).filter(x => x.module === p.module);
    const activity = (k, i, w) => {
      if (k === 'listening') { const wt = weakTypes('listening')[i % 3]; return i % 2 && wt ? { title: t('pl_listenDrill', { type: V.typeName(wt) }), href: '#/drill/' + wt + '/listening', min: 30 } : { title: t('pl_listenPart'), href: '#/listening', min: 35 }; }
      if (k === 'reading') { const wt = weakTypes('reading')[i % 3]; return i % 2 && wt ? { title: t('pl_readDrill', { type: V.typeName(wt) }), href: '#/drill/' + wt + '/reading', min: 30 } : { title: t('pl_readPassage'), href: '#/reading', min: 40 }; }
      if (k === 'writing') return i % 2 ? { title: p.module === 'general' ? t('pl_letter') : t('pl_task1'), href: '#/writing/t1', min: 30 } : { title: t('pl_task2'), href: '#/writing/t2', min: 50 };
      return i % 2 ? { title: t('pl_speakFull'), href: '#/speak/full', min: 25 } : { title: t('pl_speakP2'), href: '#/speaking', min: 20 };
    };
    const weeks = [];
    for (let w = 0; w < nWeeks; w++) {
      const last = w === nWeeks - 1, first = w === 0;
      const items = [];
      let n = 0;
      if (first) items.push({ title: t('pl_diagnostic'), href: '#/mock', min: 170 });
      else if (last || (w % 3 === 2)) items.push({ title: t('pl_mock'), href: '#/mock', min: 170 });
      const slots = Math.max(1, perWeek - items.length - (last ? 1 : 0));
      const quota = skills.map(k => ({ k, q: gap(k) / tot * slots }));
      const order = [];
      for (let i = 0; i < slots; i++) { quota.sort((a, b2) => b2.q - a.q); order.push(quota[0].k); quota[0].q -= 1; }
      order.forEach(k => { items.push(activity(k, n++ + w, w)); });
      items.push({ title: t('pl_vocab'), href: '#/flash/due', min: 15 });
      if (last) items.push({ title: t('pl_testday'), href: '#/guide/testday', min: 15 });
      const dpw = Math.min(7, daysLeft - w * 7);
      weeks.push({
        title: last ? t('finalWeek') : t('weekN', { n: w + 1 }),
        focus: first ? t('focusDiagnose') : last ? t('focusExam') : t('focusOn', { list: skills.filter(k => gap(k) === Math.max(...skills.map(gap))).map(k => t(k)).join(', ') }),
        items: items.map((it, i) => Object.assign(it, { key: `w${w}-${i}-${it.title}`, day: dayNames[Math.min(Math.max(1, dpw) - 1, Math.floor(i * Math.max(1, dpw) / items.length))] }))
      });
    }
    return weeks;
  }
  V.bindPlan = function () {
    const main = document.getElementById('main');
    main.addEventListener('change', e => {
      const pf = e.target.dataset.pf;
      if (pf) { const p = BW.store.s.profile; p[pf] = pf === 'target' || pf === 'hours' ? +e.target.value : e.target.value; BW.store.save(true); BW.app.render(); }
      const k = e.target.dataset.plan;
      if (k) { BW.store.s.plan.done[k] = e.target.checked; if (!e.target.checked) delete BW.store.s.plan.done[k]; BW.store.save(); BW.app.render(); }
    });
  };

  /* ---------- Settings ---------- */
  V.settings = function () {
    const s = BW.store.s, p = s.profile, st = s.settings, ai = st.ai;
    const P = BW.ai.PRESETS, pre = P[ai.preset] || P.openai;
    const vby = BW.tts.describeVoices();
    const accents = [['en-GB', t('acc_GB')], ['en-AU', t('acc_AU')], ['en-US', t('acc_US')], ['en-CA', t('acc_CA')], ['en-NZ', t('acc_NZ')], ['en-IE', t('acc_IE')]];
    return `<div class="page" style="max-width:860px">${head(t('settings'))}
      <h2 class="h3">${t('profile')}</h2><div class="sheet" style="margin:10px 0 28px"><div class="grid-2">
        <label class="field"><span>${t('yourName')}</span><input class="input" data-pf="name" value="${esc(p.name)}" autocomplete="given-name"></label>
        <label class="field"><span>${t('testType')}</span><select class="input" data-pf="module"><option value="academic">${t('academic')}</option><option value="general" ${p.module === 'general' ? 'selected' : ''}>${t('generalTraining')}</option></select></label>
        <label class="field"><span>${t('targetBand')}</span><select class="input" data-pf="target">${[5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9].map(b => `<option value="${b}" ${b === p.target ? 'selected' : ''}>${b.toFixed(1)}</option>`).join('')}</select></label>
        <label class="field"><span>${t('examDate')}</span><input class="input" type="date" data-pf="examDate" value="${esc(p.examDate)}"></label></div></div>
      <h2 class="h3">${t('interface')}</h2><div class="sheet" style="margin:10px 0 28px">
        <div class="field"><span>${t('language')}</span><div class="seg" data-st="lang"><button aria-pressed="${BW.lang() === 'en'}" data-v="en">English</button><button aria-pressed="${BW.lang() === 'ar'}" data-v="ar">العربية</button></div></div>
        <div class="field"><span>${t('theme')}</span><div class="seg" data-st="theme">${[['auto', t('themeAuto')], ['light', t('themeLight')], ['dark', t('themeDark')]].map(([v, l]) => `<button aria-pressed="${st.theme === v}" data-v="${v}">${l}</button>`).join('')}</div></div>
        <div class="field"><span>${t('testTextSize')}</span><div class="seg" data-st="textSize">${[['normal', t('standard')], ['large', t('large')], ['xl', t('extraLarge')]].map(([v, l]) => `<button aria-pressed="${st.textSize === v}" data-v="${v}">${l}</button>`).join('')}</div></div>
        <div class="field"><span>${t('testColours')}</span><div class="seg" data-st="contrast">${[['default', t('blackOnWhite')], ['wb', t('whiteOnBlack')], ['yb', t('yellowOnBlack')]].map(([v, l]) => `<button aria-pressed="${st.contrast === v}" data-v="${v}">${l}</button>`).join('')}</div></div></div>
      <h2 class="h3">${t('listeningVoices')}</h2><div class="sheet" style="margin:10px 0 28px"><p class="small muted">${esc(t('voicesHelp'))}</p>
        <label class="field"><span>${t('speed')}: <output id="rateo">${st.rate || 1}</output></span><input type="range" min="0.8" max="1.2" step="0.05" value="${st.rate || 1}" data-rate style="accent-color:var(--ink)"></label>
        <ul class="ruled">${accents.map(([a, l]) => `<li class="row"><div><div class="row-title">${esc(l)}</div><div class="row-meta">${(vby[a] || []).length ? esc((vby[a] || []).map(v => v.name.replace(/^Microsoft |^Google /, '').replace(/ - English.*$/, '').replace(/ Online \(Natural\)/, ' ✦')).slice(0, 6).join(', ')) : t('noVoiceAccent')}</div></div><button class="btn btn-sm" data-voice="${a}" ${(vby[a] || []).length ? '' : 'disabled'}>${BW.icon('play')} ${t('test')}</button></li>`).join('')}</ul></div>
      <h2 class="h3" id="ai">${t('aiMarking')}</h2><div class="sheet" style="margin:10px 0 28px"><p class="small muted">${esc(t('aiHelp'))}</p>
        <div class="field"><span>${t('aiStatus')}</span><div class="seg" data-ai="provider"><button aria-pressed="${ai.provider !== 'on'}" data-v="none">${t('off')}</button><button aria-pressed="${ai.provider === 'on'}" data-v="on">${t('on')}</button></div></div>
        <div ${ai.provider === 'on' ? '' : 'hidden'}><div class="grid-2">
          <label class="field"><span>${t('aiProvider')}</span><select class="input" data-aif="preset">${Object.entries(P).map(([k, v]) => `<option value="${k}" ${k === (ai.preset || 'openai') ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select></label>
          <label class="field"><span>${t('aiModel')}</span><input class="input" data-aif="model" value="${esc(ai.model)}" placeholder="${esc(pre.model || t('aiModelHint'))}" spellcheck="false"></label>
          <label class="field"><span>${t('aiBaseUrl')}</span><input class="input" data-aif="baseUrl" value="${esc(ai.baseUrl)}" placeholder="${esc(pre.baseUrl)}" spellcheck="false"></label>
          <label class="field"><span>${t('aiKey')}</span><input class="input" type="password" data-aif="key" value="${esc(ai.key)}" placeholder="${esc(pre.keyHint)}" autocomplete="off" spellcheck="false"><small>${t('aiKeyNote')}</small></label></div>
          ${pre.local ? `<div class="notice small" style="margin-bottom:12px">${BW.icon('info')}<div>${esc(t('aiLocalNote'))}</div></div>` : ''}
          <div class="btn-row"><button class="btn" data-aitest>${t('testConnection')}</button><span class="small muted" id="aitestout"></span></div></div></div>
      <h2 class="h3">${t('data')}</h2><div class="sheet" style="margin:10px 0 28px"><p class="small muted">${t('dataHelp')}</p><div class="btn-row"><button class="btn" data-export>${BW.icon('download')} ${t('exportData')}</button><label class="btn">${BW.icon('upload')} ${t('importData')}<input type="file" accept="application/json,.json" data-import hidden></label><button class="btn btn-danger" data-reset>${t('resetAll')}</button></div></div>
      <h2 class="h3">${t('about')}</h2><div class="sheet prose small" style="margin:10px 0 28px"><p><b>Bandwise</b> ${esc(BW.VERSION)} · ${t('contentReviewed')} ${BW.fmtDate((V.guideData() || {}).lastReviewed || '', BW.lang())}</p><p>${esc(t('disclaimer'))}</p><p>${esc(t('originalContent'))}</p><p><a href="privacy.html" target="_blank" rel="noopener">${t('privacyPolicy')}</a> · <a href="mailto:haymohsen@gmail.com">haymohsen@gmail.com</a></p></div></div>`;
  };
  V.bindSettings = function () {
    const main = document.getElementById('main');
    const s = BW.store.s;
    main.addEventListener('change', e => {
      const pf = e.target.dataset.pf, aif = e.target.dataset.aif;
      if (pf) { s.profile[pf] = pf === 'target' ? +e.target.value : e.target.value; BW.store.save(true); if (pf !== 'name') BW.app.render(); }
      if (aif) { s.settings.ai[aif] = e.target.value.trim(); if (aif === 'preset') { s.settings.ai.baseUrl = ''; s.settings.ai.model = ''; } BW.store.save(true); if (aif === 'preset') BW.app.render(); }
    });
    main.addEventListener('input', e => {
      if (e.target.dataset.rate != null) { s.settings.rate = +e.target.value; document.getElementById('rateo').textContent = e.target.value; BW.store.save(); }
      if (e.target.dataset.pf === 'name') { s.profile.name = e.target.value; BW.store.save(); }
    });
    main.addEventListener('click', async e => {
      const b = e.target.closest('[data-v]');
      if (b && b.closest('[data-st]')) {
        const k = b.closest('[data-st]').dataset.st;
        if (k === 'lang') { BW.setLang(b.dataset.v); return; }
        s.settings[k] = b.dataset.v; BW.store.save(true); BW.applyTheme(); BW.app.render(); return;
      }
      if (b && b.closest('[data-ai]')) { s.settings.ai.provider = b.dataset.v; BW.store.save(true); BW.app.render(); return; }
      const v = e.target.closest('[data-voice]');
      if (v) { BW.tts.speak(t('sampleLine'), { accent: v.dataset.voice, gender: Math.random() > 0.5 ? 'male' : 'female' }); return; }
      if (e.target.closest('[data-aitest]')) {
        const out = document.getElementById('aitestout'); out.textContent = t('aiWorking');
        try { const r = await BW.ai.test(); out.textContent = t('aiOk') + (r ? ` (“${r.slice(0, 20)}”)` : ''); } catch (err) { out.textContent = t('aiError') + ' ' + err.message; }
        return;
      }
      if (e.target.closest('[data-reset]')) {
        if (await BW.confirmBox(t('resetConfirm'), t('resetAll'))) { BW.store.reset(); location.hash = '#/'; location.reload(); }
      }
    });
    V.bindData();
  };
})();
