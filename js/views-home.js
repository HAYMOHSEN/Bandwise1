/* Bandwise — home, exam guide, band calculator */
(function () {
  'use strict';
  const BW = window.BW;
  const { esc } = BW;
  const t = (...a) => BW.t(...a);
  const V = BW.views = BW.views || {};

  /* ---------- data helpers ---------- */
  const D = () => BW.data;
  function findTest(id) {
    let x = (D().reading || []).find(r => r.id === id); if (x) return { kind: 'reading', test: x };
    x = (D().listening || []).find(r => r.id === id); if (x) return { kind: 'listening', test: x };
    return null;
  }
  function guide() {
    const g = BW.store.s.guide;
    const base = D().guide || {};
    return g && g.version > (base.version || 0) ? g : base;
  }
  function latestBands() {
    const s = BW.store.s, mod = s.profile.module;
    const full = s.attempts.filter(a => a.full && Number.isFinite(a.band)).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const lastOf = arr => arr.length ? arr[arr.length - 1] : null;
    const L = lastOf(full.filter(a => a.kind === 'listening'));
    const R = lastOf(full.filter(a => a.kind === 'reading' && (a.module || (findTest(a.testId) || {}).test?.module) === mod));
    const wr = s.writing.filter(r => r.text && r.text.trim() && (r.taskKind === 't2' || r.taskKind === (mod === 'general' ? 'gt1' : 'at1'))).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const t1 = lastOf(wr.filter(r => r.taskKind !== 't2')), t2 = lastOf(wr.filter(r => r.taskKind === 't2'));
    const wb = BW.writingBand(t1 ? BW.writing.bandOf(t1).band : null, t2 ? BW.writing.bandOf(t2).band : null);
    const sp = lastOf(s.speaking.filter(r => BW.speaking.bandOf(r).band != null).slice().sort((a, b) => String(a.date).localeCompare(String(b.date))));
    return {
      listening: L ? L.band : null, reading: R ? R.band : null, writing: wb, speaking: sp ? BW.speaking.bandOf(sp).band : null,
      counts: { listening: s.attempts.filter(a => a.kind === 'listening').length, reading: s.attempts.filter(a => a.kind === 'reading' && (a.module || (findTest(a.testId) || {}).test?.module) === mod).length, writing: wr.length, speaking: s.speaking.length }
    };
  }
  function typeAccuracy(skill) {
    const acc = {};
    for (const a of BW.store.s.attempts.filter(a => (!skill || a.kind === skill) && (a.kind !== 'reading' || (a.module || (findTest(a.testId) || {}).test?.module) === BW.store.s.profile.module))) for (const [k, v] of Object.entries(a.byType || {})) { const x = acc[k] = acc[k] || [0, 0]; x[0] += v[0]; x[1] += v[1]; }
    return acc;
  }
  function typeName(type) {
    const st = (D().strategies || {}).questionTypes || {};
    const e = st[type];
    if (!e) return type.replace(/_/g, ' ');
    return BW.lang() === 'ar' && e.ar && e.ar.name ? e.ar.name : e.name;
  }
  function nextStep(b) {
    const s = BW.store.s, mod = s.profile.module;
    const readFirst = (D().reading || []).find(r => r.module === mod) || (D().reading || [])[0];
    const listenFirst = (D().listening || [])[0];
    if (!b.counts.listening && listenFirst) return { icon: 'listening', title: t('ns_listenTitle'), text: t('ns_listenText'), href: '#/soundcheck/' + listenFirst.id, cta: t('startTest') };
    if (!b.counts.reading && readFirst) return { icon: 'reading', title: t('ns_readTitle'), text: t('ns_readText'), href: '#/test/' + readFirst.id + '/exam', cta: t('startTest') };
    if (!b.counts.writing) return { icon: 'writing', title: t('ns_writeTitle'), text: t('ns_writeText'), href: '#/writing', cta: t('chooseTask') };
    if (!b.counts.speaking) return { icon: 'speaking', title: t('ns_speakTitle'), text: t('ns_speakText'), href: '#/speak/full', cta: t('startSpeaking') };
    const target = s.profile.target || 7;
    const gaps = ['listening', 'reading', 'writing', 'speaking'].map(k => ({ k, gap: target - (b[k] == null ? target - 1 : b[k]) })).sort((x, y) => y.gap - x.gap);
    const weak = gaps[0].k;
    if (weak === 'listening' || weak === 'reading') {
      const acc = typeAccuracy(weak);
      const worst = Object.entries(acc).filter(([k, v]) => v[1] >= 3 && countGroups(k, weak).length).map(([k, v]) => ({ k, p: v[0] / v[1] })).sort((x, y) => x.p - y.p)[0];
      if (worst) return { icon: 'drills', title: t('ns_drillTitle', { type: typeName(worst.k) }), text: t('ns_drillText', { p: Math.round(worst.p * 100) }), href: '#/drill/' + worst.k + '/' + weak, cta: t('startDrill') };
      return { icon: weak, title: t('ns_moreTests'), text: t('ns_moreTestsText'), href: '#/' + weak, cta: t('seeTests') };
    }
    if (weak === 'writing') return { icon: 'writing', title: t('ns_writeMore'), text: t('ns_writeMoreText'), href: '#/writing', cta: t('chooseTask') };
    return { icon: 'speaking', title: t('ns_speakMore'), text: t('ns_speakMoreText'), href: '#/speak/part2', cta: t('startSpeaking') };
  }
  function countGroups(type, skill) {
    const out = [];
    if (!skill || skill === 'reading') for (const test of D().reading || []) test.sections.forEach((sec, si) => sec.groups.forEach(g => { if (g.type === type) out.push({ test, si, group: g, kind: 'reading' }); }));
    if (!skill || skill === 'listening') for (const test of D().listening || []) test.parts.forEach((p, si) => p.groups.forEach(g => { if (g.type === type) out.push({ test, si, group: g, kind: 'listening' }); }));
    return out;
  }

  /* ---------- home ---------- */
  function greeting() {
    const h = new Date().getHours();
    const name = BW.store.s.profile.name;
    const k = h < 12 ? 'gMorning' : h < 18 ? 'gAfternoon' : 'gEvening';
    return name ? t(k + 'Name', { name }) : t(k);
  }
  V.home = function () {
    const s = BW.store.s, p = s.profile;
    const b = latestBands();
    const ov = BW.overallBand(b.listening, b.reading, b.writing, b.speaking);
    const days = BW.daysUntil(p.examDate);
    const g = guide();
    const tokens = [
      { letter: 'L', band: b.listening, title: t('listening') }, { letter: 'R', band: b.reading, title: t('reading') },
      { letter: 'W', band: b.writing, title: t('writing') }, { letter: 'S', band: b.speaking, title: t('speaking') }
    ];
    const ns = nextStep(b);
    const skills = [
      ['listening', '#/listening'], ['reading', '#/reading'], ['writing', '#/writing'], ['speaking', '#/speaking']
    ];
    return `<div class="page">
      <div class="page-head"><div><div class="muted">${esc(greeting())}</div><h1 class="h1">${t('homeTitle')}</h1></div>
        <div class="btn-row">${days != null ? `<span class="chip ${days <= 14 ? 'hl' : ''}">${days > 0 ? t('daysToExam', { n: days }) : days === 0 ? t('examToday') : t('examPast')}</span>` : `<a class="chip" href="#/settings">${t('setExamDate')}</a>`}<a class="btn btn-sm" href="#/plan">${BW.icon('plan')} ${t('studyPlan')}</a></div></div>
      ${V.learningHome ? V.learningHome() : ''}
      ${g.notice ? `<a class="notice hl" href="#/guide/delivery" style="text-decoration:none;color:inherit;margin-bottom:24px">${BW.icon('info')}<div>${esc(BW.L(g.notice))}</div></a>` : ''}
      <div class="home-hero">
        <div>${BW.charts.ruler(tokens, p.target)}</div>
        <div><div class="overall-figure">${ov ? BW.fmtBand(ov.band) : '–'}<small>${ov ? t('estimatedOverall') : t('noOverallYet')}</small></div>
          <dl class="kv"><dt>${t('targetBand')}</dt><dd>${BW.fmtBand(p.target)}</dd><dt>${t('testType')}</dt><dd>${p.module === 'general' ? t('generalTraining') : t('academic')}</dd>${ov ? `<dt>${t('average')}</dt><dd>${ov.avg.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}</dd>` : ''}</dl></div>
      </div>
      <div class="section"><a class="next-step" href="${ns.href}" style="text-decoration:none;color:inherit">${BW.icon(ns.icon)}<div><div class="row-title">${esc(ns.title)}</div><div class="row-meta">${esc(ns.text)}</div></div><span class="btn btn-ink">${esc(ns.cta)}</span></a></div>
      <div class="section"><div class="section-head"><h2 class="h3">${t('yourSkills')}</h2><a class="small" href="#/progress">${t('seeProgress')}</a></div>
        <ul class="ruled">${skills.map(([k, href]) => `<li class="skill-row"><a class="skill-name" href="${href}" style="color:inherit;text-decoration:none">${BW.icon(k)}${t(k)}</a>${BW.charts.miniRuler(b[k], p.target)}<div class="skill-band">${BW.fmtBand(b[k])}</div><div class="btn-row"><span class="small muted">${b.counts[k] === 1 ? t('nAttempt') : t('nAttempts', { n: b.counts[k] })}</span><a class="btn btn-sm" href="${href}">${t('practise')}</a></div></li>`).join('')}</ul></div>
      <div class="section cols">
        <a class="row" href="#/mock" style="grid-template-columns:auto 1fr;border:1px solid var(--rule);padding:16px"><span>${BW.icon('mock')}</span><span><span class="row-title">${t('mockTitle')}</span><span class="row-meta" style="display:block">${t('mockSub')}</span></span></a>
        <a class="row" href="#/guide" style="grid-template-columns:auto 1fr;border:1px solid var(--rule);padding:16px"><span>${BW.icon('guide')}</span><span><span class="row-title">${t('guideTitle')}</span><span class="row-meta" style="display:block">${t('guideSub', { date: BW.fmtDate(g.lastReviewed || '', BW.lang()) })}</span></span></a>
        <a class="row" href="#/vocab" style="grid-template-columns:auto 1fr;border:1px solid var(--rule);padding:16px"><span>${BW.icon('vocab')}</span><span><span class="row-title">${t('vocabulary')}</span><span class="row-meta" style="display:block">${t('vocabSub', { n: dueCount() })}</span></span></a>
      </div>
      <p class="disclaimer">${esc(t('disclaimer'))}</p>
    </div>`;
  };
  function dueCount() {
    const v = BW.store.s.vocab, now = Date.now();
    return Object.values(v).filter(x => x.due <= now).length;
  }

  /* ---------- guide ---------- */
  const L = x => BW.L(x);
  V.guide = function (section) {
    const g = guide();
    if (!g || !g.format) return `<div class="page"><div class="empty">${t('guideMissing')}</div></div>`;
    const toc = [['types', t('g_types')], ['format', t('g_format')], ['delivery', t('g_delivery')], ['scoring', t('g_scoring')], ['results', t('g_results')], ['testday', t('g_testday')], ['changes', t('g_changes')], ['sources', t('g_sources')]];
    const src = id => { const s = (g.sources || []).find(x => x.id === id); return s ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>` : ''; };
    let h = `<div class="page"><div class="page-head"><div><div class="muted small">${t('lastReviewed')}: ${BW.fmtDate(g.lastReviewed, BW.lang())}</div><h1 class="h1">${t('guideTitle')}</h1><p class="lede">${t('guideLede')}</p></div><button class="btn btn-sm" data-guide-update>${BW.icon('refresh')} ${t('checkUpdates')}</button></div>
      ${g.notice ? `<div class="notice hl" style="margin-bottom:28px">${BW.icon('info')}<div>${esc(L(g.notice))}</div></div>` : ''}
      <div class="guide"><nav class="guide-toc" aria-label="${t('guideTitle')}">${toc.map(([id, l]) => `<a href="#/guide/${id}" class="${section === id ? 'on' : ''}">${esc(l)}</a>`).join('')}</nav><div>`;
    // types
    h += `<h2 id="g-types">${t('g_types')}</h2><ul class="ruled">${(g.testTypes || []).map(x => `<li style="padding:14px 4px"><div class="row-title">${esc(L(x.name))}</div><div class="row-meta">${esc(L(x.for))}</div>${x.notes ? `<div class="small faint" style="margin-top:4px">${esc(L(x.notes))}</div>` : ''}</li>`).join('')}</ul>`;
    // format
    h += `<h2 id="g-format">${t('g_format')}</h2>${g.format.order ? `<p class="prose">${esc(L(g.format.order))}</p>` : ''}<div class="table-wrap"><table class="rt"><thead><tr><th>${t('section')}</th><th>${t('time')}</th><th>${t('questionsCol')}</th><th>${t('whatToExpect')}</th></tr></thead><tbody>${(g.format.sections || []).map(x => `<tr><td><b>${esc(L(x.name))}</b></td><td>${esc(L(x.time))}</td><td>${esc(L(x.questions))}</td><td>${(x.structure || []).map(s => `<div>${esc(L(s))}</div>`).join('')}${x.skills ? `<div class="small faint" style="margin-top:4px">${esc(L(x.skills))}</div>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
    // delivery
    h += `<h2 id="g-delivery">${t('g_delivery')}</h2><ul class="ruled">${(g.delivery || []).map(x => `<li style="padding:14px 4px"><div class="btn-row" style="justify-content:space-between"><span class="row-title">${esc(L(x.name))}</span>${x.status ? `<span class="chip ${x.id === 'paper' ? 'warn' : x.id === 'computer' ? 'ok' : ''}">${esc(L(x.status))}</span>` : ''}</div><ul class="small" style="margin:6px 0 0">${(x.points || []).map(p => `<li>${esc(L(p))}</li>`).join('')}</ul></li>`).join('')}</ul>`;
    // scoring
    const sc = g.scoring || {};
    h += `<h2 id="g-scoring">${t('g_scoring')}</h2>
      <ul class="ruled">${(sc.bands || []).map(x => `<li class="row" style="grid-template-columns:56px 1fr;padding:10px 4px"><span class="skill-band" style="text-align:start">${x.band}</span><span><span class="row-title">${esc(L(x.label))}</span><span class="row-meta" style="display:block">${esc(L(x.desc))}</span></span></li>`).join('')}</ul>
      <h3>${t('overallBand')}</h3><p class="prose">${esc(L(sc.overallRule))}</p>
      ${(sc.examples || []).length ? `<div class="table-wrap"><table class="rt num"><thead><tr><th>${t('listening')}</th><th>${t('reading')}</th><th>${t('writing')}</th><th>${t('speaking')}</th><th>${t('average')}</th><th>${t('overall')}</th></tr></thead><tbody>${sc.examples.map(e => `<tr><td>${BW.fmtBand(e.l)}</td><td>${BW.fmtBand(e.r)}</td><td>${BW.fmtBand(e.w)}</td><td>${BW.fmtBand(e.s)}</td><td>${e.avg}</td><td><b>${BW.fmtBand(e.overall)}</b></td></tr>`).join('')}</tbody></table></div>` : ''}
      <h3>${t('rawToBand')}</h3>${sc.officialAverages ? `<p class="small muted">${t('officialAverages')}</p><div class="table-wrap"><table class="rt num"><thead><tr><th>${t('band')}</th><th>${t('listening')}</th><th>${t('academicReading')}</th><th>${t('generalReading')}</th></tr></thead><tbody>${[4, 5, 6, 7, 8].map(bd => { const f = arr => { const r = (arr || []).find(x => x[0] === bd); return r ? r[1] + '/40' : '–'; }; return `<tr><td>${bd}</td><td>${f(sc.officialAverages.listening)}</td><td>${f(sc.officialAverages.academicReading)}</td><td>${f(sc.officialAverages.generalReading)}</td></tr>`; }).join('')}</tbody></table></div>` : ''}
      ${sc.tableNote ? `<p class="small muted">${esc(L(sc.tableNote))}</p>` : ''}
      <details class="more"><summary>${t('fullIndicativeTables')}</summary>${indicativeTables()}</details>
      <h3>${t('writingCriteria')}</h3><ul class="small">${(sc.writingCriteria || []).map(c => `<li><b>${esc(L(c.name))}</b> — ${esc(L(c.desc))}</li>`).join('')}</ul>${sc.taskWeighting ? `<p class="small muted">${esc(L(sc.taskWeighting))}</p>` : ''}
      <h3>${t('speakingCriteria')}</h3><ul class="small">${(sc.speakingCriteria || []).map(c => `<li><b>${esc(L(c.name))}</b> — ${esc(L(c.desc))}</li>`).join('')}</ul>
      <h3 id="calc">${t('bandCalculator')}</h3>${calculator()}`;
    // results
    h += `<h2 id="g-results">${t('g_results')}</h2><ul class="ruled">${(g.results || []).map(x => `<li style="padding:12px 4px"><div class="row-title">${esc(L(x.title))}</div><div class="row-meta">${esc(L(x.text))}</div></li>`).join('')}</ul>`;
    // test day
    const td = g.testDay || {};
    const tdl = (k, cls) => (td[k] || []).length ? `<h3>${t('td_' + k)}</h3><ul class="checklist ${cls || ''}">${td[k].map(x => `<li>${esc(L(x))}</li>`).join('')}</ul>` : '';
    h += `<h2 id="g-testday">${t('g_testday')}</h2><div class="cols"><div>${tdl('before')}${tdl('bring')}${tdl('notAllowed', 'no')}</div><div>${tdl('during')}${tdl('computer')}${tdl('speaking')}</div></div>`;
    // changes
    h += `<h2 id="g-changes">${t('g_changes')}</h2>${(g.news || []).length ? `<h3>${t('latestNews')}</h3><ul class="ruled">${g.news.map(n => `<li style="padding:12px 4px"><div class="small muted">${BW.fmtDate(n.date, BW.lang())}</div><div class="row-title">${esc(L(n.title))}</div><div class="row-meta">${esc(L(n.text))}</div><div class="tiny faint">${(n.sources || []).map(src).join(' · ')}</div></li>`).join('')}</ul>` : ''}
      <h3>${t('howIeltsChanged')}</h3><ol class="timeline">${(g.timeline || []).map(e => `<li class="${/^20(2[3-9])/.test(e.date) ? 'recent' : ''}"><span class="when">${esc(String(e.date).slice(0, 4))}</span><div><div class="row-title">${esc(L(e.title))}</div><div class="row-meta">${esc(L(e.text))}</div>${(e.sources || []).length ? `<div class="tiny faint" style="margin-top:2px">${e.sources.map(src).join(' · ')}</div>` : ''}</div></li>`).join('')}</ol>`;
    // sources
    h += `<h2 id="g-sources">${t('g_sources')}</h2><ul class="small">${(g.sources || []).map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>${s.accessed ? ` <span class="faint">(${esc(s.accessed)})</span>` : ''}</li>`).join('')}</ul>
      <p class="disclaimer">${esc(t('guideDisclaimer'))}</p></div></div></div>`;
    return h;
  };
  function indicativeTables() {
    const rows = tbl => BW.TABLES[tbl].filter(r => r[1] >= 4).map((r, i, a) => `${r[1].toFixed(1)}: ${r[0]}${i === 0 ? '–40' : '–' + (a[i - 1][0] - 1)}`);
    const cols = [['listening', t('listening')], ['academic', t('academicReading')], ['general', t('generalReading')]];
    return `<div class="cols small num">${cols.map(([k, l]) => `<div><b>${esc(l)}</b><ul class="ruled">${rows(k).map(x => `<li style="padding:4px 0">${x}</li>`).join('')}</ul></div>`).join('')}</div><p class="small muted">${t('indicativeNote')}</p>`;
  }
  function calculator() {
    const opts = sel => [...Array(19)].map((_, i) => { const v = i / 2; return `<option value="${v}" ${v === sel ? 'selected' : ''}>${v.toFixed(1)}</option>`; }).reverse().join('');
    return `<div class="sheet" id="calcbox"><div class="grid-2">
      <label class="field"><span>${t('listeningCorrect')}</span><input class="input" type="number" min="0" max="40" value="30" data-calc="l"><small id="cl"></small></label>
      <label class="field"><span>${t('readingCorrect')}</span><input class="input" type="number" min="0" max="40" value="30" data-calc="r"><small id="cr"></small></label>
      <label class="field"><span>${t('readingVersion')}</span><select class="input" data-calc="m"><option value="academic">${t('academic')}</option><option value="general" ${BW.store.s.profile.module === 'general' ? 'selected' : ''}>${t('generalTraining')}</option></select></label>
      <label class="field"><span>${t('writingBandLabel')}</span><select class="input" data-calc="w">${opts(6.5)}</select></label>
      <label class="field"><span>${t('speakingBandLabel')}</span><select class="input" data-calc="s">${opts(6.5)}</select></label>
      </div><div class="btn-row" style="align-items:baseline"><span class="overall-figure" id="cov" style="font-size:3rem"></span><span class="muted" id="cexp"></span></div></div>`;
  }
  V.bindGuide = function () {
    const box = document.getElementById('calcbox');
    const upd = () => {
      if (!box) return;
      const v = k => box.querySelector(`[data-calc="${k}"]`).value;
      const lb = BW.bandFromRaw(BW.clamp(+v('l') || 0, 0, 40), 'listening'), rb = BW.bandFromRaw(BW.clamp(+v('r') || 0, 0, 40), v('m'));
      document.getElementById('cl').textContent = `${t('band')} ${BW.fmtBand(lb)}`;
      document.getElementById('cr').textContent = `${t('band')} ${BW.fmtBand(rb)}`;
      const o = BW.overallBand(lb, rb, +v('w'), +v('s'));
      document.getElementById('cov').textContent = BW.fmtBand(o.band);
      document.getElementById('cexp').textContent = t('calcExplain', { a: o.avg.toFixed(3).replace(/0+$/, '').replace(/\.$/, ''), b: BW.fmtBand(o.band) });
    };
    if (box) { box.addEventListener('input', upd); upd(); }
    const btn = document.querySelector('[data-guide-update]');
    if (btn) btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const r = await fetch('data/guide.json', { cache: 'no-store' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const g = await r.json();
        const cur = guide();
        if (g.version > (cur.version || 0)) { BW.store.s.guide = g; BW.store.save(true); BW.toast(t('guideUpdated', { date: g.lastReviewed })); BW.app.render(); }
        else BW.toast(t('guideUpToDate'));
      } catch (e) { BW.toast(t('guideOffline')); }
      btn.disabled = false;
    });
  };
  V.calculatorPage = () => `<div class="page"><div class="page-head"><div><h1 class="h1">${t('bandCalculator')}</h1><p class="lede">${t('calcLede')}</p></div></div>${calculator()}<details class="more" style="margin-top:20px"><summary>${t('fullIndicativeTables')}</summary>${indicativeTables()}</details></div>`;

  Object.assign(V, { findTest, guideData: guide, latestBands, typeAccuracy, typeName, countGroups, dueCount });
})();
