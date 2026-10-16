/* Bandwise — Reading & Listening runner in the style of the computer-delivered test */
(function () {
  'use strict';
  const BW = window.BW;
  const { esc, $, $$, t } = { esc: BW.esc, $: BW.$, $$: BW.$$, t: (...a) => BW.t(...a) };

  let S = null; // current session

  const boldCaps = s => esc(s).replace(/\b([A-Z]{2,}(?:[\s\/-]+(?:[A-Z]{2,}|A)\b)*)/g, '<b>$1</b>');
  const range = g => g.range[0] === g.range[1] ? `${t('question')} ${g.range[0]}` : `${t('questions')} ${g.range[0]}–${g.range[1]}`;
  const key = (si, q) => si + ':' + BW.qKey(q);

  /* ---------- question widgets ---------- */
  function gapInput(si, q, g) {
    const k = key(si, q), v = S.answers[k] || '';
    const cls = S.review ? (BW.scoreQuestion(q, g, v).score ? ' is-right' : ' is-wrong') : '';
    return `<input class="gap-input${cls}" data-k="${k}" value="${esc(v)}" placeholder="${BW.qNums(q)[0]}" aria-label="${t('question')} ${BW.qNums(q)[0]}" autocomplete="off" autocapitalize="off" spellcheck="false" ${S.review ? 'disabled' : ''}>`;
  }
  function gapSelect(si, q, g, opts) {
    const k = key(si, q), v = S.answers[k] || '';
    const cls = S.review ? (v === q.answer ? ' is-right' : ' is-wrong') : '';
    return `<select class="gap-select${cls}" data-k="${k}" aria-label="${t('question')} ${BW.qNums(q)[0]}" ${S.review ? 'disabled' : ''}><option value="">${BW.qNums(q)[0]}</option>${opts.map(o => `<option value="${esc(o.key)}" ${o.key === v ? 'selected' : ''}>${esc(o.key)}</option>`).join('')}</select>`;
  }
  function findQ(g, n) { return g.questions.find(q => BW.qNums(q).includes(n)); }
  function fillGaps(text, si, g) {
    return esc(text).replace(/\{\{(\d+)\}\}/g, (m, n) => {
      const q = findQ(g, +n);
      if (!q) return m;
      return g.type === 'summary_wordbank' ? gapSelect(si, q, g, g.options) : gapInput(si, q, g);
    });
  }
  function template(g, si) {
    const lines = String(g.template).split('\n');
    let out = '', prevFlow = false;
    for (const raw of lines) {
      if (!raw.trim()) { out += '<div style="height:.5em"></div>'; continue; }
      if (raw.startsWith('-> ')) {
        if (prevFlow) out += '<div class="flow-arrow" aria-hidden="true">↓</div>';
        out += `<p class="tl flow">${fillGaps(raw.slice(3), si, g)}</p>`; prevFlow = true; continue;
      }
      prevFlow = false;
      if (raw.startsWith('# ')) out += `<p class="tl sub">${fillGaps(raw.slice(2), si, g)}</p>`;
      else if (raw.startsWith('- ')) out += `<p class="tl bullet">${fillGaps(raw.slice(2), si, g)}</p>`;
      else out += `<p class="tl">${fillGaps(raw, si, g)}</p>`;
    }
    return `<div class="qbox tmpl">${g.title ? `<div class="qbox-title">${esc(g.title)}</div>` : ''}${out}</div>`;
  }
  function table(g, si) {
    const tb = g.table;
    return `<div class="table-wrap">${g.title ? `<div class="qbox-title">${esc(g.title)}</div>` : ''}<table class="xtable"><thead><tr>${tb.headers.map(h => `<th>${fillGaps(h, si, g)}</th>`).join('')}</tr></thead><tbody>${tb.rows.map(r => `<tr>${r.map(c => `<td>${fillGaps(String(c), si, g)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function optList(opts, title) {
    return `<div class="qbox">${title ? `<div class="qbox-title">${esc(title)}</div>` : ''}<ul class="optlist">${opts.map(o => `<li><b>${esc(o.key)}</b><span>${esc(o.text)}</span></li>`).join('')}</ul></div>`;
  }
  function reviewNote(si, q, g) {
    if (!S.review) return '';
    const k = key(si, q), v = S.answers[k];
    const r = BW.scoreQuestion(q, g, v);
    const correct = Array.isArray(q.answer) ? q.answer.join(', ') : q.answer;
    const yours = Array.isArray(v) ? v.join(', ') : (v || '—');
    const where = S.kind === 'reading' && q.loc ? `<button class="xf-btn" data-loc="${esc(q.loc)}" data-si="${si}">${t('showInPassage')}</button>` :
      S.kind === 'listening' ? `<button class="xf-btn" data-tq="${BW.qNums(q)[0]}" data-si="${si}">${t('showInTranscript')}</button>` : '';
    return `<div class="review-note">${r.score === r.max ? `<span style="color:#2E7D32;font-weight:700">${t('correct')}</span>` : `<span style="color:#C62828;font-weight:700">${t('yourAnswer')}: ${esc(yours)}</span>`} · ${t('answer')}: <span class="ans">${esc(correct)}</span>${q.accept && q.accept.length ? ` <span class="xf-sub">(${t('alsoAccepted')}: ${esc(q.accept.join(' / '))})</span>` : ''}<div>${esc(q.explanation || '')}</div>${where}</div>`;
  }
  function qWrap(si, q, g, inner) {
    const k = key(si, q);
    let state = '';
    if (S.review) { const r = BW.scoreQuestion(q, g, S.answers[k]); state = r.score === r.max ? ' is-right' : ' is-wrong'; }
    const nums = BW.qNums(q);
    return `<div class="q${state}" id="q-${si}-${nums[0]}" data-k="${k}"><span class="qn">${nums.length > 1 ? nums[0] + '–' + nums[nums.length - 1] : nums[0]}</span><div>${inner}</div>${reviewNote(si, q, g)}</div>`;
  }
  function radios(si, q, g, opts) {
    const k = key(si, q), v = S.answers[k] || '';
    return opts.map(o => `<label class="choice"><input type="radio" name="r-${k}" data-k="${k}" value="${esc(o.key)}" ${v === o.key ? 'checked' : ''} ${S.review ? 'disabled' : ''}><span>${o.label != null ? esc(o.label) : `<b>${esc(o.key)}</b>&nbsp; ${esc(o.text)}`}</span></label>`).join('');
  }

  function renderGroup(g, si) {
    let h = `<section class="qgroup" data-g="${esc(g.id)}"><div class="qgroup-head">${range(g)}</div><p class="qgroup-inst">${boldCaps(g.instructions)}</p>`;
    const T = g.type;
    if (T === 'tfng' || T === 'ynng') {
      const labs = T === 'tfng' ? ['TRUE', 'FALSE', 'NOT GIVEN'] : ['YES', 'NO', 'NOT GIVEN'];
      h += g.questions.map(q => qWrap(si, q, g, `${esc(q.text)}<div class="tfng-opts">${radios(si, q, g, labs.map(l => ({ key: l, label: l })))}</div>`)).join('');
    } else if (T === 'mcq') {
      h += g.questions.map(q => qWrap(si, q, g, `${esc(q.text)}<div class="choices">${radios(si, q, g, q.choices)}</div>`)).join('');
    } else if (T === 'mcq_multi') {
      h += g.questions.map(q => {
        const k = key(si, q), v = S.answers[k] || [];
        const boxes = q.choices.map(c => `<label class="choice"><input type="checkbox" data-k="${k}" data-max="${q.n.length}" value="${esc(c.key)}" ${v.includes(c.key) ? 'checked' : ''} ${S.review ? 'disabled' : ''}><span><b>${esc(c.key)}</b>&nbsp; ${esc(c.text)}</span></label>`).join('');
        return qWrap(si, q, g, `${esc(q.text)}<div class="choices">${boxes}</div>`);
      }).join('');
    } else if (T === 'map_labelling' || (T === 'diagram_labelling' && g.options)) {
      if (g.figure) h += `<div class="figure-box">${g.figure}</div>`;
      const letters = g.options.map(o => o.key);
      h += `<div class="table-wrap"><table class="matrix"><thead><tr><th></th>${letters.map(l => `<th>${esc(l)}</th>`).join('')}</tr></thead><tbody>`;
      for (const q of g.questions) {
        const k = key(si, q), v = S.answers[k] || '';
        const ok = S.review ? (v === q.answer) : null;
        h += `<tr id="q-${si}-${q.n}" data-k="${k}"><td><span class="qn" style="${ok === true ? 'background:#2E7D32;color:#fff;border-color:#2E7D32' : ok === false ? 'background:#C62828;color:#fff;border-color:#C62828' : ''}">${q.n}</span> ${esc(q.text)}</td>${letters.map(l => `<td><input type="radio" name="r-${k}" data-k="${k}" value="${esc(l)}" aria-label="${esc(q.text)} ${esc(l)}" ${v === l ? 'checked' : ''} ${S.review ? 'disabled' : ''}></td>`).join('')}</tr>`;
      }
      h += '</tbody></table></div>';
      if (S.review) h += g.questions.map(q => `<div class="q" style="display:block">${reviewNote(si, q, g).replace('class="review-note"', 'class="review-note" style="margin:0"')}</div>`).join('');
    } else if (/^matching/.test(T) || T === 'summary_wordbank') {
      const title = T === 'matching_headings' ? t('listOfHeadings') : T === 'matching_endings' ? '' : '';
      if (T === 'summary_wordbank') {
        h += template(g, si) + optList(g.options);
        if (S.review) h += g.questions.map(q => `<div class="q" style="display:block">${reviewNote(si, q, g).replace('class="review-note"', 'class="review-note" style="margin:0"')}</div>`).join('');
      } else {
        if (!(T === 'matching_info' && g.options.every(o => /^Paragraph /i.test(o.text)))) h += optList(g.options, title);
        h += g.questions.map(q => qWrap(si, q, g, `${esc(q.text)} ${gapSelect(si, q, g, g.options)}`)).join('');
      }
    } else {
      // completion types
      if (g.figure) h += `<div class="figure-box">${g.figure}</div>`;
      if (g.template) {
        h += template(g, si);
        if (S.review) h += g.questions.map(q => `<div class="q" style="display:block">${reviewNote(si, q, g).replace('class="review-note"', 'class="review-note" style="margin:0"')}</div>`).join('');
      } else if (g.table) {
        h += table(g, si);
        if (S.review) h += g.questions.map(q => `<div class="q" style="display:block">${reviewNote(si, q, g).replace('class="review-note"', 'class="review-note" style="margin:0"')}</div>`).join('');
      } else {
        h += g.questions.map(q => {
          const txt = /_{3,}/.test(q.text) ? esc(q.text).replace(/_{3,}/, gapInput(si, q, g)) : `${esc(q.text)} ${gapInput(si, q, g)}`;
          return qWrap(si, q, g, txt);
        }).join('');
      }
    }
    return h + '</section>';
  }

  /* ---------- panes ---------- */
  function renderPassage(sec, si) {
    let h = `<div class="xf-part-banner"><b>${esc(S.kind === 'reading' ? (S.drill ? sec.title : `${t('readingPassage')} ${sec.n}`) : '')}</b>${esc(sec.intro || '')}</div><article class="passage" lang="en">`;
    for (const tx of sec.texts) {
      h += `<div class="text-block" data-label="${esc(tx.label || '')}" data-heading="${esc(tx.heading)}">`;
      h += `<h3>${tx.label ? `<span class="text-label">${esc(tx.label)}</span>` : ''}${esc(tx.heading)}</h3>`;
      if (tx.subheading) h += `<div class="subh">${esc(tx.subheading)}</div>`;
      for (const p of tx.paragraphs) h += `<p class="ptext" data-label="${esc(p.label || '')}">${p.label ? `<span class="plabel">${esc(p.label)}</span>` : ''}${esc(p.text)}</p>`;
      h += '</div>';
    }
    return h + '</article>';
  }
  function transcriptHTML(part) {
    const sp = part.speakers || {};
    return `<div class="transcript" lang="en">${part.script.map((seg, i) => {
      if (seg.t === 'pause') return `<p class="narr" data-seg="${i}">[${seg.s}s]</p>`;
      const who = seg.t === 'narr' ? '' : `<span class="who">${esc((sp[seg.who] || {}).name || seg.who)}:</span>`;
      const marks = (seg.q || []).map(n => `<span class="ansmark" data-tqm="${n}">Q${n}</span>`).join('');
      return `<p class="${seg.t === 'narr' ? 'narr' : ''}" data-seg="${i}">${who}${esc(seg.text)}${S.review ? marks : ''}</p>`;
    }).join('')}</div>`;
  }
  function renderQuestions(si) {
    const sec = S.sections[si];
    let h = '';
    if (S.kind === 'listening') {
      h += `<div class="xf-part-banner"><b>${t('part')} ${sec.n}</b>${t('listenIntro', { a: sec.groups[0].range[0], b: sec.groups[sec.groups.length - 1].range[1] })}</div>`;
      if (S.mode === 'practice' && !S.review) h += audioBar();
      if (S.review || S.showTranscript) h += `<details class="qbox" ${S.openTranscript === si ? 'open' : ''} id="tr-${si}"><summary style="cursor:pointer;font-weight:700">${t('transcript')}</summary>${transcriptHTML(sec)}</details>`;
    }
    h += sec.groups.map(g => renderGroup(g, si)).join('');
    if (S.mode === 'practice' && !S.review) h += `<div style="margin-top:20px"><button class="xf-btn primary" data-x="check">${t('checkAnswers')}</button></div>`;
    return h;
  }
  function audioBar() {
    const st = S.player ? S.player.state : 'idle';
    return `<div class="audio-bar"><button class="xf-btn primary" data-x="audio">${st === 'playing' ? t('pause') : (st === 'paused' ? t('resume') : t('playAudio'))}</button><button class="xf-btn" data-x="restart">${t('restartPart')}</button><span class="state" id="astate">${S.audioMsg || ''}</span><span class="meter"><i id="ameter"></i></span><label class="xf-sub">${t('speed')} <select class="gap-select" data-x="rate">${[0.8, 0.9, 1, 1.1, 1.2].map(r => `<option ${r === (BW.store.s.settings.rate || 1) ? 'selected' : ''}>${r}</option>`).join('')}</select></label><button class="xf-btn" data-x="transcript">${t('transcript')}</button></div>`;
  }
  function renderNav() {
    let h = '';
    S.sections.forEach((sec, si) => {
      const nums = [];
      sec.groups.forEach(g => g.questions.forEach(q => BW.qNums(q).forEach((n, idx) => nums.push({ n, q, g, idx }))));
      h += `<div class="part ${si === S.si ? 'on' : ''}"><span data-part="${si}">${S.kind === 'reading' && !S.drill ? t('part') + ' ' + sec.n : S.drill ? '#' + (si + 1) : t('part') + ' ' + sec.n}</span>`;
      for (const it of nums) {
        const k = key(si, it.q), v = S.answers[k];
        const done = Array.isArray(v) ? v.length > it.idx : (v != null && String(v).trim() !== '');
        let cls = done ? ' done' : '';
        if (S.review) { const r = BW.scoreQuestion(it.q, it.g, v); cls = r.right[it.idx] ? ' right' : ' wrong'; }
        if (S.flags.has(k)) cls += ' flag';
        if (S.cur === k) cls += ' cur';
        h += `<button class="qdot${cls}" data-go="${si}|${BW.qNums(it.q)[0]}" aria-label="${t('question')} ${it.n}">${it.n}</button>`;
      }
      h += '</div>';
    });
    h += `<span class="spacer"></span>`;
    if (!S.review) h += `<button class="xf-btn flag-btn" data-x="flag" aria-pressed="${S.flags.has(S.cur)}">${t('review')}</button>`;
    h += `<button class="xf-btn" data-x="prev" aria-label="${t('previous')}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button><button class="xf-btn" data-x="next" aria-label="${t('next')}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>`;
    return h;
  }

  /* ---------- frame ---------- */
  function frameClasses() {
    const st = BW.store.s.settings;
    return ['xf', st.contrast === 'wb' ? 'c-wb' : st.contrast === 'yb' ? 'c-yb' : '', st.textSize === 'large' ? 'ts-l' : st.textSize === 'xl' ? 'ts-xl' : ''].join(' ');
  }
  function draw() {
    const host = document.getElementById('main');
    const single = S.kind === 'listening';
    const titleSub = S.review ? t('reviewMode') : S.mode === 'exam' ? t('examMode') : t('practiceMode');
    host.innerHTML = `<div class="${frameClasses()}" id="xf" dir="ltr">
      <header class="xf-top">
        <div><div class="xf-title">${esc(S.title)}</div><div class="xf-sub">${esc(titleSub)}</div></div>
        <div class="xf-timer" id="xtimer" role="timer" aria-live="off"></div>
        ${single ? '' : `<button class="xf-btn pane-switch" data-x="pane">${t('passageQuestions')}</button>`}
        <button class="xf-btn" data-x="aa" title="${t('displaySettings')}">Aa</button>
        <button class="xf-btn" data-x="help">${t('help')}</button>
        ${S.review ? `<button class="xf-btn primary" data-x="close">${t('done')}</button>` : `<button class="xf-btn primary" data-x="finish">${S.mode === 'exam' ? t('submit') : t('exit')}</button>`}
      </header>
      <div class="xf-body ${single ? 'single' : 'split-mobile'}">
        ${single ? '' : `<section class="xf-pane passage-pane ${S.pane === 'p' ? 'show' : ''}" id="ppane"></section>`}
        <section class="xf-pane q-pane ${single || S.pane === 'q' ? 'show' : ''}" id="qpane" lang="en"></section>
      </div>
      <footer class="xf-nav" id="xnav"></footer>
    </div>`;
    drawPart();
    tickTimer();
    bindFrame();
  }
  function bindFrame() {
    const root = $('#xf');
    root.addEventListener('input', onInput);
    root.addEventListener('change', onInput);
    root.addEventListener('click', onClick);
    root.addEventListener('focusin', e => { const q = e.target.closest('[data-k]'); if (q && q.dataset.k !== S.cur) { S.cur = q.dataset.k; drawNav(); } });
    root.addEventListener('mouseup', e => {
      if (!S || S.kind !== 'reading' || !e.target.closest('#ppane')) return;
      setTimeout(() => { if (!S) return; const sel = window.getSelection(); if (sel && !sel.isCollapsed && String(sel).trim()) showHlPop(e.clientX, e.clientY); else hideHlPop(); }, 10);
    });
    root.addEventListener('change', e => { if (e.target.dataset.x === 'rate') { BW.store.s.settings.rate = +e.target.value; BW.store.save(); } });
  }
  function drawPart() {
    const sec = S.sections[S.si];
    if (S.kind === 'reading') { const pp = $('#ppane'); pp.innerHTML = renderPassage(sec, S.si); pp.scrollTop = 0; restoreHighlights(); }
    const qp = $('#qpane'); qp.innerHTML = renderQuestions(S.si); qp.scrollTop = 0;
    drawNav();
    if (S.kind === 'listening' && S.player) updateAudioUI();
  }
  function drawNav() { const n = $('#xnav'); if (n) n.innerHTML = renderNav(); }

  /* ---------- highlights (passage) ---------- */
  function restoreHighlights() {
    const saved = S.hl[S.si];
    if (saved) { $('#ppane .passage').innerHTML = saved; }
  }
  function saveHighlights() { const a = $('#ppane .passage'); if (a) S.hl[S.si] = a.innerHTML; }
  function highlightSelection() {
    const sel = window.getSelection();
    if (!sel.rangeCount || sel.isCollapsed) return;
    const rng = sel.getRangeAt(0);
    const root = $('#ppane .passage');
    if (!root || !root.contains(rng.commonAncestorContainer)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) { const n = walker.currentNode; if (rng.intersectsNode(n) && n.textContent.trim()) nodes.push(n); }
    for (const n of nodes) {
      let s = 0, e = n.textContent.length;
      if (n === rng.startContainer) s = rng.startOffset;
      if (n === rng.endContainer) e = rng.endOffset;
      if (e <= s) continue;
      const mid = n.splitText(s); mid.splitText(e - s);
      const m = document.createElement('mark'); m.className = 'uhl';
      mid.parentNode.insertBefore(m, mid); m.appendChild(mid);
    }
    sel.removeAllRanges();
    saveHighlights();
  }
  function clearHighlights(all) {
    const root = $('#ppane .passage');
    if (!root) return;
    const sel = window.getSelection();
    $$('mark.uhl', root).forEach(m => {
      if (all || (sel.rangeCount && sel.getRangeAt(0).intersectsNode(m))) { m.replaceWith(...m.childNodes); }
    });
    root.normalize();
    sel.removeAllRanges();
    saveHighlights();
  }
  function showHlPop(x, y) {
    hideHlPop();
    const p = document.createElement('div');
    p.className = 'hl-pop'; p.id = 'hlpop';
    p.innerHTML = `<button data-h="add">${t('highlight')}</button><button data-h="clear">${t('clear')}</button>`;
    p.style.left = Math.min(window.innerWidth - 180, x) + 'px'; p.style.top = Math.max(8, y - 44) + 'px';
    document.body.appendChild(p);
    p.addEventListener('mousedown', e => e.preventDefault());
    p.addEventListener('click', e => { const b = e.target.closest('[data-h]'); if (!b) return; b.dataset.h === 'add' ? highlightSelection() : clearHighlights(false); hideHlPop(); });
  }
  function hideHlPop() { const p = document.getElementById('hlpop'); if (p) p.remove(); }

  /* ---------- timer ---------- */
  function tickTimer() {
    const el = $('#xtimer');
    if (!el) return;
    if (S.review) { el.textContent = `${t('score')}: ${S.result.raw}/${S.result.max}`; return; }
    if (S.kind === 'reading') {
      if (S.mode === 'exam') {
        const left = Math.max(0, S.deadline - Date.now()) / 1000;
        el.textContent = t('minutesLeft', { m: Math.ceil(left / 60) });
        el.classList.toggle('danger', left <= 300);
        if (!S.warned10 && left <= 600) { S.warned10 = true; el.classList.add('warn'); BW.toast(t('tenMinutes')); setTimeout(() => el.classList.remove('warn'), 7000); }
        if (!S.warned5 && left <= 300) { S.warned5 = true; el.classList.add('warn'); BW.toast(t('fiveMinutes')); setTimeout(() => el.classList.remove('warn'), 7000); }
        if (left <= 0) { submit(true); return; }
      } else el.textContent = t('elapsed', { t: BW.fmtClock((Date.now() - S.start) / 1000) });
    } else {
      if (S.reviewDeadline) {
        const left = Math.max(0, S.reviewDeadline - Date.now()) / 1000;
        el.textContent = t('checkTime', { t: BW.fmtClock(left) });
        el.classList.add('danger');
        if (left <= 0) { submit(true); return; }
      } else el.textContent = S.mode === 'exam' ? (S.audioMsg || t('audioPlaying')) : t('elapsed', { t: BW.fmtClock((Date.now() - S.start) / 1000) });
    }
  }

  /* ---------- listening audio ---------- */
  function setupPlayer() {
    S.player = new BW.tts.ScriptPlayer(S.sections, {
      onPart(pi) {
        if (S.mode === 'exam' && pi !== S.si) { S.si = pi; drawPart(); }
      },
      onSeg(pi, si, seg) {
        if (seg.t !== 'pause') S.audioMsg = S.mode === 'exam' ? `${t('part')} ${S.sections[pi].n} · ${t('audioPlaying')}` : t('playing');
        if (S.showTranscript || S.review) { $$('.transcript .now').forEach(e => e.classList.remove('now')); const p = $(`#tr-${pi} [data-seg="${si}"]`); if (p) p.classList.add('now'); }
        updateAudioUI();
      },
      onWait(left, seg) { S.audioMsg = left > 0 ? t('lookAtQuestions', { s: Math.ceil(left) }) : ''; updateAudioUI(); },
      onProgress(f) { const m = $('#ameter'); if (m) m.style.width = (f * 100).toFixed(1) + '%'; },
      onEnd() {
        S.audioMsg = t('audioFinished');
        if (S.mode === 'exam') { S.reviewDeadline = Date.now() + 120000; BW.toast(t('twoMinutesCheck')); }
        updateAudioUI();
      }
    });
  }
  function updateAudioUI() {
    const a = $('#astate'); if (a) a.textContent = S.audioMsg || '';
    const b = $('[data-x="audio"]');
    if (b && S.player) b.textContent = S.player.state === 'playing' ? t('pause') : S.player.state === 'done' ? t('playAgain') : (S.player.state === 'paused' ? t('resume') : t('playAudio'));
    tickTimer();
  }

  /* ---------- scoring ---------- */
  function computeResult() {
    let raw = 0, max = 0; const byType = {};
    S.sections.forEach((sec, si) => sec.groups.forEach(g => g.questions.forEach(q => {
      const r = BW.scoreQuestion(q, g, S.answers[key(si, q)]);
      raw += r.score; max += r.max;
      const bt = byType[g.type] = byType[g.type] || [0, 0];
      bt[0] += r.score; bt[1] += r.max;
    })));
    const full = max === 40 && !S.drill;
    const band = full ? BW.bandFromRaw(raw, S.kind === 'listening' ? 'listening' : S.test.module) : null;
    return { raw, max, byType, band, full };
  }
  async function submit(auto) {
    if (S.submitted) return;
    if (!auto && S.mode === 'exam') {
      const unanswered = countUnanswered();
      const ok = await BW.confirmBox(unanswered ? t('submitConfirmBlank', { n: unanswered }) : t('submitConfirm'), t('submit'), t('keepWorking'));
      if (!ok) return;
    }
    S.submitted = true;
    stopAll();
    const res = computeResult();
    S.result = res;
    const att = {
      kind: S.kind, testId: S.test.id, module: S.test.module || null, title: S.title, mode: S.mode, drill: S.drill ? S.drill.type : null,
      raw: res.raw, max: res.max, band: res.band, full: res.full, byType: res.byType, answers: S.answers,
      parts: S.sectionIdx, durationSec: Math.round((Date.now() - S.start) / 1000), drillRef: drillRef()
    };
    const saved = S.noSave ? att : BW.store.addAttempt(att);
    if (S.onFinish) { const cb = S.onFinish; close(); cb(saved); return; }
    close();
    location.hash = '#/result/' + saved.id;
  }
  function drillRef() { return S.drill ? S.drill.items.map(it => ({ testId: it.test.id, si: it.si, gid: it.group.id })) : null; }
  function countUnanswered() {
    let n = 0;
    S.sections.forEach((sec, si) => sec.groups.forEach(g => g.questions.forEach(q => {
      const v = S.answers[key(si, q)];
      if (Array.isArray(q.n)) n += q.n.length - (Array.isArray(v) ? v.length : 0);
      else if (v == null || String(v).trim() === '') n++;
    })));
    return n;
  }
  function stopAll() {
    clearInterval(S.timer);
    if (S.player) S.player.stop();
    BW.tts.cancelAll();
    hideHlPop();
  }
  function close() {
    if (!S) return;
    stopAll();
    document.body.classList.remove('exam-mode');
    window.removeEventListener('beforeunload', S.beforeUnload);
    document.removeEventListener('keydown', S.onKey);
    S = null;
  }

  /* ---------- events ---------- */
  function onInput(e) {
    const el = e.target;
    const k = el.dataset.k;
    if (!k || S.review) return;
    if (el.type === 'checkbox') {
      const boxes = $$(`input[type=checkbox][data-k="${CSS.escape(k)}"]`);
      const chosen = boxes.filter(b => b.checked).map(b => b.value);
      const max = +el.dataset.max;
      if (chosen.length > max) { el.checked = false; BW.toast(t('chooseOnly', { n: max })); return; }
      S.answers[k] = chosen;
    } else S.answers[k] = el.value;
    S.cur = k;
    drawNav();
  }
  function goTo(si, n) {
    if (si !== S.si) { S.si = si; drawPart(); }
    const el = document.getElementById(`q-${si}-${n}`) || $(`#qpane [data-k="${si}:${n}"]`) || $(`#qpane input[placeholder="${n}"], #qpane select[aria-label$=" ${n}"]`);
    if (el) {
      if (window.innerWidth <= 860 && S.kind === 'reading') { S.pane = 'q'; $('#ppane').classList.remove('show'); $('#qpane').classList.add('show'); }
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      const f = el.matches('input,select') ? el : el.querySelector('input:not([disabled]),select:not([disabled])');
      if (f) f.focus({ preventScroll: true });
      const kk = el.dataset.k || (f && f.dataset.k);
      if (kk) { S.cur = kk; drawNav(); }
    }
  }
  function allKeys() {
    const out = [];
    S.sections.forEach((sec, si) => sec.groups.forEach(g => g.questions.forEach(q => out.push({ si, n: BW.qNums(q)[0], k: key(si, q) }))));
    return out;
  }
  function step(dir) {
    const list = allKeys();
    let i = list.findIndex(x => x.k === S.cur);
    i = i < 0 ? 0 : BW.clamp(i + dir, 0, list.length - 1);
    goTo(list[i].si, list[i].n);
  }
  function showAa() {
    const st = BW.store.s.settings;
    const m = BW.modal(`<h2>${t('displaySettings')}</h2>
      <div class="field"><span>${t('textSize')}</span><div class="seg" data-set="textSize">${[['normal', t('standard')], ['large', t('large')], ['xl', t('extraLarge')]].map(([v, l]) => `<button aria-pressed="${st.textSize === v}" data-v="${v}">${l}</button>`).join('')}</div></div>
      <div class="field"><span>${t('colours')}</span><div class="seg" data-set="contrast">${[['default', t('blackOnWhite')], ['wb', t('whiteOnBlack')], ['yb', t('yellowOnBlack')]].map(([v, l]) => `<button aria-pressed="${st.contrast === v}" data-v="${v}">${l}</button>`).join('')}</div></div>
      ${S.kind === 'reading' ? `<button class="btn btn-sm" data-clearhl>${t('clearHighlights')}</button>` : ''}
      <div class="btn-row"><button class="btn btn-ink" data-close>${t('done')}</button></div>`);
    m.el.addEventListener('click', e => {
      const b = e.target.closest('[data-v]');
      if (b) { const seg = b.closest('[data-set]'); st[seg.dataset.set] = b.dataset.v; BW.store.save(); $$('button', seg).forEach(x => x.setAttribute('aria-pressed', x === b)); $('#xf').className = frameClasses(); }
      if (e.target.closest('[data-clearhl]')) { clearHighlights(true); }
      if (e.target.closest('[data-close]')) m.close();
    });
  }
  function showHelp() {
    const m = BW.modal(`<h2>${t('help')}</h2><div class="prose small">${(S.kind === 'reading' ? t('helpReading') : t('helpListening')).split('\n').map(p => `<p>${esc(p)}</p>`).join('')}</div><div class="btn-row"><button class="btn btn-ink" data-close>${t('done')}</button></div>`);
    m.el.addEventListener('click', e => { if (e.target.closest('[data-close]')) m.close(); });
  }
  function onClick(e) {
    const x = e.target.closest('[data-x]');
    const go = e.target.closest('[data-go]');
    const part = e.target.closest('[data-part]');
    const loc = e.target.closest('[data-loc]');
    const tq = e.target.closest('[data-tq]');
    if (go) { const [si, n] = go.dataset.go.split('|'); goTo(+si, +n); return; }
    if (part) { S.si = +part.dataset.part; drawPart(); return; }
    if (loc) {
      const si = +loc.dataset.si; if (si !== S.si) { S.si = si; drawPart(); }
      if (window.innerWidth <= 860) { S.pane = 'p'; $('#qpane').classList.remove('show'); $('#ppane').classList.add('show'); }
      const L = loc.dataset.loc;
      const el = $(`#ppane .ptext[data-label="${CSS.escape(L)}"]`) || $(`#ppane .text-block[data-label="${CSS.escape(L)}"]`) || $$('#ppane .text-block').find(b => b.dataset.heading === L);
      if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
      return;
    }
    if (tq) {
      const si = +tq.dataset.si; if (si !== S.si) { S.si = si; drawPart(); }
      const d = $(`#tr-${si}`); if (d) d.open = true;
      const mk = $(`#tr-${si} [data-tqm="${tq.dataset.tq}"]`);
      if (mk) { const p = mk.closest('p'); p.scrollIntoView({ block: 'center', behavior: 'smooth' }); p.classList.remove('flash'); void p.offsetWidth; p.classList.add('flash'); }
      return;
    }
    if (!x) return;
    const a = x.dataset.x;
    if (a === 'finish') { if (S.mode === 'exam') submit(false); else exitPractice(); }
    else if (a === 'check') { S.result = computeResult(); S.review = true; stopAll(); S.submitted = false; saveAttemptPractice(); draw(); }
    else if (a === 'close') { const back = S.backTo; close(); location.hash = back || '#/'; }
    else if (a === 'pane') { S.pane = S.pane === 'p' ? 'q' : 'p'; $('#ppane').classList.toggle('show', S.pane === 'p'); $('#qpane').classList.toggle('show', S.pane === 'q'); }
    else if (a === 'aa') showAa();
    else if (a === 'help') showHelp();
    else if (a === 'flag') { if (!S.cur) return; S.flags.has(S.cur) ? S.flags.delete(S.cur) : S.flags.add(S.cur); drawNav(); }
    else if (a === 'prev') step(-1);
    else if (a === 'next') step(1);
    else if (a === 'audio') {
      if (!BW.tts.supported) { BW.toast(t('noTts')); return; }
      if (!S.player) setupPlayer();
      const st = S.player.state;
      if (st === 'playing') S.player.pause();
      else if (st === 'done') { S.player.seek(0, 0); S.player.play(); }
      else S.player.play();
      updateAudioUI();
    } else if (a === 'restart') { if (!S.player) setupPlayer(); S.player.seek(S.si, 0); S.player.play(); updateAudioUI(); }
    else if (a === 'transcript') { S.showTranscript = !S.showTranscript; S.openTranscript = S.si; drawPart(); }
  }
  function saveAttemptPractice() {
    const res = S.result;
    const att = { kind: S.kind, testId: S.test.id, module: S.test.module || null, title: S.title, mode: 'practice', drill: S.drill ? S.drill.type : null, raw: res.raw, max: res.max, band: res.band, full: res.full, byType: res.byType, answers: S.answers, parts: S.sectionIdx, durationSec: Math.round((Date.now() - S.start) / 1000), drillRef: drillRef() };
    if (!S.noSave) BW.store.addAttempt(att);
    BW.toast(t('scoreToast', { raw: res.raw, max: res.max }));
  }
  async function exitPractice() {
    const touched = Object.keys(S.answers).length;
    if (touched && !(await BW.confirmBox(t('exitConfirm'), t('exit'), t('keepWorking')))) return;
    const back = S.backTo; close(); location.hash = back || '#/';
  }

  /* ---------- public ---------- */
  function open(o) {
    if (S) close();
    const test = o.test;
    let sections, sectionIdx;
    if (o.drill) {
      sections = o.drill.items.map(it => {
        const base = o.kind === 'listening' ? it.test.parts[it.si] : it.test.sections[it.si];
        return Object.assign({}, base, { title: `${it.test.title} · ${o.kind === 'listening' ? t('part') : t('passage')} ${base.n}`, groups: [it.group] });
      });
      sectionIdx = null;
    } else {
      const all = o.kind === 'listening' ? test.parts : test.sections;
      sectionIdx = o.parts && o.parts.length ? o.parts : all.map((_, i) => i);
      sections = sectionIdx.map(i => all[i]);
    }
    S = {
      kind: o.kind, test, mode: o.mode || 'practice', sections, sectionIdx, drill: o.drill || null,
      title: o.title || test.title, si: 0, pane: 'p', answers: {}, flags: new Set(), cur: null, hl: {},
      start: Date.now(), review: !!o.review, onFinish: o.onFinish, noSave: !!o.noSave, backTo: o.backTo || location.hash,
      showTranscript: false
    };
    if (o.review) { S.answers = o.answers || {}; S.result = o.result || computeResult(); }
    if (S.kind === 'reading' && S.mode === 'exam' && !S.review) S.deadline = Date.now() + (o.minutes || 60) * 60000;
    document.body.classList.add('exam-mode');
    draw();
    S.onKey = e => {
      if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    };
    document.addEventListener('keydown', S.onKey);
    S.beforeUnload = e => { if (!S.review && Object.keys(S.answers).length) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', S.beforeUnload);
    S.timer = setInterval(tickTimer, 1000);
    if (S.kind === 'listening' && S.mode === 'exam' && !S.review) {
      setupPlayer();
      S.player.play();
    }
  }
  const active = () => !!S;
  function abort() { close(); }

  BW.runner = { open, active, abort, key };
})();
