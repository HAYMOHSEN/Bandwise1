/* Bandwise — study coach, searchable mistake notebook and active-recall review. */
(function () {
  'use strict';
  const BW = window.BW, V = BW.views, L = BW.learning;
  const { esc } = BW;
  const t = (...args) => BW.t(...args);
  const head = (title, text, actions = '') => `<div class="page-head"><div><h1 class="h1">${esc(title)}</h1><p class="lede">${esc(text)}</p></div>${actions}</div>`;
  const moduleName = () => t(BW.store.s.profile.module === 'general' ? 'generalTraining' : 'academic');
  const taskTitle = task => t(task.title, { skill: task.skill ? t(task.skill) : '' });
  const taskDone = task => task.done || task.auto;
  const displayAnswer = answer => Array.isArray(answer) ? answer.join(', ') : String(answer || t('mistakeBlank'));
  const questionTitle = item => item.q.text || item.group.title || V.typeName(item.group.type);
  const cardStatus = item => item.isDue ? t('mistakeDue') : item.mastered ? t('mistakeMastered') : t('mistakeLearning');
  function weekHTML(activity) {
    return `<div class="learn-week" aria-label="${esc(t('learnLast7'))}">${activity.week.map(day => {
      const label = new Date(day.date + 'T12:00:00').toLocaleDateString(BW.lang() === 'ar' ? 'ar' : 'en', { weekday: 'short' });
      return `<div class="learn-day${day.count ? ' is-active' : ''}${day.date === L.dayKey() ? ' is-today' : ''}" aria-label="${esc(t('learnActivity', { date: day.date, n: day.count }))}"><span>${esc(label)}</span><b>${day.count ? BW.icon('check') : '·'}</b></div>`;
    }).join('')}</div>`;
  }
  function metricsHTML() {
    const cards = L.mistakes(), activity = L.activity();
    const reviewed = BW.store.s.learning.events.filter(event => event.kind === 'review' && L.dayKey(event.date) === L.dayKey()).length;
    const metrics = [[activity.streak, 'learnStreak', 'sparkle'], [cards.filter(c => c.isDue).length, 'learnDue', 'notebook'], [reviewed, 'learnReviewedToday', 'check'], [activity.week.filter(d => d.count).length, 'learnActive', 'plan']];
    return `<div class="learn-metrics">${metrics.map(([value, label, icon]) => `<div class="learn-metric">${BW.icon(icon)}<strong class="num">${value}</strong><span>${esc(t(label))}</span></div>`).join('')}</div>`;
  }
  V.learningHome = function () {
    const cards = L.mistakes(), due = cards.filter(c => c.isDue).length, plan = L.dailyPlan();
    const done = plan.tasks.filter(taskDone).reduce((sum, task) => sum + task.min, 0), total = plan.tasks.reduce((sum, task) => sum + task.min, 0);
    const next = plan.tasks.find(task => !taskDone(task));
    return `<section class="learn-home" aria-labelledby="learn-home-title"><div><div class="learn-eyebrow">${esc(t('learnEyebrow'))}</div><h2 id="learn-home-title" class="h2">${esc(t('learnMobileTitle'))}</h2><p>${esc(next ? taskTitle(next) : t('learnAllDone'))}</p>
      <div class="learn-mini-progress" role="progressbar" aria-label="${esc(t('learnToday'))}" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}"><i style="width:${total ? done / total * 100 : 0}%"></i></div><div class="small">${esc(t('learnCompleted', { done, total }))}</div></div>
      <div class="learn-home-actions"><a class="btn btn-hl" href="#/coach">${BW.icon('coach')}${esc(t('learnViewPlan'))}</a>${due ? `<a class="learn-home-review" href="#/mistakes/review">${esc(t('mistakeStart'))} <b class="num">${due}</b></a>` : `<a class="learn-home-review" href="#/mistakes">${esc(t('mistakes'))}</a>`}</div></section>${metricsHTML()}`;
  };
  V.coach = function () {
    const plan = L.dailyPlan(), activity = L.activity(), snapshots = L.insights();
    const total = plan.tasks.reduce((sum, task) => sum + task.min, 0), done = plan.tasks.filter(taskDone).reduce((sum, task) => sum + task.min, 0);
    const reason = task => task.kind === 'review' ? t('learnReviewReason', { n: task.count }) : task.kind === 'vocab' ? t('learnVocabReason') : task.type ? t('learnWeakReason', { type: V.typeName(task.type), p: Math.round((L.weakTypes(task.kind).find(x => x.type === task.type)?.accuracy || 0) * 100) }) : t('learnFocusReason');
    return `<div class="page learn-page">${head(t('learnTitle'), t('learnLede'), `<div class="btn-row no-print"><button class="btn btn-sm" data-learn-print>${BW.icon('download')}${esc(t('learnPrint'))}</button><button class="btn btn-sm" data-learn-csv>${esc(t('learnCSV'))}</button></div>`)}
      <div class="learn-module small">${esc(t('learnModuleNote', { module: moduleName() }))} · ${esc(t('targetBand'))} <b>${BW.fmtBand(BW.store.s.profile.target)}</b><a class="no-print" href="#/settings">${esc(t('settings'))}</a></div>
      ${metricsHTML()}<div class="learn-layout"><section class="learn-panel"><div class="section-head"><h2 class="h3">${esc(t('learnToday'))}</h2><label class="learn-budget no-print"><span class="sr-only">${esc(t('learnGoal'))}</span><select class="input" data-learn-goal aria-label="${esc(t('learnGoal'))}">${[15, 30, 45, 60].map(n => `<option value="${n}" ${BW.store.s.learning.dailyGoal === n ? 'selected' : ''}>${esc(t('learnMinutes', { n }))}</option>`).join('')}</select></label></div>
      <p class="small muted">${esc(t('learnCompleted', { done, total }))}</p><div class="learn-progress" role="progressbar" aria-label="${esc(t('learnToday'))}" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}"><i style="width:${done / total * 100}%"></i></div>
      <ol class="learn-tasks">${plan.tasks.map(task => `<li class="${taskDone(task) ? 'is-done' : ''}"><label class="learn-task-check"><input type="checkbox" data-learn-task="${esc(task.id)}" ${taskDone(task) ? 'checked' : ''} ${task.auto ? 'disabled' : ''} aria-label="${esc(taskTitle(task))}"><span><strong>${esc(taskTitle(task))}</strong><small>${esc(task.auto ? t('learnAutoDone') : reason(task))}</small></span></label><div class="learn-task-action"><span class="small muted">${esc(t('learnMinutes', { n: task.min }))}</span><a class="btn btn-sm no-print" href="${esc(task.href)}">${esc(t('learnOpen'))}</a></div></li>`).join('')}</ol>
      ${done === total ? `<p class="notice hl">${esc(t('learnAllDone'))}</p>` : ''}<p class="tiny faint">${esc(t('learnBudgetNote'))}</p></section>
      <aside class="learn-panel learn-consistency"><h2 class="h3">${esc(t('learnLast7'))}</h2>${weekHTML(activity)}<div class="learn-consistency-number num">${activity.week.filter(day => day.count).length}<small>/ 7</small></div><p class="muted small">${esc(t('learnActive'))}</p><a class="btn no-print" href="#/mistakes">${BW.icon('notebook')}${esc(t('mistakes'))}</a><p class="tiny faint">${esc(t('mistakeSpacing'))}</p></aside></div>
      <section class="section"><div class="section-head"><h2 class="h3">${esc(t('learnSnapshot'))}</h2><a class="small no-print" href="#/progress">${esc(t('seeProgress'))}</a></div><div class="learn-snapshots">${snapshots.map(snapshot => {
        const latest = snapshot.records[snapshot.records.length - 1];
        return `<article class="learn-snapshot"><h3>${BW.icon(snapshot.skill)}${esc(t(snapshot.skill))}</h3><div class="learn-snapshot-band num">${snapshot.average == null ? '–' : snapshot.average.toFixed(1)}<small>${esc(t('learnRecent'))}</small></div>${snapshot.average == null ? `<p class="small muted">${esc(t('learnNeedEvidence'))}</p>` : `<span class="chip ${snapshot.gap > 0 ? 'warn' : 'ok'}">${esc(snapshot.gap > 0 ? t('learnGap', { n: snapshot.gap.toFixed(1) }) : t('learnAtTarget'))}</span><p class="small muted">${esc(t('learnEvidence', { n: snapshot.records.length }))}<br>${esc(t('learnSource_' + latest.source))}</p>`}${snapshot.change != null ? `<p class="learn-change" title="${esc(t('learnTrendNote'))}">${esc(Math.abs(snapshot.change) < 0.05 ? t('learnTrendFlat') : t(snapshot.change > 0 ? 'learnTrendUp' : 'learnTrendDown', { n: Math.abs(snapshot.change).toFixed(1) }))}</p>` : ''}</article>`;
      }).join('')}</div><p class="small faint" style="margin-top:12px">${esc(t('learnSnapshotNote'))} ${esc(t('learnTrendNote'))}</p></section>
      <section class="section"><h2 class="h3">${esc(t('learnWeakTypes'))}</h2><p class="small muted">${esc(t('learnWeakTypesNote'))}</p>${weakHTML()}</section></div>`;
  };
  function weakHTML() {
    const rows = ['reading', 'listening'].flatMap(skill => L.weakTypes(skill).slice(0, 2).map(row => Object.assign({ skill }, row)));
    return rows.length ? `<ul class="ruled">${rows.map(row => `<li class="row"><div><strong>${esc(V.typeName(row.type))}</strong><div class="row-meta">${esc(t(row.skill))} · ${Math.round(row.accuracy * 100)}% · ${row.count} ${esc(t('questionsWord'))}</div></div><a class="btn btn-sm no-print" href="#/drill/${row.type}/${row.skill}">${esc(t('startDrill'))}</a></li>`).join('')}</ul>` : `<div class="learn-empty"><p>${esc(t('learnNoWeak'))}</p><a class="btn no-print" href="#/reading">${esc(t('startReading'))}</a></div>`;
  }
  V.bindCoach = function () {
    const main = document.getElementById('main');
    main.addEventListener('change', e => {
      if (e.target.matches('[data-learn-goal]')) { BW.store.s.learning.dailyGoal = Number(e.target.value); BW.store.save(true); BW.app.render(); }
      if (e.target.matches('[data-learn-task]')) { L.toggleTask(e.target.dataset.learnTask, e.target.checked); BW.app.render(); }
    });
    V.bindLearningExports();
  };
  V.bindLearningExports = function () {
    const main = document.getElementById('main');
    main.addEventListener('click', e => {
      if (e.target.closest('[data-learn-print]')) window.print();
      if (e.target.closest('[data-learn-csv]')) BW.download('bandwise-results-' + L.dayKey() + '.csv', L.progressCSV(), 'text/csv;charset=utf-8');
    });
  };

  /* The notebook derives questions from original tests; backups only store review scheduling and notes. */
  let filters = { skill: '', type: '', status: 'all', query: '', page: 0 };
  function promptHTML(item) {
    const { group, q } = item;
    const blank = value => esc(value).replace(/\{\{(\d+)\}\}/g, (_, n) => `<span class="nb-gap${BW.qNums(q).includes(+n) ? ' is-current' : ''}">[${n}] ____</span>`);
    let html = `<div class="nb-prompt" lang="en" dir="ltr"><p class="small muted">${esc(group.instructions)}</p>`;
    if (group.title) html += `<h3 class="h4">${esc(group.title)}</h3>`;
    if (group.template) html += `<div class="nb-template">${blank(group.template)}</div>`;
    if (group.table) html += `<div class="table-wrap"><table class="rt"><thead><tr>${group.table.headers.map(text => `<th>${esc(text)}</th>`).join('')}</tr></thead><tbody>${group.table.rows.map(row => `<tr>${row.map(text => `<td>${blank(text)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    if (group.figure) html += `<div class="figure-box">${group.figure}</div>`;
    if (q.text) html += `<p class="nb-question"><b>${BW.qNums(q).join('–')}.</b> ${esc(q.text)}</p>`;
    return html + '</div>';
  }
  function sourceHTML(item) {
    let html = `<details class="nb-source"><summary>${esc(t('mistakeContext'))}</summary><div lang="en" dir="ltr">`;
    if (item.kind === 'reading') html += (item.section.texts || []).map(text => `<h3 class="h4">${esc(text.heading || '')}</h3>${(text.paragraphs || []).map(p => `<p>${p.label ? `<b>${esc(p.label)}.</b> ` : ''}${esc(p.text)}</p>`).join('')}`).join('');
    else html += (item.section.script || []).filter(line => line.text).map(line => `<p>${line.who ? `<b>${esc(line.who)}:</b> ` : ''}${esc(line.text)}</p>`).join('');
    return html + '</div></details>';
  }
  function explanationHTML(item) {
    const opts = item.q.choices || item.group.options || [];
    const correct = (Array.isArray(item.q.answer) ? item.q.answer : [item.q.answer]).map(value => {
      const option = opts.find(o => o.key === value);
      return value + (option && option.text !== value ? ' — ' + option.text : '');
    }).join('; ');
    return `<div class="nb-explanation"><span class="small">${esc(t('mistakeCorrect'))}</span><p lang="en" dir="ltr"><b>${esc(correct)}</b></p><span class="small muted">${esc(t('mistakeExplanation'))}</span><p lang="en" dir="ltr">${esc(item.q.explanation || '')}</p></div>`;
  }
  const retryURL = item => '#/mistakes/review/' + encodeURIComponent(item.id);
  V.mistakes = function () {
    const cards = L.mistakes(), due = cards.filter(c => c.isDue).length;
    const types = Array.from(new Set(cards.map(c => c.group.type))).sort();
    return `<div class="page">${head(t('mistakes'), t('mistakeLede'), due ? `<a class="btn btn-ink" href="#/mistakes/review">${BW.icon('refresh')}${esc(t('mistakeStart'))}<span class="num">${due}</span></a>` : '')}
      <div class="nb-stats"><span class="chip">${esc(t('mistakeAll'))}: ${cards.length}</span><span class="chip hl">${esc(t('mistakeDue'))}: ${due}</span><span class="chip ok">${esc(t('mistakeMastered'))}: ${cards.filter(c => c.mastered).length}</span></div>
      ${cards.length ? `<div class="nb-filters no-print"><label class="field nb-search"><span>${esc(t('mistakeSearch'))}</span><input class="input" type="search" data-nb-filter="query" value="${esc(filters.query)}"></label>
      <label class="field"><span>${esc(t('mistakeSkill'))}</span><select class="input" data-nb-filter="skill">${[['', 'mistakeAllSkills'], ['reading', 'reading'], ['listening', 'listening']].map(([key, label]) => `<option value="${key}" ${filters.skill === key ? 'selected' : ''}>${esc(t(label))}</option>`).join('')}</select></label>
      <label class="field"><span>${esc(t('mistakeType'))}</span><select class="input" data-nb-filter="type"><option value="">${esc(t('mistakeAllTypes'))}</option>${types.map(type => `<option value="${type}" ${filters.type === type ? 'selected' : ''}>${esc(V.typeName(type))}</option>`).join('')}</select></label>
      <label class="field"><span>${esc(t('mistakeStatus'))}</span><select class="input" data-nb-filter="status">${[['all', 'mistakeAll'], ['due', 'mistakeDue'], ['learning', 'mistakeLearning'], ['mastered', 'mistakeMastered']].map(([key, label]) => `<option value="${key}" ${filters.status === key ? 'selected' : ''}>${esc(t(label))}</option>`).join('')}</select></label></div><div id="notebook-results" aria-live="polite">${notebookList()}</div>` : `<div class="learn-empty"><div class="learn-empty-icon">${BW.icon('notebook')}</div><h2 class="h3">${esc(t('mistakeNoItems'))}</h2><p class="muted">${esc(t('mistakeNoItemsHelp'))}</p><div class="btn-row"><a class="btn btn-ink" href="#/reading">${esc(t('reading'))}</a><a class="btn" href="#/listening">${esc(t('listening'))}</a></div></div>`}
      <p class="small faint section">${esc(t('mistakeSpacing'))}</p></div>`;
  };
  function notebookList() {
    const query = filters.query.toLowerCase().trim();
    const cards = L.mistakes().filter(card => (!filters.skill || card.kind === filters.skill) && (!filters.type || card.group.type === filters.type)
      && (filters.status === 'all' || filters.status === 'due' && card.isDue || filters.status === 'mastered' && card.mastered || filters.status === 'learning' && !card.mastered)
      && (!query || [questionTitle(card), card.group.template, JSON.stringify(card.group.table || ''), card.q.answer, card.q.explanation, card.note, card.test.title].join(' ').toLowerCase().includes(query)));
    const pages = Math.ceil(cards.length / 12); filters.page = Math.min(filters.page, Math.max(0, pages - 1));
    if (!cards.length) return `<div class="learn-empty">${esc(t('mistakeNoMatches'))}</div>`;
    return `<div class="nb-list">${cards.slice(filters.page * 12, (filters.page + 1) * 12).map(item => `<details class="nb-card"><summary><span class="nb-card-icon">${BW.icon(item.kind)}</span><span class="nb-card-title"><strong lang="en" dir="ltr">${esc(questionTitle(item))}</strong><small>${esc(item.test.title)} · ${esc(t('question'))} ${BW.qNums(item.q).join('–')} · ${esc(V.typeName(item.group.type))}</small></span><span class="chip ${item.isDue ? 'hl' : item.mastered ? 'ok' : ''}">${esc(cardStatus(item))}</span></summary>
      <div class="nb-card-body">${promptHTML(item)}<p class="small muted">${esc(t('mistakeYourAnswer'))}: <b lang="en" dir="ltr">${esc(displayAnswer(item.answer))}</b> · ${esc(t('mistakeMissed', { n: item.missed }))}</p>${explanationHTML(item)}${sourceHTML(item)}
      <label class="field nb-note"><span>${esc(t('mistakeNote'))}</span><textarea class="input" rows="2" maxlength="2000" data-nb-note="${esc(item.id)}" placeholder="${esc(t('mistakeNoteHint'))}">${esc(item.note)}</textarea><small data-note-status>${esc(t('mistakeNoteSaved'))}</small></label>
      <div class="btn-row"><a class="btn btn-ink" href="${retryURL(item)}">${esc(t('mistakeRetry'))}</a><a class="btn btn-ghost" href="#/review/${esc(item.attemptId)}">${esc(t('mistakeOriginal'))}</a>${item.due ? `<span class="small muted">${esc(t('mistakeNextDue', { date: BW.fmtDate(new Date(item.due).toISOString(), BW.lang()) }))}</span>` : ''}</div></div></details>`).join('')}</div>
      ${pages > 1 ? `<div class="btn-row nb-pagination"><button class="btn btn-sm" data-nb-page="${filters.page - 1}" ${filters.page === 0 ? 'disabled' : ''}>${BW.icon('back')} ${esc(t('previous'))}</button><span class="small num">${filters.page + 1} / ${pages}</span><button class="btn btn-sm" data-nb-page="${filters.page + 1}" ${filters.page === pages - 1 ? 'disabled' : ''}>${esc(t('next'))}</button></div>` : ''}`;
  }
  V.bindMistakes = function () {
    const main = document.getElementById('main');
    const filter = event => {
      const key = event.target.dataset.nbFilter;
      if (!key) return;
      filters[key] = event.target.value; filters.page = 0;
      document.getElementById('notebook-results').innerHTML = notebookList();
    };
    main.addEventListener('input', e => {
      if (e.target.matches('[data-nb-filter="query"]')) filter(e);
      if (e.target.matches('[data-nb-note]')) { L.saveNote(e.target.dataset.nbNote, e.target.value); e.target.nextElementSibling.textContent = t('mistakeNoteSaved'); }
    });
    main.addEventListener('change', e => { if (e.target.tagName === 'SELECT') filter(e); });
    main.addEventListener('click', e => { const b = e.target.closest('[data-nb-page]'); if (b) { filters.page = Number(b.dataset.nbPage); document.getElementById('notebook-results').innerHTML = notebookList(); document.getElementById('notebook-results').scrollIntoView({ block: 'start' }); } });
  };

  let session = null;
  V.mistakeReview = function (encodedId) {
    let id = null; try { id = encodedId ? decodeURIComponent(encodedId) : null; } catch (_) { /* invalid route */ }
    const cards = L.mistakes();
    session = { cards: id ? cards.filter(card => card.id === id) : cards.filter(card => card.isDue).slice(0, 20), index: 0, checked: false, correct: 0, answer: null };
    return `<div class="page nb-review-page"><a class="back" href="#/mistakes">${BW.icon('back')}${esc(t('mistakeBack'))}</a>${head(t('mistakeReview'), t('mistakeSpacing'))}<div id="nb-review-stage">${reviewHTML()}</div></div>`;
  };
  function retryInput(item) {
    const { q, group } = item;
    const opts = q.choices || group.options || (group.type === 'tfng' ? ['TRUE', 'FALSE', 'NOT GIVEN'].map(key => ({ key, text: key })) : group.type === 'ynng' ? ['YES', 'NO', 'NOT GIVEN'].map(key => ({ key, text: key })) : null);
    if (!opts) return `<label class="field"><span>${esc(t('mistakeAnswerLabel'))}</span><input class="input" name="retry" value="${esc(session.answer || '')}" ${session.checked ? 'disabled' : ''} autocomplete="off" spellcheck="false" lang="en" dir="ltr"></label>`;
    const multi = Array.isArray(q.n);
    return `<fieldset class="nb-options"><legend class="small">${esc(multi ? t('mistakeChoose', { n: q.n.length }) : t('mistakeAnswerLabel'))}</legend>${opts.map(option => `<label lang="en" dir="ltr"><input type="${multi ? 'checkbox' : 'radio'}" name="retry" value="${esc(option.key)}" ${(multi ? (session.answer || []).includes(option.key) : session.answer === option.key) ? 'checked' : ''} ${session.checked ? 'disabled' : ''}><span><b>${esc(option.key)}</b>${option.text !== option.key ? ' · ' + esc(option.text) : ''}</span></label>`).join('')}</fieldset>`;
  }
  function reviewHTML() {
    if (!session.cards.length) return `<div class="learn-empty"><h2 class="h3">${esc(t('mistakeEmptyDue'))}</h2><p class="muted">${esc(t('mistakeEmptyDueHelp'))}</p><a class="btn" href="#/coach">${esc(t('learnViewPlan'))}</a></div>`;
    if (session.index >= session.cards.length) return `<div class="learn-empty"><div class="learn-empty-icon">${BW.icon('check')}</div><h2 class="h3">${esc(t('mistakeSession', { n: session.cards.length, correct: session.correct }))}</h2><div class="btn-row"><a class="btn btn-ink" href="#/mistakes">${esc(t('mistakeBack'))}</a><a class="btn" href="#/coach">${esc(t('learnViewPlan'))}</a></div></div>`;
    const item = session.cards[session.index];
    return `<div class="nb-review-counter"><span>${esc(t('mistakeReviewCount', { n: session.index + 1, total: session.cards.length }))}</span><span class="chip">${esc(t(item.kind))} · ${esc(V.typeName(item.group.type))}</span></div><article class="learn-panel nb-review-card"><div class="small muted" lang="en" dir="ltr">${esc(item.test.title)}</div>${promptHTML(item)}${sourceHTML(item)}<form id="nb-retry-form">${retryInput(item)}
      ${session.checked ? `<div class="notice ${session.result ? 'hl' : 'warn'}" role="status">${esc(t(session.revealed ? 'mistakeReviewRevealed' : session.result ? 'mistakeReviewCorrect' : 'mistakeReviewWrong'))}</div>${explanationHTML(item)}<p class="small muted">${esc(t('mistakeNextDue', { date: new Date(session.scheduled.due).toLocaleString(BW.lang() === 'ar' ? 'ar' : 'en-GB') }))}</p><button class="btn btn-ink" type="button" data-nb-next>${esc(t(session.index === session.cards.length - 1 ? 'mistakeFinish' : 'mistakeNext'))}</button>` : `<p id="nb-retry-error" class="small nb-error" role="status"></p><div class="btn-row"><button class="btn btn-ink" type="submit">${esc(t('mistakeCheck'))}</button><button class="btn btn-ghost" type="button" data-nb-reveal>${esc(t('mistakeReveal'))}</button></div>`}</form></article>`;
  }
  V.bindMistakeReview = function () {
    const stage = document.getElementById('nb-review-stage');
    function check(reveal) {
      if (session.checked) return;
      const item = session.cards[session.index], multi = Array.isArray(item.q.n);
      const input = stage.querySelector('input[name="retry"]');
      let answer = null;
      if (input && input.type === 'text') answer = input.value.trim();
      else { const chosen = Array.from(stage.querySelectorAll('input[name="retry"]:checked')).map(el => el.value); answer = multi ? chosen : chosen[0]; }
      if (!reveal && (!answer || Array.isArray(answer) && answer.length !== item.q.n.length)) { document.getElementById('nb-retry-error').textContent = t(multi ? 'mistakeChoose' : 'mistakeRequired', { n: item.q.n.length }); return; }
      const result = reveal ? false : BW.scoreQuestion(item.q, item.group, answer).score === BW.qNums(item.q).length;
      session.answer = answer; session.checked = true; session.result = result; session.revealed = reveal;
      session.scheduled = L.recordReview(item.id, result);
      if (result) session.correct++;
      stage.innerHTML = reviewHTML(); stage.querySelector('[data-nb-next]')?.focus({ preventScroll: true });
    }
    stage.addEventListener('submit', e => { e.preventDefault(); check(false); });
    stage.addEventListener('click', e => {
      if (e.target.closest('[data-nb-reveal]')) check(true);
      if (e.target.closest('[data-nb-next]') && session.checked) { session.index++; session.checked = false; session.answer = null; stage.innerHTML = reviewHTML(); stage.scrollIntoView({ block: 'start' }); stage.querySelector('input, a')?.focus({ preventScroll: true }); }
    });
  };
})();
