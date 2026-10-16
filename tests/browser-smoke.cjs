'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'qa-output');
fs.mkdirSync(output, { recursive: true });
const mime = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/Bandwise\//, '/');
  const relative = pathname.endsWith('/') ? pathname + 'index.html' : pathname;
  const file = path.resolve(root, '.' + relative);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port + '/Bandwise/';
  const browser = await chromium.launch({ headless: true, ...(process.env.BW_CHROMIUM_EXECUTABLE ? { executablePath: process.env.BW_CHROMIUM_EXECUTABLE, args: ['--no-sandbox'] } : {}) });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, timezoneId: 'Asia/Amman' });
    const page = await context.newPage(); const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const go = async route => { await page.goto(base + '#/' + route); await page.waitForFunction(() => window.BW?.app); await page.waitForTimeout(80); };
    await go(''); await page.locator('[data-v="en"]').click(); await page.locator('[data-obf="name"]').fill('Hani');
    await page.locator('[data-ob-done]').focus(); await page.keyboard.press('Tab');
    assert.equal(await page.locator('[data-v="en"]').first().evaluate(el => el === document.activeElement), true, 'modal focus wraps');
    await page.locator('[data-ob-done]').click(); assert.equal(await page.locator('[role="dialog"]').count(), 0);
    await go('test/acad-1/practice/0');
    await page.locator('input[data-k="0:7"]').fill('ponds');
    await page.locator('input[data-k="0:1"][value="FALSE"]').check();
    await page.locator('[data-x="check"]').click();
    assert.equal(await page.evaluate(() => BW.store.s.attempts.length), 1, 'practice saved');
    await page.locator('[data-x="help"]').click(); assert.equal(await page.locator('[role="dialog"]').count(), 1, 'review controls survive rerender');
    await page.locator('[data-close]').click(); await page.locator('[data-x="close"]').click();
    await go('mistakes');
    assert.equal(await page.locator('.nb-card').count(), 12, 'missed questions collected, correct question omitted');
    const noteText = 'Find evidence before choosing NOT GIVEN.';
    await page.locator('.nb-card > summary').first().click();
    await page.locator('[data-nb-note]').first().fill(noteText);
    await page.locator('[data-nb-filter="query"]').fill(noteText);
    assert.equal(await page.locator('.nb-card').count(), 1, 'notes are searchable');
    await page.waitForFunction(text => localStorage.getItem('bandwise.v1').includes(text), noteText);
    await page.reload(); await page.waitForFunction(() => window.BW?.learning);
    assert.ok(await page.evaluate(text => BW.learning.mistakes().some(card => card.note === text), noteText), 'notes persist after reload');
    await page.locator('[data-nb-filter="query"]').fill('');
    await page.evaluate(() => document.getElementById('toast').replaceChildren()); await page.screenshot({ path: path.join(output, 'notebook-desktop.png'), fullPage: true });
    const reviewId = await page.evaluate(() => BW.learning.mistakes().find(c => c.q.n === 1).id);
    await go('mistakes/review/' + encodeURIComponent(reviewId));
    await page.locator('button[type="submit"]').click(); assert.match(await page.locator('#nb-retry-error').innerText(), /answer first/);
    await page.locator('input[name="retry"][value="TRUE"]').check(); await page.locator('button[type="submit"]').click();
    assert.match(await page.locator('.notice').innerText(), /Correct/);
    const record = await page.evaluate(id => BW.store.s.learning.reviews[id], reviewId);
    assert.equal(record.streak, 1); assert.ok(record.due > Date.now() + 23 * 3600000);
    assert.equal(await page.locator('.nb-explanation').count(), 1);
    await page.locator('[data-nb-next]').click(); assert.match(await page.locator('#nb-review-stage').innerText(), /1 questions.*1 correct/);
    // Add real-bank fixtures for each question widget; source content is never fabricated.
    await page.evaluate(() => {
      const make = (testId, parts) => {
        const found = BW.views.findTest(testId), byType = {}; let max = 0;
        for (const si of parts) for (const group of (found.test.sections || found.test.parts)[si].groups) {
          const count = group.questions.reduce((sum, q) => sum + BW.qNums(q).length, 0); max += count;
          byType[group.type] = [0, (byType[group.type]?.[1] || 0) + count];
        }
        return BW.store.addAttempt({ kind: found.kind, testId, module: found.test.module || null, parts, answers: {}, byType, raw: 0, max, band: max === 40 ? 0 : null, full: max === 40, mode: 'exam', title: found.test.title });
      };
      make('listen-1', [0, 1, 2, 3]); make('acad-1', [0, 1, 2]); BW.store.save(true);
    });
    for (const type of ['form_completion', 'table_completion', 'map_labelling', 'mcq_multi', 'matching_headings', 'summary_wordbank']) {
      const card = await page.evaluate(type => { const c = BW.learning.mistakes().find(item => item.group.type === type); return { id: c.id, answer: c.q.answer, multi: Array.isArray(c.q.n) }; }, type);
      await go('mistakes/review/' + encodeURIComponent(card.id));
      if (['map_labelling'].includes(type)) assert.ok(await page.locator('.figure-box svg').count(), 'map supplied');
      if (type === 'table_completion') assert.ok(await page.locator('.nb-prompt table').count(), 'table supplied');
      if (await page.locator('input[name="retry"]').first().getAttribute('type') === 'text' || type === 'form_completion' || type === 'table_completion') await page.locator('input[name="retry"]').fill(card.answer);
      else for (const value of Array.isArray(card.answer) ? card.answer : [card.answer]) await page.locator('input[name="retry"][value="' + value + '"]').check();
      await page.locator('button[type="submit"]').click(); assert.match(await page.locator('.notice').innerText(), /Correct/, type);
    }
    const revealId = await page.evaluate(() => BW.learning.mistakes().find(item => item.q.n === 2 && item.kind === 'reading').id);
    await go('mistakes/review/' + encodeURIComponent(revealId)); await page.locator('[data-nb-reveal]').click();
    assert.match(await page.locator('.notice').innerText(), /revealed/);
    assert.equal(await page.evaluate(id => BW.store.s.learning.reviews[id].streak, revealId), 0);
    await go('coach'); await page.evaluate(() => document.getElementById('toast').replaceChildren()); await page.screenshot({ path: path.join(output, 'coach-desktop.png'), fullPage: true });
    await page.emulateMedia({ media: 'print' });
    assert.equal(await page.locator('.rail').evaluate(el => getComputedStyle(el).display), 'none');
    assert.equal(await page.locator('.shell').evaluate(el => getComputedStyle(el).display), 'block');
    await page.emulateMedia({ media: 'screen' });
    const downloadPromise = page.waitForEvent('download'); await page.locator('[data-learn-csv]').click(); const download = await downloadPromise; assert.match(download.suggestedFilename(), /bandwise-results.*csv/);
    await page.locator('[data-learn-goal]').selectOption('45'); assert.equal(await page.evaluate(() => BW.learning.dailyPlan().tasks.reduce((sum, task) => sum + task.min, 0)), 45);
    await page.evaluate(() => { BW.store.s.settings.ai.key = 'test-key-do-not-export'; BW.store.save(true); });
    await go('progress'); const backupDownload = page.waitForEvent('download'); await page.locator('[data-export]').click(); const backup = await backupDownload; const backupData = JSON.parse(fs.readFileSync(await backup.path()));
    assert.equal(backupData.settings.ai.key, ''); assert.ok(backupData.learning.reviews[reviewId]);
    await page.locator('[data-import]').setInputFiles({ name: 'legacy.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ profile: { name: 'Restored', onboarded: true, lang: 'en' }, attempts: [], settings: { theme: 'dark' } })) });
    await page.locator('[data-a="yes"]').click();
    assert.equal(await page.evaluate(() => BW.store.s.settings.ai.key), 'test-key-do-not-export');
    assert.equal(await page.evaluate(() => BW.store.s.profile.name), 'Restored'); assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.locator('[data-import]').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"profile":{},"attempts":{}}') });
    assert.equal(await page.evaluate(() => BW.store.s.profile.name), 'Restored'); assert.equal(await page.locator('[role="dialog"]').count(), 0);
    // Verify every static route, then Arabic and phone layouts for new screens.
    for (const route of ['', 'guide', 'calculator', 'listening', 'reading', 'writing', 'speaking', 'drills', 'tips', 'mock', 'vocab', 'progress', 'plan', 'settings', 'coach', 'mistakes', 'mistakes/review', 'more']) { await go(route); assert.ok((await page.locator('#main').innerText()).length > 10, route); }
    await page.evaluate(() => BW.setLang('ar')); await go('coach');
    assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of ['', 'coach', 'mistakes', 'more']) { await go(route); const size = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth })); assert.ok(size.scroll <= size.width + 1, 'no horizontal overflow: ' + route + ' ' + JSON.stringify(size)); }
    await go('coach'); await page.evaluate(() => document.getElementById('toast').replaceChildren()); await page.screenshot({ path: path.join(output, 'coach-arabic-phone.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1050 }); await page.evaluate(() => { BW.setLang('en'); BW.store.s.settings.theme = 'light'; BW.applyTheme(); }); await go(''); await page.evaluate(() => document.getElementById('toast').replaceChildren()); await page.screenshot({ path: path.join(output, 'home-desktop.png'), fullPage: true });
    // An installed shell must survive a cold offline navigation, including the new modules.
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await context.setOffline(true); await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.BW?.learning); await page.locator('a[href="#/coach"]').first().click();
    await page.waitForFunction(() => document.querySelector('h1')?.textContent.includes('next session'));
    assert.match(await page.locator('h1').innerText(), /next session/);
    await context.setOffline(false); assert.deepEqual(errors, [], 'no uncaught errors on app routes');
    console.log('Browser checks passed: actual test submission, post-check controls, notebook search/notes, all retry widgets, scheduling, CSV/backup downloads, legacy import, malformed import rejection, 19 routes, Arabic RTL, mobile layout, and offline reload.');
    console.log('Screenshots: qa-output/');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
