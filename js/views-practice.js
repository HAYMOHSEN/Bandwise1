/* Bandwise — practice lists, launchers, results, drills, tips, mock exam */
(function () {
  'use strict';
  const BW = window.BW;
  const { esc } = BW;
  const t = (...a) => BW.t(...a);
  const V = BW.views;
  const D = () => BW.data;

  function best(testId) {
    const a = BW.store.s.attempts.filter(x => x.testId === testId);
    const full = a.filter(x => x.full && x.band != null);
    return { n: a.length, band: full.length ? Math.max(...full.map(x => x.band)) : null };
  }
  const head = (title, lede, extra) => `<div class="page-head"><div><h1 class="h1">${esc(title)}</h1>${lede ? `<p class="lede">${esc(lede)}</p>` : ''}</div>${extra || ''}</div>`;

  /* ---------- Listening ---------- */
  V.listening = function () {
    const tests = D().listening || [];
    let h = `<div class="page">${head(t('listening'), t('listeningLede'))}
      <div class="notice" style="margin-bottom:24px">${BW.icon('info')}<div>${esc(t('ttsNotice'))}</div></div><ul class="ruled">`;
    for (const test of tests) {
      const b = best(test.id);
      h += `<li style="padding:16px 4px"><div class="row" style="padding:0"><div><div class="row-title">${esc(test.title)}</div><div class="row-meta">${test.parts.map(p => esc(p.context.length > 70 ? p.context.slice(0, 68).replace(/\s+\S*$/, '') + '…' : p.context)).join(' · ')}</div></div>
        <div class="btn-row">${b.band != null ? `<span class="chip">${t('best')} ${BW.fmtBand(b.band)}</span>` : ''}<a class="btn btn-ink" href="#/soundcheck/${esc(test.id)}">${t('examModeBtn')}</a></div></div>
        <div class="btn-row" style="margin-top:10px"><span class="small muted">${t('practisePart')}:</span>${test.parts.map((p, i) => `<a class="btn btn-sm" href="#/test/${esc(test.id)}/practice/${i}">${t('part')} ${p.n}</a>`).join('')}</div></li>`;
    }
    h += `</ul>${tests.length ? '' : `<div class="empty">${t('noContent')}</div>`}
      <div class="section"><a class="pill-link" href="#/drills">${BW.icon('drills')} ${t('drillsByType')}</a></div></div>`;
    return h;
  };

  V.soundcheck = function (id) {
    const f = V.findTest(id);
    if (!f) return `<div class="page"><div class="empty">${t('notFound')}</div></div>`;
    const mock = !!BW.store.s.mockRun && BW.store.s.mockRun.step === 'listening';
    return `<div class="page" style="max-width:720px"><a class="back" href="#/${mock ? 'mock' : 'listening'}">${BW.icon('back')} ${t(mock ? 'mockTitle' : 'listening')}</a>${head(f.test.title, t('soundcheckLede'))}
      <ol class="prose"><li>${esc(t('sc1'))}</li><li>${esc(t('sc2'))}</li><li>${esc(t('sc3'))}</li><li>${esc(t('sc4'))}</li></ol>
      <div class="btn-row" style="margin:16px 0"><button class="btn" data-sc="play">${BW.icon('play')} ${t('playSample')}</button><span class="small muted" id="scv"></span></div>
      ${BW.tts.supported ? '' : `<div class="notice warn">${BW.icon('info')}<div>${esc(t('noTts'))}</div></div>`}
      <div class="btn-row" style="margin-top:20px"><button class="btn btn-hl" data-sc="start" data-id="${esc(id)}" ${BW.tts.supported ? '' : 'disabled'}>${t('startListeningTest')}</button></div></div>`;
  };
  V.bindSoundcheck = function () {
    document.getElementById('main').addEventListener('click', async e => {
      const b = e.target.closest('[data-sc]');
      if (!b) return;
      if (b.dataset.sc === 'play') {
        await BW.tts.ready;
        const accents = ['en-GB', 'en-AU', 'en-US', 'en-CA', 'en-NZ', 'en-IE'];
        const have = accents.filter(a => BW.tts.voices.some(v => String(v.lang).replace('_', '-') === a));
        document.getElementById('scv').textContent = t('voicesFound', { n: BW.tts.voices.length, acc: have.join(', ') || '—' });
        BW.tts.speak(t('sampleLine'), { accent: 'en-GB', gender: 'female' });
      } else if (b.dataset.sc === 'start') {
        const f = V.findTest(b.dataset.id);
        startListeningExam(f.test);
      }
    });
  };
  function startListeningExam(test) {
    const mr = BW.store.s.mockRun;
    const inMock = mr && mr.step === 'listening' && mr.listenTest === test.id;
    BW.runner.open({
      kind: 'listening', test, mode: 'exam', backTo: inMock ? '#/mock' : '#/listening',
      onFinish: inMock ? att => { mr.listening = att.id; mr.step = 'reading'; BW.store.save(true); location.hash = '#/mock'; BW.app.render(); } : null
    });
  }

  /* ---------- Reading ---------- */
  V.reading = function (tab) {
    const mod = tab || BW.store.s.profile.module || 'academic';
    const tests = (D().reading || []).filter(x => x.module === mod);
    let h = `<div class="page">${head(t('reading'), t('readingLede'))}
      <div class="tabs" role="tablist"><a role="tab" href="#/reading/academic" aria-selected="${mod === 'academic'}">${t('academic')}</a><a role="tab" href="#/reading/general" aria-selected="${mod === 'general'}">${t('generalTraining')}</a></div><ul class="ruled">`;
    for (const test of tests) {
      const b = best(test.id);
      h += `<li style="padding:16px 4px"><div class="row" style="padding:0"><div><div class="row-title">${esc(test.title)}</div><div class="row-meta">${test.sections.map(s => esc(s.title)).join(' · ')}</div></div>
        <div class="btn-row">${b.band != null ? `<span class="chip">${t('best')} ${BW.fmtBand(b.band)}</span>` : ''}<a class="btn btn-ink" href="#/test/${esc(test.id)}/exam">${t('examModeReading')}</a></div></div>
        <div class="btn-row" style="margin-top:10px"><span class="small muted">${t('practisePassage')}:</span>${test.sections.map((s, i) => `<a class="btn btn-sm" href="#/test/${esc(test.id)}/practice/${i}">${t('passage')} ${s.n}</a>`).join('')}</div></li>`;
    }
    h += `</ul>${tests.length ? '' : `<div class="empty">${t('noContent')}</div>`}<div class="section"><a class="pill-link" href="#/drills">${BW.icon('drills')} ${t('drillsByType')}</a></div></div>`;
    return h;
  };

  /* runner launcher route: #/test/:id/:mode[/:part] */
  V.launchTest = function (id, mode, part) {
    const f = V.findTest(id);
    if (!f) { location.hash = '#/'; return; }
    if (f.kind === 'listening' && mode === 'exam') { location.hash = '#/soundcheck/' + id; return; }
    const mr = BW.store.s.mockRun;
    const inMock = mr && mr.step === 'reading' && mr.readTest === id && mode === 'exam';
    BW.runner.open({
      kind: f.kind, test: f.test, mode: mode === 'exam' ? 'exam' : 'practice', parts: part != null && part !== '' ? [+part] : null,
      title: part != null && part !== '' ? `${f.test.title} · ${f.kind === 'listening' ? t('part') : t('passage')} ${+part + 1}` : f.test.title,
      backTo: inMock ? '#/mock' : '#/' + f.kind + (f.kind === 'reading' ? '/' + f.test.module : ''),
      onFinish: inMock ? att => { mr.reading = att.id; mr.step = 'writing'; BW.store.save(true); location.hash = '#/mock'; BW.app.render(); } : null
    });
  };

  /* ---------- results & review ---------- */
  V.result = function (id) {
    const a = BW.store.attempt(id);
    if (!a) return `<div class="page"><div class="empty">${t('notFound')}</div></div>`;
    const back = a.kind === 'reading' ? '#/reading/' + (a.module || '') : '#/' + a.kind;
    const pct = a.max ? Math.round(a.raw / a.max * 100) : 0;
    const types = Object.entries(a.byType || {}).sort((x, y) => x[1][0] / x[1][1] - y[1][0] / y[1][1]);
    const table = a.kind === 'listening' ? 'listening' : (a.module || 'academic');
    const rr = a.band != null && a.band >= 4 ? BW.rawRangeFor(a.band, table) : null;
    return `<div class="page"><a class="back" href="${back}">${BW.icon('back')} ${t(a.kind)}</a>
      ${head(a.title || '', `${a.mode === 'exam' ? t('examMode') : t('practiceMode')} · ${BW.fmtDate(a.date, BW.lang())}`, `<div class="btn-row"><a class="btn btn-ink" href="#/review/${esc(a.id)}">${t('reviewAnswers')}</a></div>`)}
      <div class="result-hero"><div class="result-band">${a.band != null ? BW.fmtBand(a.band) : pct + '%'}<small>${a.band != null ? t('indicativeBand') : t('partialNoBand')}</small></div>
        <div><div class="h2 num">${a.raw} / ${a.max}</div><div class="stat-line" style="margin-top:6px"><span>${t('time')}: <b>${BW.fmtClock(a.durationSec)}</b></span>${rr ? `<span>${t('rangeForBand', { lo: rr[0], hi: rr[1], b: BW.fmtBand(a.band) })}</span>` : ''}</div>
        <p class="small muted" style="margin-top:10px">${esc(t('indicativeNote'))}</p></div></div>
      <div class="section"><div class="section-head"><h2 class="h3">${t('byQuestionType')}</h2></div><div class="bars">${types.map(([k, v]) => { const p = v[1] ? v[0] / v[1] : 0; return `<div class="bar-row"><span>${esc(V.typeName(k))}</span><span class="bar-track"><i class="${p < 0.5 ? 'low' : p < 0.75 ? 'mid' : 'high'}" style="width:${Math.round(p * 100)}%"></i></span><span class="num">${v[0]}/${v[1]} ${p < 0.75 ? `<a class="small" href="#/drill/${esc(k)}">${t('drill')}</a>` : ''}</span></div>`; }).join('')}</div></div>
      <div class="section btn-row"><a class="btn btn-ink" href="#/mistakes">${BW.icon('notebook')}${esc(t('mistakeResultLink'))}</a><a class="btn" href="${a.drill ? '#/drill/' + esc(a.drill) + '/' + a.kind : `#/test/${esc(a.testId)}/${a.mode === 'exam' ? 'exam' : 'practice'}${a.parts && a.parts.length === 1 ? '/' + a.parts[0] : ''}`}">${t('tryAgain')}</a><a class="btn btn-ghost" href="#/tips">${t('strategies')}</a></div></div>`;
  };
  V.review = function (id) {
    const a = BW.store.attempt(id);
    if (!a) { location.hash = '#/'; return; }
    if (a.drillRef) {
      const items = a.drillRef.map(r => { const f = V.findTest(r.testId); if (!f) return null; const sec = f.kind === 'listening' ? f.test.parts[r.si] : f.test.sections[r.si]; const group = sec.groups.find(g => g.id === r.gid); return group ? { test: f.test, si: r.si, group } : null; }).filter(Boolean);
      if (!items.length) { location.hash = '#/mistakes'; return; }
      BW.runner.open({ kind: a.kind, test: items[0].test, drill: { type: a.drill, items }, mode: 'practice', review: true, answers: a.answers, title: t('drillTitle', { type: V.typeName(a.drill) }), backTo: '#/result/' + id, noSave: true });
      return;
    }
    const f = V.findTest(a.testId);
    if (!f) { location.hash = '#/'; return; }
    BW.runner.open({ kind: f.kind, test: f.test, mode: a.mode, parts: a.parts, review: true, answers: a.answers, title: a.title, backTo: '#/result/' + id, noSave: true });
  };

  /* ---------- Writing ---------- */
  V.writingList = function (tab) {
    const W = D().writing || {};
    const mod = BW.store.s.profile.module;
    tab = tab || 't1';
    const recs = BW.store.s.writing;
    const lastBand = id => { const r = recs.filter(x => x.taskId === id && x.text.trim()); return r.length ? BW.writing.bandOf(r[r.length - 1]).band : null; };
    const row = (kind, it, chip) => { const lb = lastBand(it.id); return `<li><a class="row" href="#/write/${esc(it.id)}"><div><div class="btn-row" style="gap:8px"><span class="chip">${esc(chip)}</span>${lb != null ? `<span class="chip ok">${t('last')} ${BW.fmtBand(lb)}</span>` : ''}${it.model ? `<span class="chip">${t('hasModel')}</span>` : ''}</div><div class="row-meta" lang="en" style="margin-top:6px;color:var(--ink)">${esc(it.prompt.length > 180 ? it.prompt.slice(0, 177) + '…' : it.prompt)}</div></div><span class="btn btn-sm">${t('write')}</span></a></li>`; };
    let h = `<div class="page">${head(t('writing'), t('writingLede'), `<button class="btn btn-ink" data-fullwriting>${BW.icon('mock')} ${t('fullWritingTest')}</button>`)}
      <div class="tabs" role="tablist"><a role="tab" href="#/writing/t1" aria-selected="${tab === 't1'}">${mod === 'general' ? t('gtTask1') : t('academicTask1')}</a><a role="tab" href="#/writing/t1other" aria-selected="${tab === 't1other'}">${mod === 'general' ? t('academicTask1') : t('gtTask1')}</a><a role="tab" href="#/writing/t2" aria-selected="${tab === 't2'}">${t('task2')}</a><a role="tab" href="#/writing/history" aria-selected="${tab === 'history'}">${t('history')}</a></div>`;
    const showGT = (tab === 't1' && mod === 'general') || (tab === 't1other' && mod !== 'general');
    if (tab === 't1' || tab === 't1other') {
      h += `<ul class="ruled">${showGT ? (W.generalTask1 || []).map(it => row('gt1', it, t('tone_' + it.tone))).join('') : (W.academicTask1 || []).map(it => row('at1', it, t('vis_' + (it.chart && it.chart.type) || 'chart'))).join('')}</ul>`;
    } else if (tab === 't2') {
      h += `<ul class="ruled">${(W.task2 || []).map(it => row('t2', it, `${t('et_' + it.essayType)} · ${it.topic}`)).join('')}</ul>`;
    } else {
      const list = recs.slice().reverse();
      h += list.length ? `<ul class="ruled">${list.map(r => { const b = BW.writing.bandOf(r); return `<li><a class="row" href="#/writing-result/${esc(r.id)}"><div><div class="row-title">${esc(BW.writing.kindName(r.taskKind))}</div><div class="row-meta">${BW.fmtDate(r.date, BW.lang())} · ${r.wc} ${t('words')}</div></div><span class="skill-band">${BW.fmtBand(b.band)}</span></a></li>`; }).join('')}</ul>` : `<div class="empty">${t('noWritingYet')}</div>`;
    }
    return h + '</div>';
  };
  V.bindWritingList = function () {
    const b = document.querySelector('[data-fullwriting]');
    if (b) b.addEventListener('click', () => startFullWriting());
  };
  function pickFresh(arr, kindKey) {
    const done = new Set(BW.store.s.writing.map(r => r.taskId));
    const fresh = arr.filter(x => !done.has(x.id));
    return BW.shuffle(fresh.length ? fresh : arr)[0];
  }
  function startFullWriting(mockRun) {
    const W = D().writing, mod = BW.store.s.profile.module;
    const t1 = mockRun ? findAny(mockRun.t1) : (mod === 'general' ? BW.writing.info('gt1', pickFresh(W.generalTask1)) : BW.writing.info('at1', pickFresh(W.academicTask1)));
    const t2 = mockRun ? findAny(mockRun.t2) : BW.writing.info('t2', pickFresh(W.task2));
    BW.writing.open({
      tasks: [t1, t2], minutes: 60, mode: 'exam', delivery: (mockRun && mockRun.delivery) || 'computer', title: t('writingTest'), mockId: mockRun ? mockRun.id : null,
      onFinish: mockRun ? ids => { mockRun.writing = ids; mockRun.step = 'speaking'; BW.store.save(true); location.hash = '#/mock'; BW.app.render(); } : ids => { location.hash = '#/writing-result/' + ids[1]; }
    });
  }
  const findAny = id => BW.writing.findTask(id);

  V.writeSetup = function (id) {
    const ti = BW.writing.findTask(id);
    if (!ti) return `<div class="page"><div class="empty">${t('notFound')}</div></div>`;
    const draft = BW.store.s.drafts['w:' + id];
    return `<div class="page" style="max-width:900px"><a class="back" href="#/writing/${ti.kind === 't2' ? 't2' : 't1'}">${BW.icon('back')} ${t('writing')}</a>${head(BW.writing.kindName(ti.kind), t('writeSetupLede', { m: ti.minutes, n: ti.minWords }))}
      <div class="sheet" style="background:#fff;color:#111;margin-bottom:22px">${BW.writing.promptHTML(ti)}</div>
      <div class="grid-2"><div class="field"><span>${t('answerOn')}</span><div class="seg" data-opt="delivery"><button aria-pressed="true" data-v="computer">${t('onComputer')}</button><button aria-pressed="false" data-v="paper">${t('writingOnPaper')}</button></div><small>${t('wopHint')}</small></div>
      <div class="field"><span>${t('timing')}</span><div class="seg" data-opt="timed"><button aria-pressed="true" data-v="1">${t('timedMinutes', { m: ti.minutes })}</button><button aria-pressed="false" data-v="0">${t('untimed')}</button></div></div></div>
      <div class="btn-row">${draft ? `<span class="chip">${t('draftSaved', { n: BW.words(draft) })}</span>` : ''}<button class="btn btn-hl" data-startwrite="${esc(id)}">${t('startWriting')}</button></div>
      ${(D().strategies || {}).writing ? writingTip(ti) : ''}</div>`;
  };
  function writingTip(ti) {
    const ws = D().strategies.writing;
    const key = ti.kind === 't2' ? 'task2_' + ti.essayType : ti.kind === 'gt1' ? 'gt_letter_' + (ti.tone === 'semi-formal' ? 'semiformal' : ti.tone) :
      'academic_task1_' + ({ line: 'trend', bar: 'comparison', pie: 'comparison', table: 'comparison', mixed: 'comparison', process: 'process', map: 'map' }[ti.visual] || 'trend');
    const s = ws[key];
    if (!s) return '';
    const b = BW.lang() === 'ar' && s.ar ? s.ar : s.en;
    return `<div class="section"><details class="more" open><summary>${t('howToApproach')}: ${esc(BW.lang() === 'ar' && s.ar && s.ar.name ? s.ar.name : s.name)}</summary><p class="prose">${esc(b.what)}</p><ol class="prose">${(b.steps || []).map(x => `<li>${esc(x)}</li>`).join('')}</ol>${(b.traps || []).length ? `<p><b>${t('commonTraps')}</b></p><ul class="prose">${b.traps.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</details></div>`;
  }
  V.bindWriteSetup = function () {
    const main = document.getElementById('main');
    const opt = { delivery: 'computer', timed: '1' };
    main.addEventListener('click', e => {
      const b = e.target.closest('[data-v]');
      if (b && b.closest('[data-opt]')) { const seg = b.closest('[data-opt]'); opt[seg.dataset.opt] = b.dataset.v; BW.$$('button', seg).forEach(x => x.setAttribute('aria-pressed', x === b)); }
      const s = e.target.closest('[data-startwrite]');
      if (s) {
        const ti = BW.writing.findTask(s.dataset.startwrite);
        BW.writing.open({ tasks: [ti], mode: opt.timed === '1' ? 'exam' : 'practice', minutes: opt.timed === '1' ? ti.minutes : null, delivery: opt.delivery, title: BW.writing.kindName(ti.kind) });
      }
    });
  };

  /* ---------- Speaking ---------- */
  V.speakingList = function () {
    const sp = D().speaking || {};
    const past = BW.store.s.speaking.slice().reverse();
    return `<div class="page">${head(t('speaking'), t('speakingLede'), `<a class="btn btn-ink" href="#/speak/full">${BW.icon('mic')} ${t('fullSpeakingTest')}</a>`)}
      <div class="notice" style="margin-bottom:24px">${BW.icon('info')}<div>${esc(t('speakingNotice'))}</div></div>
      <div class="cols"><div><h2 class="h3">${t('part1Title')}</h2><p class="small muted">${t('part1Sub')}</p><ul class="ruled">${(sp.part1 || []).map((tp, i) => `<li><a class="row" href="#/speak/part1/${i}"><span>${esc(tp.topic)}</span><span class="small muted">${tp.questions.length} ${t('questionsWord')}</span></a></li>`).join('')}</ul></div>
      <div><h2 class="h3">${t('part2Title')}</h2><p class="small muted">${t('part2Sub')}</p><ul class="ruled">${(sp.part2 || []).map(c => `<li><a class="row" href="#/speak/part2/${esc(c.id)}"><span lang="en">${esc(c.cue)}</span><span class="small muted">${t('p2p3')}</span></a></li>`).join('')}</ul></div></div>
      ${past.length ? `<div class="section"><h2 class="h3">${t('pastSessions')}</h2><ul class="ruled">${past.map(r => { const b = BW.speaking.bandOf(r); return `<li><a class="row" href="#/speaking-result/${esc(r.id)}"><div><div class="row-title">${esc(t('sp_mode_' + r.mode))}</div><div class="row-meta">${BW.fmtDate(r.date, BW.lang())} · ${r.items.length} ${t('answersWord')}</div></div><span class="skill-band">${BW.fmtBand(b.band)}</span></a></li>`; }).join('')}</ul></div>` : ''}</div>`;
  };
  V.launchSpeak = function (mode, ref) {
    const sp = D().speaking || {};
    const o = { mode: mode || 'full' };
    if (mode === 'part1' && ref != null) o.topic = sp.part1[+ref];
    if ((mode === 'part2' || mode === 'part3' || mode === 'full') && ref) o.card = sp.part2.find(c => c.id === ref);
    if (mode === 'part2') o.alsoPart3 = true;
    const mr = BW.store.s.mockRun;
    if (mr && mr.step === 'speaking' && mode === 'full') o.onFinish = id => { mr.speaking = id; mr.step = 'done'; BW.store.save(true); location.hash = '#/mock'; BW.app.render(); };
    BW.speaking.open(o);
  };

  /* ---------- Drills & tips ---------- */
  const READ_TYPES = ['tfng', 'ynng', 'mcq', 'mcq_multi', 'matching_headings', 'matching_info', 'matching_features', 'matching_endings', 'sentence_completion', 'summary_completion', 'summary_wordbank', 'note_completion', 'table_completion', 'flowchart_completion', 'diagram_labelling', 'short_answer'];
  const LIST_TYPES = ['form_completion', 'note_completion', 'table_completion', 'flowchart_completion', 'sentence_completion', 'summary_completion', 'short_answer', 'mcq', 'mcq_multi', 'matching', 'map_labelling', 'diagram_labelling'];
  V.drills = function (skill) {
    skill = skill || 'reading';
    const acc = V.typeAccuracy(skill);
    const types = skill === 'reading' ? READ_TYPES : LIST_TYPES;
    const st = (D().strategies || {}).questionTypes || {};
    return `<div class="page">${head(t('drills'), t('drillsLede'))}
      <div class="tabs"><a href="#/drills/reading" aria-selected="${skill === 'reading'}">${t('reading')}</a><a href="#/drills/listening" aria-selected="${skill === 'listening'}">${t('listening')}</a></div>
      <ul class="ruled">${types.map(k => {
        const groups = V.countGroups(k, skill).filter(item => skill !== 'reading' || item.test.module === BW.store.s.profile.module);
        const a = acc[k];
        const s = st[k];
        const blk = s ? (BW.lang() === 'ar' && s.ar ? s.ar : s.en) : null;
        return `<li style="padding:14px 4px"><div class="row" style="padding:0"><div><div class="row-title">${esc(V.typeName(k))}</div><div class="row-meta">${groups.length === 1 ? t('nSet') : t('nSets', { n: groups.length })}${a ? ` · ${t('yourAccuracy')} ${Math.round(a[0] / a[1] * 100)}% (${a[0]}/${a[1]})` : ''}</div></div>
          <div class="btn-row">${groups.length ? `<a class="btn btn-sm btn-ink" href="#/drill/${k}/${skill}">${t('startDrill')}</a>` : ''}</div></div>
          ${blk ? `<details class="more" style="margin-top:8px;border:0;padding:0"><summary class="small">${t('strategy')}</summary><p class="small">${esc(blk.what)}</p><ol class="small">${(blk.steps || []).map(x => `<li>${esc(x)}</li>`).join('')}</ol>${(blk.traps || []).length ? `<p class="small"><b>${t('commonTraps')}</b></p><ul class="small">${blk.traps.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</details>` : ''}</li>`;
      }).join('')}</ul></div>`;
  };
  V.launchDrill = function (type, skill) {
    let groups = V.countGroups(type, skill || null).filter(item => item.kind !== 'reading' || item.test.module === BW.store.s.profile.module);
    if (!skill && groups.length) skill = groups[0].kind;
    groups = groups.filter(g => g.kind === skill);
    if (!groups.length) { BW.toast(t('noContent')); location.hash = '#/drills'; return; }
    const mod = BW.store.s.profile.module;
    const pref = groups.filter(g => g.kind !== 'reading' || g.test.module === mod);
    if (!pref.length) { BW.toast(t('noContent')); location.hash = '#/drills/' + skill; return; }
    const items = BW.shuffle(pref).slice(0, skill === 'listening' ? 1 : 3);
    BW.runner.open({ kind: skill, test: items[0].test, drill: { type, items }, mode: 'practice', title: t('drillTitle', { type: V.typeName(type) }), backTo: '#/drills/' + skill });
  };

  V.tips = function (tab) {
    tab = tab || 'reading';
    const st = D().strategies || {};
    const lang = BW.lang();
    const block = (s, name) => { if (!s) return ''; const b = lang === 'ar' && s.ar ? s.ar : s.en; const nm = lang === 'ar' && s.ar && s.ar.name ? s.ar.name : (s.name || name); return `<li style="padding:16px 4px"><h3 class="h4">${esc(nm)}</h3><p class="small muted" style="margin:4px 0 8px">${esc(b.what || '')}</p><ol class="small">${(b.steps || []).map(x => `<li>${esc(x)}</li>`).join('')}</ol>${(b.traps || []).length ? `<div class="small"><b>${t('commonTraps')}:</b> ${b.traps.map(esc).join(' · ')}</div>` : ''}</li>`; };
    let body = '';
    if (tab === 'reading' || tab === 'listening') {
      const keys = Object.keys(st.questionTypes || {}).filter(k => { const s = st.questionTypes[k].skill; return s === tab || s === 'both'; });
      if (tab === 'listening') body += Object.values(st.listening || {}).map(s => block(s)).join('');
      body += keys.map(k => block(st.questionTypes[k], k)).join('');
    } else if (tab === 'writing') body = Object.values(st.writing || {}).map(s => block(s)).join('');
    else if (tab === 'speaking') body = Object.values(st.speaking || {}).map(s => block(s)).join('');
    else body = (st.mistakes || []).map(m => `<li class="row" style="grid-template-columns:1fr 1fr"><div><span class="chip bad">✗</span> <span lang="en">${esc(m.wrong)}</span><br><span class="chip ok">✓</span> <b lang="en">${esc(m.right)}</b></div><div class="small muted">${esc(lang === 'ar' && m.whyAr ? m.whyAr : m.why)}</div></li>`).join('');
    const tabs = [['reading', t('reading')], ['listening', t('listening')], ['writing', t('writing')], ['speaking', t('speaking')], ['mistakes', t('commonMistakes')]];
    return `<div class="page">${head(t('strategies'), t('tipsLede'))}<div class="tabs">${tabs.map(([k, l]) => `<a href="#/tips/${k}" aria-selected="${tab === k}">${esc(l)}</a>`).join('')}</div><ul class="ruled">${body || `<li class="empty">${t('noContent')}</li>`}</ul></div>`;
  };

  /* ---------- Mock exam ---------- */
  V.mock = function () {
    const mr = BW.store.s.mockRun;
    const mod = BW.store.s.profile.module;
    if (!mr) {
      return `<div class="page" style="max-width:820px">${head(t('mockTitle'), t('mockLede'))}
        <ol class="ruled" style="list-style:none;padding:0">${[['listening', t('mockL')], ['reading', t('mockR')], ['writing', t('mockW')], ['speaking', t('mockS')]].map(([k, d], i) => `<li class="row" style="grid-template-columns:40px 1fr"><span class="skill-band" style="text-align:start">${i + 1}</span><span><span class="row-title">${t(k)}</span><span class="row-meta" style="display:block">${esc(d)}</span></span></li>`).join('')}</ol>
        <div class="field" style="margin-top:20px"><span>${t('testType')}</span><div class="seg" data-mockmod><button aria-pressed="${mod !== 'general'}" data-v="academic">${t('academic')}</button><button aria-pressed="${mod === 'general'}" data-v="general">${t('generalTraining')}</button></div></div>
        <div class="field"><span>${t('writingAnswerOn')}</span><div class="seg" data-mockdel><button aria-pressed="true" data-v="computer">${t('onComputer')}</button><button aria-pressed="false" data-v="paper">${t('writingOnPaper')}</button></div></div>
        <div class="notice" style="margin:8px 0 20px">${BW.icon('info')}<div>${esc(t('mockNotice'))}</div></div>
        <button class="btn btn-hl" data-mock="start">${t('startMock')}</button></div>`;
    }
    const steps = ['listening', 'reading', 'writing', 'speaking', 'done'];
    const idx = steps.indexOf(mr.step);
    const bar = `<ol class="btn-row" style="list-style:none;padding:0;margin:0 0 20px">${steps.slice(0, 4).map((s, i) => `<li class="chip ${i < idx ? 'ok' : i === idx ? 'hl' : ''}">${i + 1}. ${t(s)}</li>`).join('')}</ol>`;
    let body = '';
    if (mr.step === 'listening') body = `<h2 class="h2">${t('listening')}</h2><p class="lede">${esc(t('mockL'))}</p><a class="btn btn-hl" style="margin-top:16px" href="#/soundcheck/${esc(mr.listenTest)}">${t('goToSoundcheck')}</a>`;
    else if (mr.step === 'reading') body = `<h2 class="h2">${t('reading')}</h2><p class="lede">${esc(t('mockR'))}</p><a class="btn btn-hl" style="margin-top:16px" href="#/test/${esc(mr.readTest)}/exam">${t('startReading')}</a>`;
    else if (mr.step === 'writing') body = `<h2 class="h2">${t('writing')}</h2><p class="lede">${esc(t('mockW'))}</p><button class="btn btn-hl" style="margin-top:16px" data-mock="writing">${t('startWritingTest')}</button>`;
    else if (mr.step === 'speaking') body = `<h2 class="h2">${t('speaking')}</h2><p class="lede">${esc(t('mockS'))}</p><div class="btn-row" style="margin-top:16px"><a class="btn btn-hl" href="#/speak/full">${t('startSpeaking')}</a><button class="btn" data-mock="skipspeak">${t('skipSpeaking')}</button></div>`;
    else body = mockResult(mr);
    return `<div class="page" style="max-width:900px">${head(t('mockTitle'), '', `<button class="btn btn-sm btn-danger" data-mock="abandon">${mr.step === 'done' ? t('finishMock') : t('abandonMock')}</button>`)}${bar}${body}</div>`;
  };
  function mockResult(mr) {
    const L = mr.listening ? BW.store.attempt(mr.listening) : null, R = mr.reading ? BW.store.attempt(mr.reading) : null;
    const wr = (mr.writing || []).map(id => BW.store.s.writing.find(r => r.id === id)).filter(Boolean);
    const t1 = wr.find(r => r.taskKind !== 't2'), t2 = wr.find(r => r.taskKind === 't2');
    const wb = BW.writingBand(t1 ? BW.writing.bandOf(t1).band : null, t2 ? BW.writing.bandOf(t2).band : null);
    const sp = mr.speaking ? BW.store.s.speaking.find(r => r.id === mr.speaking) : null;
    const sb = sp && BW.speaking.bandOf(sp).band != null ? BW.speaking.bandOf(sp).band : (mr.speakingSelf != null ? mr.speakingSelf : null);
    const lb = L ? L.band : null, rb = R ? R.band : null;
    const ov = BW.overallBand(lb, rb, wb, sb);
    const row = (k, b, href, note) => `<li class="skill-row mock-row"><span class="skill-name">${BW.icon(k)}${t(k)}</span>${BW.charts.miniRuler(b, BW.store.s.profile.target)}<span class="skill-band">${BW.fmtBand(b)}</span><span class="btn-row">${href ? `<a class="btn btn-sm" href="${href}">${t('details')}</a>` : ''}${note ? `<span class="small muted">${esc(note)}</span>` : ''}</span></li>`;
    return `<div class="result-hero"><div class="result-band">${ov ? BW.fmtBand(ov.band) : '–'}<small>${ov ? t('mockOverall') : t('mockIncomplete')}</small></div><div><p class="prose">${esc(t('mockResultNote'))}</p></div></div>
      <ul class="ruled section">${row('listening', lb, L ? '#/result/' + L.id : null)}${row('reading', rb, R ? '#/result/' + R.id : null)}${row('writing', wb, t2 ? '#/writing-result/' + t2.id : t1 ? '#/writing-result/' + t1.id : null, wb == null ? t('rateWritingFirst') : '')}${row('speaking', sb, sp ? '#/speaking-result/' + sp.id : null, sb == null && sp ? t('rateSpeakingFirst') : '')}</ul>
      ${!sp || BW.speaking.bandOf(sp).band == null ? `<label class="field" style="max-width:360px"><span>${t('speakingSelfMock')}</span><select class="input" data-mockspeak><option value="">—</option>${[9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5, 4.5, 4].map(v => `<option value="${v}" ${mr.speakingSelf === v ? 'selected' : ''}>${v.toFixed(1)}</option>`).join('')}</select></label>` : ''}
      ${t1 ? `<p class="small"><a href="#/writing-result/${esc(t1.id)}">${t('task1Result')}</a> · ${t2 ? `<a href="#/writing-result/${esc(t2.id)}">${t('task2Result')}</a>` : ''}</p>` : ''}`;
  }
  V.bindMock = function () {
    const main = document.getElementById('main');
    main.addEventListener('change', e => {
      if (e.target.matches('[data-mockspeak]') && BW.store.s.mockRun) { BW.store.s.mockRun.speakingSelf = e.target.value === '' ? null : +e.target.value; BW.store.save(true); BW.app.render(); }
    });
    const sel = { module: BW.store.s.profile.module || 'academic', delivery: 'computer' };
    main.addEventListener('click', async e => {
      const seg = e.target.closest('[data-mockmod] [data-v], [data-mockdel] [data-v]');
      if (seg) { const p = seg.parentElement; BW.$$('button', p).forEach(x => x.setAttribute('aria-pressed', x === seg)); if (p.hasAttribute('data-mockmod')) sel.module = seg.dataset.v; else sel.delivery = seg.dataset.v; return; }
      const b = e.target.closest('[data-mock]');
      if (!b) return;
      const a = b.dataset.mock;
      if (a === 'start') {
        const used = new Set(BW.store.s.attempts.map(x => x.testId));
        const fresh = arr => arr.filter(x => !used.has(x.id)).concat(arr.filter(x => used.has(x.id)));
        const lt = fresh(D().listening || [])[0], rt = fresh((D().reading || []).filter(x => x.module === sel.module))[0];
        const W = D().writing;
        const t1 = sel.module === 'general' ? pickFresh(W.generalTask1) : pickFresh(W.academicTask1);
        const t2 = pickFresh(W.task2);
        if (!lt || !rt || !t1 || !t2) { BW.toast(t('noContent')); return; }
        BW.store.s.mockRun = { id: BW.uid(), started: new Date().toISOString(), module: sel.module, delivery: sel.delivery, step: 'listening', listenTest: lt.id, readTest: rt.id, t1: t1.id, t2: t2.id };
        BW.store.save(true); BW.app.render();
      } else if (a === 'writing') startFullWriting(BW.store.s.mockRun);
      else if (a === 'skipspeak') { BW.store.s.mockRun.step = 'done'; BW.store.save(true); BW.app.render(); }
      else if (a === 'abandon') {
        const mr = BW.store.s.mockRun;
        if (mr.step !== 'done' && !(await BW.confirmBox(t('abandonConfirm'), t('abandonMock'), t('keepGoing')))) return;
        if (mr.step === 'done') BW.store.addAttempt({ kind: 'mock', title: t('mockTitle'), refs: mr, date: new Date().toISOString() });
        BW.store.s.mockRun = null; BW.store.save(true); BW.app.render();
      }
    });
  };
})();
