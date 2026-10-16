'use strict';
process.env.TZ = 'Asia/Amman';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
function app() {
  const values = new Map();
  const context = vm.createContext({ console, Date, Math, JSON, URL, Blob, setTimeout: () => 0, clearTimeout() {}, navigator: { language: 'en' }, document: { querySelector: () => null, querySelectorAll: () => [], getElementById: () => null }, localStorage: { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) } });
  context.window = context;
  for (const file of ['content', 'i18n', 'learning-i18n', 'util', 'charts', 'analyzer', 'ai', 'writing', 'speaking', 'views-home', 'views-practice', 'views-more', 'learning', 'views-learning']) vm.runInContext(fs.readFileSync(path.join(root, 'js', file + '.js'), 'utf8'), context, { filename: file + '.js' });
  const BW = context.BW;
  BW.data = context.BW_DATA;
  BW.lang = () => BW.store.s.profile.lang || 'en';
  BW.t = (key, args) => String(context.BW_I18N[BW.lang()][key] || context.BW_I18N.en[key] || key).replace(/\{(\w+)\}/g, (match, key) => args?.[key] ?? match);
  BW.L = value => typeof value === 'string' ? value : value?.[BW.lang()] || value?.en || '';
  BW.runner = { key: (si, q) => si + ':' + BW.qKey(q) };
  return { BW, context, values };
}
function attempt(BW, { testId = 'acad-1', parts = [0], date = new Date().toISOString(), answers = {}, ...rest } = {}) {
  const { test, kind } = BW.views.findTest(testId);
  return BW.store.addAttempt({ testId, kind, module: test.module || null, title: test.title, parts, date, answers, raw: 0, max: 13, full: false, byType: {}, ...rest });
}
function correctAnswers(BW, testId, part) {
  const { test } = BW.views.findTest(testId), section = (test.sections || test.parts)[part];
  return Object.fromEntries(section.groups.flatMap(g => g.questions.map(q => [BW.runner.key(0, q), q.answer])));
}
test('legacy backups are deeply merged and preserve saved learning and drafts', () => {
  const { BW } = app();
  BW.store.replace({ profile: { name: 'Hani', target: 7.5 }, attempts: [], settings: { theme: 'dark' }, drafts: { 'w:t2-1': 'A saved essay' } });
  assert.equal(BW.store.s.profile.name, 'Hani'); assert.equal(BW.store.s.profile.module, 'academic');
  assert.equal(BW.store.s.settings.ai.provider, 'none'); assert.equal(BW.store.s.learning.dailyGoal, 30);
  assert.equal(BW.store.s.drafts['w:t2-1'], 'A saved essay');
  assert.equal(BW.store.s.writing.length, 0); assert.equal(BW.store.s.plan.done && typeof BW.store.s.plan.done, 'object');
});
test('malformed backups cannot replace the current state', () => {
  const { BW } = app(); BW.store.s.profile.name = 'Keep me';
  for (const value of [{ attempts: {} }, { writing: [null] }, { writing: [{}] }, { attempts: [{ id: 'broken', kind: 'reading', date: '2026-10-16' }] }, { profile: [] }, JSON.parse('{"__proto__":{"polluted":true}}')]) assert.throws(() => BW.store.replace(value));
  assert.equal(BW.store.s.profile.name, 'Keep me'); assert.equal({}.polluted, undefined);
});
test('multi-answer scoring counts unique answers and rejects excess selections', () => {
  const { BW } = app(), q = { n: [1, 2], answer: ['A', 'C'] };
  assert.equal(BW.scoreQuestion(q, {}, ['A', 'A']).score, 1);
  assert.equal(BW.scoreQuestion(q, {}, ['A', 'B', 'C']).score, 0);
  assert.equal(BW.scoreQuestion(q, {}, ['C', 'A']).score, 2);
  assert.equal(BW.overallBand(7, 7, 7, '7'), null);
  assert.equal(BW.writing.bandOf({ ai: { overall: 0 } }).band, 0);
});
test('part-only attempts resolve displayed answer indices to original sections', () => {
  const { BW } = app(), answers = correctAnswers(BW, 'acad-1', 1);
  answers['0:14'] = 'wrong'; const a = attempt(BW, { parts: [1], answers });
  const cards = BW.learning.mistakes(); assert.equal(cards.length, 1);
  assert.equal(cards[0].q.n, 14); assert.equal(cards[0].section.n, 2); assert.equal(cards[0].attemptId, a.id);
  assert.equal(cards[0].id, 'acad-1:1:acad1-s2-g1:14');
});
test('drill references map questions from multiple tests without collisions', () => {
  const { BW } = app();
  const first = BW.data.reading.find(t => t.id === 'acad-1'), second = BW.data.reading.find(t => t.id === 'acad-2');
  const g1 = first.sections[0].groups[0], g2 = second.sections[0].groups[0];
  const a = attempt(BW, { parts: null, drill: 'tfng', drillRef: [{ testId: first.id, si: 0, gid: g1.id }, { testId: second.id, si: 0, gid: g2.id }], answers: { '0:1': 'wrong', '1:1': 'wrong' } });
  const refs = BW.learning.questionsFor(a); assert.equal(refs[0].test.id, first.id);
  assert.ok(refs.some(item => item.test.id === second.id && item.answer === 'wrong'));
  assert.equal(new Set(refs.map(item => item.id)).size, refs.length);
});
test('mistakes are deduplicated across attempts and count repeated misses', () => {
  const { BW } = app(); const answers = correctAnswers(BW, 'acad-1', 0); answers['0:1'] = 'FALSE';
  attempt(BW, { answers }); attempt(BW, { answers });
  const cards = BW.learning.mistakes(); assert.equal(cards.length, 1); assert.equal(cards[0].missed, 2); assert.equal(cards[0].isDue, true);
});
test('Academic and General Reading evidence, notebooks and drills remain separate', () => {
  const { BW } = app();
  attempt(BW, { testId: 'acad-1', full: true, band: 8 }); attempt(BW, { testId: 'gen-1', full: true, band: 5 });
  assert.equal(BW.views.latestBands().reading, 8);
  assert.ok(BW.learning.mistakes().every(item => item.test.module === 'academic'));
  BW.store.s.profile.module = 'general'; assert.equal(BW.views.latestBands().reading, 5);
  assert.ok(BW.learning.mistakes().every(item => item.test.module === 'general'));
  assert.equal(BW.learning.insights().find(item => item.skill === 'reading').records.length, 1);
});
test('a different module does not supply a missing Reading band or Task 1 band', () => {
  const { BW } = app(); attempt(BW, { full: true, band: 8 });
  BW.store.s.writing.push({ id: 'w', taskKind: 'at1', text: 'Text', date: new Date().toISOString(), self: { task: 8 } });
  BW.store.s.profile.module = 'general'; const b = BW.views.latestBands();
  assert.equal(b.reading, null); assert.equal(b.writing, null);
});
test('successful retries schedule 1, 3 and 7 days, then count as retained', () => {
  const { BW } = app(); const now = Date.now(); attempt(BW, { date: new Date(now - 10000).toISOString() });
  const id = BW.learning.mistakes()[0].id;
  let due = now;
  for (const [i, days] of [1, 3, 7].entries()) {
    const result = BW.learning.recordReview(id, true, due);
    assert.equal(result.streak, i + 1); assert.equal(result.due, due + days * 86400000);
    due = result.due;
  }
  const card = BW.learning.mistakes(due - 1000).find(item => item.id === id);
  assert.equal(card.mastered, true); assert.equal(card.isDue, false);
});
test('an unsuccessful or revealed retry returns in ten minutes', () => {
  const { BW } = app(); const now = Date.now(); attempt(BW, { date: new Date(now - 1000).toISOString() }); const id = BW.learning.mistakes()[0].id;
  BW.learning.recordReview(id, true, now); const result = BW.learning.recordReview(id, false, now + 100);
  assert.equal(result.streak, 0); assert.equal(result.due, now + 100 + 600000);
});
test('a new failed test reopens a retained question and preserves the learner note', () => {
  const { BW } = app(); const now = Date.now(); const answers = correctAnswers(BW, 'acad-1', 0); answers['0:1'] = 'FALSE';
  attempt(BW, { answers, date: new Date(now - 1000).toISOString() }); const id = BW.learning.mistakes()[0].id;
  BW.learning.saveNote(id, 'Look for evidence.'); BW.learning.recordReview(id, true, now);
  attempt(BW, { answers, date: new Date(now + 1000).toISOString() }); const card = BW.learning.mistakes(now + 2000)[0];
  assert.equal(card.isDue, true); assert.equal(card.streak, 0); assert.equal(card.note, 'Look for evidence.');
});
test('local dates use Amman midnight, and calendar shifts handle month boundaries', () => {
  const { BW } = app(); assert.equal(BW.learning.dayKey('2026-10-16T22:30:00Z'), '2026-10-17');
  assert.equal(BW.learning.shiftDay('2026-11-01', -1), '2026-10-31'); assert.equal(BW.learning.dayKey('bad'), '');
});
test('study streak stays alive until the end of the next day and ignores future activity', () => {
  const { BW } = app();
  BW.store.s.learning.events = [{ kind: 'vocab', date: '2026-10-14T12:00:00Z' }, { kind: 'review', date: '2026-10-15T12:00:00Z' }, { kind: 'vocab', date: '2026-10-18T12:00:00Z' }];
  assert.equal(BW.learning.activity(new Date('2026-10-16T12:00:00Z')).streak, 2);
  assert.equal(BW.learning.activity(new Date('2026-10-17T12:00:00Z')).streak, 0);
});
test('daily plan fits each study budget and remains stable after review completion', () => {
  const { BW } = app(); attempt(BW); const ls = BW.store.s.learning;
  for (const goal of [15, 30, 45, 60]) { ls.dailyGoal = goal; const plan = BW.learning.dailyPlan(); assert.equal(plan.tasks.reduce((sum, task) => sum + task.min, 0), goal); }
  const original = JSON.stringify(BW.learning.dailyPlan().tasks.map(task => task.id));
  for (const card of BW.learning.mistakes()) BW.learning.recordReview(card.id, true);
  assert.equal(JSON.stringify(BW.learning.dailyPlan().tasks.map(task => task.id)), original);
});
test('saved work automatically completes only the appropriate daily task', () => {
  const { BW } = app(); const plan = BW.learning.dailyPlan(); const task = plan.tasks.find(task => task.skill);
  attempt(BW, { testId: task.skill === 'listening' ? 'listen-1' : 'acad-1' });
  assert.equal(BW.learning.dailyPlan().tasks.find(item => item.id === task.id).auto, true);
  assert.equal(BW.learning.dailyPlan().tasks.find(item => item.id === 'vocab').auto, false);
  for (let n = 0; n < 3; n++) BW.learning.recordEvent('vocab', { wordId: 'test' + n });
  assert.equal(BW.learning.dailyPlan().tasks.find(item => item.id === 'vocab').auto, true);
});
test('progress exports escape spreadsheet formulas and include score provenance', () => {
  const { BW } = app(); attempt(BW, { title: '=HYPERLINK("evil")', full: true, band: 7 });
  const csv = BW.learning.progressCSV(); assert.ok(csv.startsWith('\uFEFF')); assert.ok(csv.includes("'=HYPERLINK")); assert.ok(csv.includes('indicative full test'));
  assert.equal(BW.learning.csvCell(' @formula'), '"\' @formula"');
});
test('transcript-only AI cannot supply pronunciation, fluency or overall Speaking scores', async () => {
  const { BW, context } = app(); Object.assign(BW.store.s.settings.ai, { provider: 'on', key: 'test-only', model: 'test-model' });
  context.fetch = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ bands: { FC: 9, LR: 6.5, GRA: 6, P: 9 }, overall: 9, summary: 'Test', strengths: ['Clear'], corrections: [] }) } }] }) });
  const result = await BW.ai.markSpeaking([{ transcript: 'Example answer', question: 'Question', seconds: 20, part: 1 }]);
  assert.equal(result.bands.P, null); assert.equal(result.bands.FC, null); assert.equal(result.overall, null);
  assert.equal(result.bands.LR, 6.5); assert.equal(BW.speaking.bandOf({ ai: { overall: 9 } }).band, null);
  assert.equal(BW.speaking.bandOf({ ai: result, self: { band: 6.5 } }).band, 6.5);
});
test('malformed AI scores are rejected instead of entering progress history', async () => {
  const { BW, context } = app(); Object.assign(BW.store.s.settings.ai, { provider: 'on', key: 'test-only', model: 'test-model' });
  context.fetch = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: '{"bands":{"LR":15,"GRA":"good"}}' } }] }) });
  await assert.rejects(() => BW.ai.markSpeaking([{ transcript: 'Example', part: 1 }]));
});
test('new views render English and Arabic without missing translation keys', () => {
  const { BW } = app();
  for (const lang of ['en', 'ar']) { BW.store.s.profile.lang = lang; const html = BW.views.coach() + BW.views.mistakes() + BW.views.mistakeReview(); assert.ok(!/undefined|NaN|learnTitle|mistakeLede/.test(html)); }
});
test('service worker caches every loaded script and manifest URLs resolve in either deployment path', () => {
  const source = fs.readFileSync(path.join(root, 'sw.js'), 'utf8'); const c = vm.createContext({ self: { addEventListener() {} } });
  vm.runInContext(source + ';globalThis.shell=SHELL', c);
  for (const file of c.shell) assert.ok(fs.existsSync(path.join(root, file)), file);
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const match of html.matchAll(/<script src="([^"]+)"/g)) assert.ok(c.shell.includes(match[1]), match[1]);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest')));
  for (const base of ['https://example.test/Bandwise/', 'https://example.test/bandwise/']) { assert.equal(new URL(manifest.start_url, base).href, base); assert.equal(new URL(manifest.scope, base).href, base); for (const shortcut of manifest.shortcuts) assert.ok(new URL(shortcut.url, base).href.startsWith(base)); }
});

test('early correct practice preserves the next due date and retention streak', () => {
  const { BW } = app(); const now = Date.now(); attempt(BW, { date: new Date(now - 1000).toISOString() });
  const id = BW.learning.mistakes()[0].id; const first = BW.learning.recordReview(id, true, now);
  const early = BW.learning.recordReview(id, true, now + 1000);
  assert.equal(early.streak, 1); assert.equal(early.due, first.due);
});

test('imported daily plans cannot introduce arbitrary links or attributes', () => {
  const { BW } = app(); const backup = JSON.parse(JSON.stringify(BW.store.s));
  backup.learning.days[BW.learning.dayKey()] = { fingerprint: 'academic:7:30', tasks: [{ id: 'reading', kind: 'reading', min: 20, href: 'javascript:alert(1)' }] };
  BW.store.replace(backup); assert.equal(Object.keys(BW.store.s.learning.days).length, 0);
  assert.ok(!BW.views.coach().includes('javascript:'));
});
