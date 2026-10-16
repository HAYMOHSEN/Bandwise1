/* Bandwise — local learning history, mistake retrieval and adaptive daily plans. */
(function () {
  'use strict';
  const BW = window.BW;
  const SKILLS = ['listening', 'reading', 'writing', 'speaking'];
  const DAY = 86400000;
  const validDate = value => Number.isFinite(new Date(value).getTime());
  function dayKey(value) {
    const d = value == null ? new Date() : new Date(value);
    if (!Number.isFinite(d.getTime())) return '';
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  }
  function shiftDay(value, offset) {
    const d = new Date(value + 'T12:00:00');
    d.setDate(d.getDate() + offset);
    return dayKey(d);
  }
  const state = () => BW.store.s.learning;
  const matching = a => a.kind !== 'reading' || (a.module || (BW.views.findTest(a.testId) || {}).test?.module) === BW.store.s.profile.module;

  // Runner keys use the displayed section index; parts/drillRef retain the original location.
  function questionsFor(a) {
    if (!['reading', 'listening'].includes(a.kind) || !a.answers) return [];
    let sections;
    if (Array.isArray(a.drillRef) && a.drillRef.length) {
      sections = a.drillRef.map(ref => {
        const found = BW.views.findTest(ref.testId);
        const section = found && (found.test.sections || found.test.parts)[ref.si];
        const group = section && section.groups.find(g => g.id === ref.gid);
        return group ? { test: found.test, section, originalIndex: ref.si, groups: [group] } : null;
      });
    } else {
      const found = BW.views.findTest(a.testId);
      if (!found) return [];
      const all = found.test.sections || found.test.parts;
      const parts = Array.isArray(a.parts) && a.parts.length ? a.parts : all.map((_, i) => i);
      sections = parts.map(si => all[si] ? { test: found.test, section: all[si], originalIndex: si, groups: all[si].groups } : null);
    }
    return sections.flatMap((ref, si) => !ref ? [] : ref.groups.flatMap(group => group.questions.map(q => ({
      id: [ref.test.id, ref.originalIndex, group.id, BW.qKey(q)].join(':'),
      test: ref.test, section: ref.section, group, q, kind: a.kind,
      answer: a.answers[BW.runner.key(si, q)], attemptId: a.id, date: a.date
    }))));
  }
  function mistakes(now = Date.now()) {
    const out = new Map();
    const attempts = BW.store.s.attempts.filter(matching).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
    for (const attempt of attempts) for (const item of questionsFor(attempt)) {
      const result = BW.scoreQuestion(item.q, item.group, item.answer);
      if (result.score === result.max) continue;
      const previous = out.get(item.id);
      out.set(item.id, Object.assign(item, { missed: (previous?.missed || 0) + 1 }));
    }
    return Array.from(out.values()).map(item => {
      const stored = state().reviews[item.id] || {};
      const reset = (stored.reviewedAt || 0) < new Date(item.date).getTime();
      const streak = reset ? 0 : (stored.streak || 0);
      const due = reset ? 0 : (stored.due || 0);
      return Object.assign(item, { note: stored.note || '', streak, due, isDue: due <= now, mastered: streak >= 3 });
    }).sort((a, b) => a.due - b.due || b.missed - a.missed || String(b.date).localeCompare(String(a.date)));
  }
  function recordReview(id, correct, now = Date.now()) {
    const card = mistakes(now).find(c => c.id === id);
    if (!card) return null;
    // Extra practice before a due date does not manufacture spaced-retention evidence.
    if (correct && !card.isDue) {
      recordEvent('review', { itemId: id, correct: true, early: true }, now);
      BW.store.save(true);
      return state().reviews[id];
    }
    const streak = correct ? Math.min(5, card.streak + 1) : 0;
    const days = [0, 1, 3, 7, 14, 30][streak];
    const value = Object.assign({}, state().reviews[id], { streak, due: now + (correct ? days * DAY : 10 * 60000), reviewedAt: now });
    state().reviews[id] = value;
    recordEvent('review', { itemId: id, correct: !!correct }, now);
    BW.store.save(true);
    return value;
  }
  function saveNote(id, note) {
    const previous = state().reviews[id] || {};
    state().reviews[id] = Object.assign({}, previous, { note: String(note).slice(0, 2000) });
    BW.store.save();
  }
  function recordEvent(kind, details, now = Date.now()) {
    state().events.push(Object.assign({ id: BW.uid(), kind, date: new Date(now).toISOString() }, details));
    BW.store.save();
  }
  function activity(now = new Date()) {
    const dates = new Map();
    const add = date => { if (validDate(date)) { const key = dayKey(date); if (key <= dayKey(now)) dates.set(key, (dates.get(key) || 0) + 1); } };
    BW.store.s.attempts.filter(a => ['reading', 'listening'].includes(a.kind)).forEach(a => add(a.date));
    BW.store.s.writing.filter(a => a.text?.trim()).forEach(a => add(a.date));
    BW.store.s.speaking.forEach(a => add(a.date));
    state().events.forEach(a => add(a.date));
    Object.entries(state().days).forEach(([date, plan]) => { if ((plan.tasks || []).some(task => task.done)) add(date + 'T12:00:00'); });
    const today = dayKey(now), yesterday = shiftDay(today, -1);
    let cursor = dates.has(today) ? today : yesterday, streak = 0;
    while (dates.has(cursor)) { streak++; cursor = shiftDay(cursor, -1); }
    return { streak, days: dates, week: Array.from({ length: 7 }, (_, i) => { const date = shiftDay(today, i - 6); return { date, count: dates.get(date) || 0 }; }) };
  }
  function skillRecords(skill) {
    const s = BW.store.s;
    if (skill === 'reading' || skill === 'listening') return s.attempts.filter(a => a.kind === skill && a.full && matching(a) && Number.isFinite(a.band))
      .map(a => ({ band: a.band, date: a.date, source: 'test', href: '#/result/' + a.id }));
    if (skill === 'writing') return s.writing.filter(a => a.taskKind === 't2' && a.text?.trim()).map(a => ({ band: BW.writing.bandOf(a).band, date: a.date, source: BW.writing.bandOf(a).src, href: '#/writing-result/' + a.id })).filter(a => Number.isFinite(a.band));
    return s.speaking.map(a => ({ band: BW.speaking.bandOf(a).band, date: a.date, source: BW.speaking.bandOf(a).src, href: '#/speaking-result/' + a.id })).filter(a => Number.isFinite(a.band));
  }
  function insights() {
    const target = BW.store.s.profile.target;
    return SKILLS.map(skill => {
      const records = skillRecords(skill).sort((a, b) => String(a.date).localeCompare(String(b.date)));
      const recent = records.slice(-3), earlier = records.slice(-6, -3);
      const mean = arr => arr.reduce((sum, a) => sum + a.band, 0) / arr.length;
      const average = recent.length ? mean(recent) : null;
      return { skill, records, average, gap: average == null ? null : target - average, change: earlier.length === 3 && recent.length === 3 ? mean(recent) - mean(earlier) : null };
    });
  }
  function weakTypes(skill) {
    const types = {};
    BW.store.s.attempts.filter(a => a.kind === skill && matching(a)).slice(-10).forEach(a => Object.entries(a.byType || {}).forEach(([key, v]) => {
      const value = types[key] = types[key] || [0, 0]; value[0] += v[0]; value[1] += v[1];
    }));
    return Object.entries(types).filter(([key, v]) => v[1] >= 3 && BW.views.countGroups(key, skill).some(x => skill !== 'reading' || x.test.module === BW.store.s.profile.module))
      .map(([type, v]) => ({ type, accuracy: v[0] / v[1], count: v[1] })).sort((a, b) => a.accuracy - b.accuracy);
  }
  function dailyPlan() {
    const s = BW.store.s, today = dayKey(), ls = state();
    const goal = ls.dailyGoal, fingerprint = [s.profile.module, s.profile.target, goal].join(':');
    let plan = ls.days[today];
    if (!plan || plan.fingerprint !== fingerprint) {
      const cards = mistakes(), due = cards.filter(c => c.isDue).length;
      const tasks = [];
      let remaining = goal;
      if (due) { tasks.push({ id: 'review', kind: 'review', title: 'learnReviewTask', min: 5, href: '#/mistakes/review', count: Math.min(3, due) }); remaining -= 5; }
      tasks.push({ id: 'vocab', kind: 'vocab', title: 'learnVocabTask', min: 5, href: BW.views.dueCount() ? '#/flash/due' : '#/vocab', count: 3 }); remaining -= 5;
      const bands = BW.views.latestBands();
      const order = SKILLS.slice().sort((a, b) => {
        const priority = k => bands[k] == null ? 10 - Math.min(5, bands.counts[k]) : s.profile.target - bands[k];
        return priority(b) - priority(a);
      });
      const focus = (skill, min) => {
        const weak = ['reading', 'listening'].includes(skill) ? weakTypes(skill)[0] : null;
        let href = '#/' + skill;
        if (weak) href = '#/drill/' + weak.type + '/' + skill;
        else if (skill === 'reading') {
          const tests = s.attempts.map(a => a.testId);
          const bank = BW.data.reading.filter(test => test.module === s.profile.module);
          const test = bank.find(test => !tests.includes(test.id)) || bank[0];
          if (test) href = '#/test/' + test.id + '/practice/0';
        } else if (skill === 'writing') href = '#/writing/t2';
        else if (skill === 'speaking') href = '#/speak/part2';
        tasks.push({ id: skill, kind: skill, title: 'learnFocusTask', skill, type: weak?.type || null, min, href });
      };
      if (remaining > 25) { focus(order[0], 20); focus(order[1], remaining - 20); }
      else if (remaining > 0) focus(order[0], remaining);
      const old = new Map((plan?.tasks || []).map(task => [task.id, task.done]));
      tasks.forEach(task => { task.done = old.get(task.id) === true; });
      plan = ls.days[today] = { fingerprint, tasks };
    }
    // Completion is based on saved work in this plan's skill; learners can also mark work done manually.
    for (const task of plan.tasks) {
      if (task.done) continue;
      if (task.kind === 'review' || task.kind === 'vocab') task.auto = ls.events.filter(event => event.kind === task.kind && dayKey(event.date) === today).length >= task.count;
      else if (task.kind === 'writing') task.auto = s.writing.some(a => a.text?.trim() && dayKey(a.date) === today);
      else if (task.kind === 'speaking') task.auto = s.speaking.some(a => dayKey(a.date) === today);
      else task.auto = s.attempts.some(a => a.kind === task.kind && matching(a) && dayKey(a.date) === today && (!task.type || (a.byType || {})[task.type]));
    }
    BW.store.save();
    return plan;
  }
  function toggleTask(id, done) {
    const task = dailyPlan().tasks.find(item => item.id === id);
    if (task) { task.done = !!done; BW.store.save(true); }
  }
  const csvCell = value => {
    let text = String(value == null ? '' : value);
    if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  };
  function progressCSV() {
    const s = BW.store.s;
    const records = [
      ...s.attempts.filter(a => ['reading', 'listening'].includes(a.kind)).map(a => [a.date, a.kind, a.module || '', a.title, a.mode, a.raw, a.max, a.band, a.full ? 'indicative full test' : 'partial test; no band', a.durationSec]),
      ...s.writing.map(a => [a.date, 'writing', a.taskKind, BW.writing.kindName(a.taskKind), a.mode, '', '', BW.writing.bandOf(a).band, BW.writing.bandOf(a).src || '', a.durationSec]),
      ...s.speaking.map(a => [a.date, 'speaking', '', a.mode, 'practice', '', '', BW.speaking.bandOf(a).band, BW.speaking.bandOf(a).src || '', (a.items || []).reduce((sum, item) => sum + (item.seconds || 0), 0)])
    ].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    return '\uFEFF' + [['Date', 'Skill', 'Module or task', 'Title', 'Mode', 'Correct', 'Questions', 'Band', 'Score source', 'Duration (seconds)'], ...records].map(row => row.map(csvCell).join(',')).join('\r\n');
  }
  BW.learning = { SKILLS, dayKey, shiftDay, questionsFor, mistakes, recordReview, saveNote, recordEvent, activity, insights, weakTypes, dailyPlan, toggleTask, progressCSV, csvCell };
})();
