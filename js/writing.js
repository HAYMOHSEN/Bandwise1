/* Bandwise — Writing practice (computer or paper), offline checks, self-marking, optional AI marking */
(function () {
  'use strict';
  const BW = window.BW;
  const { esc, $, $$ } = BW;
  const t = (...a) => BW.t(...a);

  function info(kind, item) {
    if (kind === 'at1') return { kind, item, id: item.id, minWords: 150, minutes: 20, visual: item.chart && item.chart.type, label: 'Academic Writing Task 1', promptText: item.prompt, visualText: BW.charts.describe(item.chart) };
    if (kind === 'gt1') return { kind, item, id: item.id, minWords: 150, minutes: 20, tone: item.tone, label: `General Training Writing Task 1 (${item.tone} letter)`, promptText: item.prompt + ' ' + (item.bullets || []).map(b => '• ' + b).join(' ') + (item.opening ? ` Begin your letter: ${item.opening}` : '') };
    return { kind: 't2', item, id: item.id, minWords: 250, minutes: 40, essayType: item.essayType, label: `Writing Task 2 (${(item.essayType || '').replace('_', ' ')} essay)`, promptText: item.prompt };
  }
  function findTask(id) {
    const W = BW.data.writing;
    let it = (W.academicTask1 || []).find(x => x.id === id); if (it) return info('at1', it);
    it = (W.generalTask1 || []).find(x => x.id === id); if (it) return info('gt1', it);
    it = (W.task2 || []).find(x => x.id === id); if (it) return info('t2', it);
    return null;
  }
  const kindName = k => k === 'at1' ? t('academicTask1') : k === 'gt1' ? t('gtTask1') : t('task2');

  function promptHTML(ti, n) {
    const it = ti.item;
    let h = `<div class="task-prompt" lang="en"><div class="xf-sub" style="margin-bottom:6px"><b>${t('writingTask')} ${n || (ti.kind === 't2' ? 2 : 1)}</b></div><p style="margin:0 0 8px">${t('spendAbout', { m: ti.minutes })}</p>`;
    if (ti.kind === 't2') h += `<p style="margin:0 0 6px">${esc(t('writeAboutTopic'))}</p><p style="margin:0 0 8px;font-weight:700">${esc(it.prompt)}</p><p style="margin:0">${esc(t('t2Rubric'))}</p>`;
    else h += `<p style="margin:0">${esc(it.prompt)}</p>`;
    if (ti.kind === 'gt1') h += `<ul>${(it.bullets || []).map(b => `<li>${esc(b)}</li>`).join('')}</ul><p class="inst">${esc(t('gtRubric'))}</p>${it.opening ? `<p style="margin:6px 0 0">${esc(t('beginLetter'))}</p><p style="margin:4px 0 0"><b>${esc(it.opening)}</b></p>` : ''}`;
    else h += `<p class="inst">${esc(t('writeAtLeast', { n: ti.minWords }))}</p>`;
    h += '</div>';
    if (ti.kind === 'at1') h += BW.charts.render(it.chart, { tips: false });
    return h;
  }

  /* ---------- writing session (one task or the full 60-minute test) ---------- */
  let W = null;
  function open(o) {
    // o: {tasks:[taskInfo], minutes, mode:'exam'|'practice', delivery:'computer'|'paper', onFinish, backTo}
    close();
    W = Object.assign({ cur: 0, texts: o.tasks.map(ti => (BW.store.s.drafts['w:' + ti.id] || '')), start: Date.now() }, o);
    W.deadline = W.mode === 'exam' || W.minutes ? Date.now() + (W.minutes || W.tasks.reduce((a, ti) => a + ti.minutes, 0)) * 60000 : null;
    document.body.classList.add('exam-mode');
    draw();
    W.timer = setInterval(tick, 1000);
    W.beforeUnload = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', W.beforeUnload);
  }
  function draw() {
    const ti = W.tasks[W.cur];
    const paper = W.delivery === 'paper';
    const host = document.getElementById('main');
    const st = BW.store.s.settings;
    host.innerHTML = `<div class="xf write-frame ${st.contrast === 'wb' ? 'c-wb' : st.contrast === 'yb' ? 'c-yb' : ''} ${st.textSize === 'large' ? 'ts-l' : st.textSize === 'xl' ? 'ts-xl' : ''}" id="xf" dir="ltr">
      <header class="xf-top"><div><div class="xf-title">${esc(W.title || t('writing'))}</div><div class="xf-sub">${paper ? t('writingOnPaper') : t('onComputer')} · ${W.mode === 'exam' ? t('examMode') : t('practiceMode')}</div></div>
        <div class="xf-timer" id="xtimer"></div>
        <button class="xf-btn pane-switch" data-w="pane">${t('taskAnswer')}</button>
        ${paper ? `<button class="xf-btn" data-w="print">${t('printSheet')}</button>` : ''}
        <button class="xf-btn primary" data-w="finish">${t('finishWriting')}</button></header>
      <div class="xf-body split-mobile">
        <section class="xf-pane prompt-pane ${W.pane !== 'a' ? 'show' : ''}" id="wp">${promptHTML(ti, W.tasks.length > 1 ? W.cur + 1 : null)}</section>
        <section class="xf-pane ${W.pane === 'a' ? 'show' : ''}" id="wa" lang="en">
          ${paper ? `<div class="task-prompt"><p style="margin:0 0 8px"><b>${t('paperModeTitle')}</b></p><p style="margin:0">${esc(t('paperModeText'))}</p></div>
            <label class="xf-sub" for="ed">${t('paperTypeIn')}</label>` : ''}
          <textarea id="ed" class="editor" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="sentences" aria-label="${t('yourAnswer')}" placeholder="${paper ? '' : t('startTyping')}">${esc(W.texts[W.cur])}</textarea>
          <div class="wc"><span>${t('wordCount')}: <b id="wcn">${BW.words(W.texts[W.cur])}</b></span><span>${t('minimum')}: ${ti.minWords}</span></div>
        </section>
      </div>
      <footer class="xf-nav">${W.tasks.map((x, i) => `<div class="part ${i === W.cur ? 'on' : ''}"><span data-wt="${i}">${t('writingTask')} ${x.kind === 't2' ? 2 : 1}</span><button class="qdot ${BW.words(W.texts[i]) ? 'done' : ''} ${i === W.cur ? 'cur' : ''}" data-wt="${i}">${x.kind === 't2' ? 2 : 1}</button></div>`).join('')}<span class="spacer"></span><span class="xf-sub">${t('wordCount')}: ${W.tasks.map((x, i) => BW.words(W.texts[i])).join(' / ')}</span></footer>
      <div class="print-sheet"><h2>${esc(W.title || '')}</h2>${promptHTML(ti)}<div class="print-lines"></div></div>
    </div>`;
    const ed = $('#ed');
    ed.addEventListener('input', () => {
      W.texts[W.cur] = ed.value;
      $('#wcn').textContent = BW.words(ed.value);
      BW.store.s.drafts['w:' + ti.id] = ed.value; BW.store.save();
    });
    // like the real test: no spell-check or auto-correct (spellcheck=false on the editor)
    $('#xf').addEventListener('click', onClick);
    tick();
    if (!paper && W.pane === 'a') ed.focus();
  }
  function tick() {
    const el = $('#xtimer'); if (!el || !W) return;
    if (W.deadline) {
      const left = Math.max(0, W.deadline - Date.now()) / 1000;
      el.textContent = t('minutesLeft', { m: Math.ceil(left / 60) });
      el.classList.toggle('danger', left <= 300);
      if (!W.w10 && left <= 600 && W.minutes >= 30) { W.w10 = true; BW.toast(t('tenMinutes')); }
      if (!W.w5 && left <= 300) { W.w5 = true; BW.toast(t('fiveMinutes')); }
      if (left <= 0) finish(true);
    } else el.textContent = t('elapsed', { t: BW.fmtClock((Date.now() - W.start) / 1000) });
  }
  async function onClick(e) {
    const b = e.target.closest('[data-w],[data-wt]');
    if (!b) return;
    if (b.dataset.wt != null) { W.cur = +b.dataset.wt; draw(); return; }
    const a = b.dataset.w;
    if (a === 'pane') { W.pane = W.pane === 'a' ? 'p' : 'a'; $('#wp').classList.toggle('show', W.pane !== 'a'); $('#wa').classList.toggle('show', W.pane === 'a'); }
    else if (a === 'print') window.print();
    else if (a === 'finish') {
      const short = W.tasks.some((ti, i) => W.delivery !== 'paper' && BW.words(W.texts[i]) < ti.minWords);
      if (!(await BW.confirmBox(short ? t('finishShort') : t('finishConfirm'), t('finishWriting'), t('keepWorking')))) return;
      finish(false);
    }
  }
  function finish(auto) {
    if (!W) return;
    const sess = W;
    const dur = Math.round((Date.now() - sess.start) / 1000);
    const ids = sess.tasks.map((ti, i) => {
      const text = sess.texts[i] || '';
      const rec = {
        id: BW.uid(), date: new Date().toISOString(), taskKind: ti.kind, taskId: ti.id, text, wc: BW.words(text),
        delivery: sess.delivery, mode: sess.mode, durationSec: dur, analysis: text.trim() ? BW.analyzer.analyze(text, ti) : null, self: null, ai: null, mockId: sess.mockId || null
      };
      BW.store.s.writing.push(rec);
      delete BW.store.s.drafts['w:' + ti.id];
      return rec.id;
    });
    BW.store.save(true);
    close();
    if (auto) BW.toast(t('timeUpSaved'));
    if (sess.onFinish) sess.onFinish(ids); else location.hash = '#/writing-result/' + ids[0];
  }
  function close() {
    if (!W) return;
    clearInterval(W.timer);
    window.removeEventListener('beforeunload', W.beforeUnload);
    document.body.classList.remove('exam-mode');
    W = null;
  }

  /* ---------- result page ---------- */
  function bandOf(rec) {
    if (rec.ai && Number.isFinite(rec.ai.overall) && rec.ai.overall >= 0 && rec.ai.overall <= 9) return { band: rec.ai.overall, src: 'ai' };
    if (rec.self && Number.isFinite(rec.self.task) && rec.self.task >= 0 && rec.self.task <= 9) return { band: rec.self.task, src: 'self' };
    if (rec.analysis && rec.analysis.est && Number.isFinite(rec.analysis.est.task) && rec.analysis.est.task >= 0 && rec.analysis.est.task <= 9) return { band: rec.analysis.est.task, src: 'est' };
    return { band: null, src: null };
  }
  function critNames(kind) {
    return { TA: kind === 't2' ? t('crit_TR') : t('crit_TA'), CC: t('crit_CC'), LR: t('crit_LR'), GRA: t('crit_GRA') };
  }
  function resultPage(id) {
    const rec = BW.store.s.writing.find(r => r.id === id);
    if (!rec) return `<div class="page"><div class="empty">${t('notFound')}</div></div>`;
    const ti = findTask(rec.taskId);
    if (rec.text.trim() && ti) { rec.analysis = BW.analyzer.analyze(rec.text, ti); BW.store.save(); }
    const A = rec.analysis;
    const names = critNames(rec.taskKind);
    const b = bandOf(rec);
    const aiOn = BW.ai.cfg().enabled;
    let h = `<div class="page"><a class="back" href="#/writing">${BW.icon('back')} ${t('writing')}</a>
      <div class="page-head"><div><div class="muted small">${esc(kindName(rec.taskKind))} · ${BW.fmtDate(rec.date, BW.lang())} · ${rec.delivery === 'paper' ? t('writingOnPaper') : t('onComputer')}</div><h1 class="h1">${t('yourWriting')}</h1></div>
      <div class="btn-row"><a class="btn" href="#/write/${esc(rec.taskId)}">${t('tryAgain')}</a></div></div>`;
    h += `<div class="result-hero"><div class="result-band">${BW.fmtBand(b.band)}<small>${b.src === 'ai' ? t('aiEstimate') : b.src === 'self' ? t('selfAssessed') : b.src === 'est' ? t('roughIndicator') : t('noEstimate')}</small></div>
      <div><div class="stat-line"><span>${t('words')}: <b>${rec.wc}</b> / ${ti ? ti.minWords : ''}</span>${A ? `<span>${t('paragraphs')}: <b>${A.paragraphs}</b></span><span>${t('sentences')}: <b>${A.sentences}</b></span><span>${t('lexicalVariety')}: <b>${A.diversity}</b></span>` : ''}<span>${t('time')}: <b>${BW.fmtClock(rec.durationSec)}</b></span></div>
      <p class="small muted" style="margin-top:10px">${esc(t('indicatorNote'))}</p>
      ${aiOn ? `<button class="btn btn-hl" data-ai="${esc(rec.id)}">${BW.icon('sparkle')} ${rec.ai ? t('aiMarkAgain') : t('aiMark')}</button>` : `<a class="btn btn-ghost btn-sm" href="#/settings#ai">${t('setUpAi')}</a>`}</div></div>`;
    if (rec.ai) h += aiBlock(rec.ai, names);
    if (A) {
      h += `<div class="section"><div class="section-head"><h2 class="h3">${t('offlineChecks')}</h2><span class="chip">${t('indicatorOnly')}</span></div><div class="crit-grid">`;
      for (const c of ['TA', 'CC', 'LR', 'GRA']) {
        const items = A.feedback.filter(f => f.c === c);
        h += `<div class="crit"><h4>${esc(names[c])}<span>${BW.fmtBand(A.est[c])}</span></h4><ul>${items.map(f => `<li class="lvl-${f.lvl}"><span style="color:var(--ink)">${esc(f.msg)}</span></li>`).join('')}</ul></div>`;
      }
      h += '</div></div>';
      h += `<div class="section"><div class="section-head"><h2 class="h3">${t('yourAnswer')}</h2><span class="small muted">${t('marksLegend')}</span></div><div class="issue-text" lang="en">${BW.analyzer.markup(rec.text, A.issues)}</div>
        ${A.issues.length ? `<details class="more"><summary>${t('issuesList', { n: A.issues.length })}</summary><ul class="small">${A.issues.slice(0, 40).map(i => `<li><b>${esc(rec.text.slice(i.i, i.i + i.len))}</b> — ${esc(i.msg)}</li>`).join('')}</ul></details>` : ''}</div>`;
    } else h += `<div class="section"><div class="notice">${BW.icon('info')}<div>${esc(t('paperNoText'))}</div></div></div>`;
    if (ti && ti.kind === 'at1' && ti.item.keyFeatures) h += `<div class="section"><h2 class="h3">${t('keyFeatures')}</h2><p class="small muted">${t('keyFeaturesHelp')}</p><ul class="checklist">${ti.item.keyFeatures.map(k => `<li lang="en">${esc(k)}</li>`).join('')}</ul></div>`;
    h += selfBlock(rec, names);
    if (ti) {
      h += `<div class="section"><h2 class="h3">${t('theTask')}</h2><div class="sheet" style="background:#fff;color:#111">${promptHTML(ti)}</div></div>`;
      if (ti.item.model) h += `<div class="section"><details class="more"><summary>${t('modelAnswer')} ${ti.item.modelBand ? `(${t('band')} ${esc(ti.item.modelBand)})` : ''}</summary><div class="model-answer" lang="en">${ti.item.model.split(/\n\n+/).map(p => `<p>${esc(p)}</p>`).join('')}</div></details></div>`;
      if (ti.item.ideas) { const lab = { opinion: ['pointsFor', 'pointsAgainst'], discussion: ['view1', 'view2'], advantages: ['advantagesL', 'disadvantagesL'], problem_solution: ['problems', 'solutions'], two_part: ['question1Ideas', 'question2Ideas'], positive_negative: ['positives', 'negatives'] }[ti.item.essayType] || ['pointsFor', 'pointsAgainst']; h += `<div class="section"><details class="more"><summary>${t('ideasForTask')}</summary><div class="cols small" lang="en"><div><b>${t(lab[0])}</b><ul>${(ti.item.ideas.for || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div><div><b>${t(lab[1])}</b><ul>${(ti.item.ideas.against || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div></details></div>`; }
    }
    h += '</div>';
    return h;
  }
  function aiBlock(ai, names) {
    const bands = ai.bands || {};
    return `<div class="section"><div class="section-head"><h2 class="h3">${t('aiFeedback')}</h2><span class="chip hl">${t('aiEstimate')}: ${BW.fmtBand(ai.overall)}</span></div>
      <div class="crit-grid">${['TA', 'CC', 'LR', 'GRA'].map(c => `<div class="crit"><h4>${esc(names[c])}<span>${BW.fmtBand(bands[c] != null ? bands[c] : bands.TR)}</span></h4></div>`).join('')}</div>
      ${ai.summary ? `<p class="prose" style="margin-top:14px">${esc(ai.summary)}</p>` : ''}
      <div class="cols"><div><h3 class="h4">${t('strengths')}</h3><ul>${(ai.strengths || []).map(s => `<li>${esc(s)}</li>`).join('')}</ul></div><div><h3 class="h4">${t('toImprove')}</h3><ul>${(ai.improvements || []).map(s => `<li>${esc(s)}</li>`).join('')}</ul></div></div>
      ${(ai.corrections || []).length ? `<h3 class="h4" style="margin-top:12px">${t('corrections')}</h3><div class="table-wrap"><table class="rt" lang="en"><thead><tr><th>${t('original')}</th><th>${t('better')}</th><th>${t('why')}</th></tr></thead><tbody>${ai.corrections.map(c => `<tr><td>${esc(c.original)}</td><td><b>${esc(c.corrected)}</b></td><td>${esc(c.note || '')}</td></tr>`).join('')}</tbody></table></div>` : ''}
      ${ai.rewrite ? `<details class="more"><summary>${t('improvedParagraph')}</summary><div class="model-answer" lang="en"><p>${esc(ai.rewrite)}</p></div></details>` : ''}</div>`;
  }
  function selfBlock(rec, names) {
    const s = rec.self || {};
    const def = (rec.analysis && rec.analysis.est) || {};
    const crit = (BW.data.guide && BW.data.guide.scoring && BW.data.guide.scoring.writingCriteria) || [];
    return `<div class="section"><div class="section-head"><h2 class="h3">${t('selfAssess')}</h2><span class="small muted">${t('selfAssessHelp')}</span></div><div id="selfbox" data-rec="${esc(rec.id)}">
      ${['TA', 'CC', 'LR', 'GRA'].map(c => { const v = s[c] != null ? s[c] : (def[c] || 6); const cd = crit.find(x => x.id === c || (c === 'TA' && x.id === 'TR')); return `<div class="slider-row"><div><b>${esc(names[c])}</b>${cd ? `<div class="small muted">${esc(BW.L(cd.desc))}</div>` : ''}</div><input type="range" min="3" max="9" step="0.5" value="${v}" data-c="${c}" aria-label="${esc(names[c])}"><output>${BW.fmtBand(v)}</output></div>`; }).join('')}
      <div class="btn-row" style="margin-top:12px"><button class="btn btn-ink" data-saveself>${t('saveSelf')}</button>${s.task != null ? `<span class="chip">${t('taskBand')}: ${BW.fmtBand(s.task)}</span>` : ''}</div></div></div>`;
  }
  function bindResult(id) {
    const main = document.getElementById('main');
    main.addEventListener('input', e => { if (e.target.matches('#selfbox input[type=range]')) e.target.nextElementSibling.textContent = BW.fmtBand(+e.target.value); });
    main.addEventListener('click', async e => {
      const rec = BW.store.s.writing.find(r => r.id === id);
      if (!rec) return;
      if (e.target.closest('[data-saveself]')) {
        const s = {};
        $$('#selfbox input[type=range]').forEach(i => { s[i.dataset.c] = +i.value; });
        s.task = BW.roundBand((s.TA + s.CC + s.LR + s.GRA) / 4);
        rec.self = s; BW.store.save(); BW.toast(t('saved')); BW.app.render();
      }
      const ab = e.target.closest('[data-ai]');
      if (ab) {
        const ti = findTask(rec.taskId);
        ab.disabled = true; ab.textContent = t('aiWorking');
        try { rec.ai = await BW.ai.markWriting(ti, rec.text); BW.store.save(); BW.app.render(); }
        catch (err) { ab.disabled = false; ab.textContent = t('aiMark'); BW.toast(t('aiError') + ' ' + err.message, 6000); }
      }
    });
  }

  BW.writing = { info, findTask, open, close, resultPage, bindResult, bandOf, promptHTML, kindName, active: () => !!W };
})();
