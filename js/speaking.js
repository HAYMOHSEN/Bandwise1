/* Bandwise — Speaking simulator: examiner voice, timers, recording, optional transcript */
(function () {
  'use strict';
  const BW = window.BW;
  const { esc, $ } = BW;
  const t = (...a) => BW.t(...a);
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const memAudio = {}; // recId -> [objectURL|null]

  let SP = null;

  function pickTopics(n, first) {
    const p1 = BW.data.speaking.part1 || [];
    const lead = p1.find(x => /work|stud/i.test(x.topic)) || p1.find(x => /home|accommodation/i.test(x.topic));
    const rest = BW.shuffle(p1.filter(x => x !== lead && x !== first));
    return [first || lead, ...rest].filter(Boolean).slice(0, n);
  }
  function buildSteps(o) {
    const S = [];
    const say = text => S.push({ type: 'say', text });
    const ask = (part, question, max) => S.push({ type: 'ask', part, question, max });
    const bank = BW.data.speaking;
    const card = o.card || BW.shuffle(bank.part2)[0];
    if (o.mode === 'full') {
      say(t('ex_intro'));
      ask(1, t('ex_name'), 15);
      say(t('ex_p1intro'));
    }
    if (o.mode === 'full' || o.mode === 'part1') {
      const topics = o.topic ? [o.topic] : pickTopics(o.mode === 'full' ? 3 : 2);
      topics.forEach((tp, i) => {
        say(i === 0 && o.mode === 'full' ? t('ex_firstTopic', { topic: tp.topic.toLowerCase() }) : t('ex_nextTopic', { topic: tp.topic.toLowerCase() }));
        tp.questions.slice(0, i === 0 ? 4 : 4).forEach(q => ask(1, q, 45));
      });
    }
    if (o.mode === 'full' || o.mode === 'part2') {
      say(t('ex_p2intro'));
      S.push({ type: 'cue', card });
      S.push({ type: 'talk', part: 2, question: card.cue, card, max: 120 });
      if (card.roundOff) ask(2, card.roundOff, 25);
    }
    if (o.mode === 'full' || o.mode === 'part3' || o.alsoPart3) {
      say(t('ex_p3intro', { topic: (card.topic || '').toLowerCase() }));
      card.part3.slice(0, o.mode === 'full' ? 5 : 6).forEach(q => ask(3, q, 90));
    }
    say(t('ex_end'));
    return { steps: S, card };
  }

  async function ensureMic() {
    if (SP.stream !== undefined) return SP.stream;
    try { SP.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch (e) { SP.stream = null; BW.toast(t('micDenied'), 6000); }
    return SP.stream;
  }

  function startRec(item) {
    item.t0 = Date.now(); item.final = ''; item.interim = ''; item.pauses = 0; item.last = Date.now(); item.recording = true;
    if (SP.stream && window.MediaRecorder) {
      try {
        const mr = new MediaRecorder(SP.stream); const chunks = [];
        mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
        mr.onstop = () => { item.url = URL.createObjectURL(new Blob(chunks, { type: mr.mimeType || 'audio/webm' })); };
        mr.start(); item.mr = mr;
      } catch (e) { /* recording unavailable */ }
    }
    if (SR && !SP.srBlocked) {
      const r = new SR(); r.lang = 'en-GB'; r.continuous = true; r.interimResults = true;
      r.onresult = e => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) { const res = e.results[i]; if (res.isFinal) item.final += res[0].transcript.trim() + ' '; else interim += res[0].transcript; }
        const now = Date.now(); if (now - item.last > 2500 && item.final) item.pauses++; item.last = now;
        item.interim = interim; live(item);
      };
      r.onerror = e => { if (/not-allowed|service-not-allowed|network/.test(e.error)) { SP.srBlocked = e.error; } };
      r.onend = () => { if (item.recording && !SP.srBlocked) { try { r.start(); } catch (e) { /* already started */ } } };
      item.sr = r;
      try { r.start(); } catch (e) { /* ignore */ }
    }
  }
  function stopRec(item) {
    if (!item || !item.recording) return;
    item.recording = false;
    item.seconds = (Date.now() - item.t0) / 1000;
    if (item.mr && item.mr.state !== 'inactive') try { item.mr.stop(); } catch (e) { /* ignore */ }
    if (item.sr) try { item.sr.stop(); } catch (e) { /* ignore */ }
  }
  function live(item) {
    const el = $('#livetx');
    if (el) el.textContent = (item.final + item.interim).trim() || '…';
  }

  function stage(html) {
    const host = $('#spstage');
    if (host) host.innerHTML = html;
  }
  function examinerHTML(text) {
    return `<div class="examiner"><div class="avatar" aria-hidden="true">E</div><div><div class="small muted">${t('examiner')}</div><div class="said" lang="en">${SP.showText ? esc(text) : `<i class="muted">${t('listenCarefully')}</i>`}</div></div></div>`;
  }
  function header(part) {
    return `<div class="btn-row" style="justify-content:space-between;margin-bottom:16px"><div><b>${part ? t('part') + ' ' + part : t('speakingTest')}</b> <span class="muted small">· ${t('stepOf', { a: SP.i + 1, b: SP.steps.length })}</span></div>
      <div class="btn-row"><label class="small"><input type="checkbox" id="showtext" ${SP.showText ? 'checked' : ''}> ${t('showQuestionText')}</label><button class="btn btn-sm" data-sp="quit">${t('endTest')}</button></div></div>`;
  }

  async function sayLine(text) {
    if (!BW.tts.supported) { await BW.sleep(Math.min(6000, 600 + BW.words(text) * 300)); return; }
    SP.voice = BW.tts.speak(text, { accent: 'en-GB', gender: 'female' });
    await SP.voice.done;
    SP.voice = null;
  }

  async function run() {
    while (SP && SP.i < SP.steps.length) {
      const gen = SP.gen;
      const st = SP.steps[SP.i];
      if (st.type === 'say') {
        stage(header(st.part) + examinerHTML(st.text));
        await sayLine(st.text);
        if (!SP || gen !== SP.gen) return;
        SP.i++; continue;
      }
      if (st.type === 'cue') {
        const c = st.card;
        let left = 60;
        stage(header(2) + examinerHTML(t('ex_prep')) + cueCardHTML(c) + `<div class="big-timer" id="bt">1:00</div><p class="center small muted" style="text-align:center">${t('prepTime')}</p><textarea class="input" rows="4" placeholder="${t('notesHere')}" aria-label="${t('notesHere')}" lang="en"></textarea><div class="btn-row" style="justify-content:center;margin-top:14px"><button class="btn btn-ink" data-sp="skip">${t('readyToSpeak')}</button></div>`);
        await sayLine(t('ex_prep'));
        while (SP && gen === SP.gen && left > 0 && !SP.skip) { await BW.sleep(250); left -= 0.25; const b = $('#bt'); if (b) b.textContent = BW.fmtClock(left); }
        if (!SP || gen !== SP.gen) return;
        SP.skip = false; SP.i++; continue;
      }
      // ask / talk
      const isTalk = st.type === 'talk';
      const item = { part: st.part, question: st.question };
      SP.items.push(item);
      stage(header(st.part) + examinerHTML(isTalk ? t('ex_startTalk') : st.question) + (isTalk ? cueCardHTML(st.card) : '') +
        `<div class="big-timer" id="bt">${isTalk ? '2:00' : '0:00'}</div><p style="text-align:center" class="small"><span class="rec-dot" id="recdot" hidden></span><span id="recstate">${t('listen')}</span></p>
         <div class="live-transcript" id="livetx" lang="en">${SR ? '…' : esc(t('noTranscriptSupport'))}</div>
         <div class="btn-row" style="justify-content:center;margin-top:16px">${isTalk ? '' : `<button class="btn" data-sp="repeat">${t('repeatQuestion')}</button>`}<button class="btn btn-ink" data-sp="next">${isTalk ? t('finishTalking') : t('nextQuestion')}</button></div>`);
      await sayLine(isTalk ? t('ex_startTalk') : st.question);
      if (!SP || gen !== SP.gen) { return; }
      startRec(item);
      const dot = $('#recdot'), rs = $('#recstate');
      if (dot) dot.hidden = !SP.stream; if (rs) rs.textContent = SP.stream ? t('recording') : t('speakNow');
      const t0 = Date.now();
      while (SP && gen === SP.gen && !SP.next) {
        await BW.sleep(250);
        const el = (Date.now() - t0) / 1000;
        const b = $('#bt');
        if (b) b.textContent = isTalk ? BW.fmtClock(st.max - el) : BW.fmtClock(el);
        if (el >= st.max) break;
        if (!isTalk && el > st.max * 0.75 && b) b.style.color = 'var(--warn)';
      }
      stopRec(item);
      if (!SP) return;
      if (SP.repeatAsked) { SP.repeatAsked = false; SP.items.pop(); SP.next = false; continue; }
      if (gen !== SP.gen) return;
      SP.next = false;
      if (isTalk) { await sayLine(t('ex_thanks')); if (!SP || gen !== SP.gen) return; }
      SP.i++;
    }
    if (SP) finish();
  }
  function cueCardHTML(c) {
    return `<div class="cue-card" lang="en"><h3>${esc(c.cue)}</h3><div>${t('youShouldSay')}</div><ul>${c.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul><div>${esc(c.explain)}</div></div>`;
  }

  async function open(o) {
    close();
    const b = buildSteps(o);
    SP = { mode: o.mode, steps: b.steps, card: b.card, i: 0, items: [], gen: 1, showText: true, next: false, skip: false, onFinish: o.onFinish || null };
    document.body.classList.add('exam-mode');
    const host = document.getElementById('main');
    host.innerHTML = `<div class="speak-stage" id="spstagewrap"><div id="spstage"></div></div>`;
    host.addEventListener('click', onClick);
    host.addEventListener('change', onChange);
    stage(`<h1 class="h2">${t('getReady')}</h1><p class="lede">${esc(t('speakingReadyText'))}</p><div class="notice" style="margin-top:16px">${BW.icon('mic')}<div>${esc(t('micExplain'))}</div></div><div class="btn-row" style="margin-top:20px"><button class="btn btn-hl" data-sp="begin">${t('startSpeaking')}</button><button class="btn" data-sp="quit">${t('cancel')}</button></div>`);
  }
  function onChange(e) { if (e.target.id === 'showtext' && SP) { SP.showText = e.target.checked; const said = document.querySelector('.examiner .said'); if (said) said.innerHTML = SP.showText ? esc(currentText()) : `<i class="muted">${t('listenCarefully')}</i>`; } }
  function currentText() { const st = SP.steps[SP.i]; return st ? (st.type === 'talk' ? t('ex_startTalk') : st.type === 'cue' ? t('ex_prep') : (st.question || st.text || '')) : ''; }
  async function onClick(e) {
    const b = e.target.closest('[data-sp]');
    if (!b || !SP) return;
    const a = b.dataset.sp;
    if (a === 'begin') { b.disabled = true; await ensureMic(); run(); }
    else if (a === 'next') { SP.next = true; }
    else if (a === 'skip') { SP.skip = true; }
    else if (a === 'repeat') { SP.repeatAsked = true; SP.next = true; }
    else if (a === 'quit') {
      if (SP.items.length && !(await BW.confirmBox(t('endTestConfirm'), t('endTest'), t('keepGoing')))) return;
      if (SP.items.length) { finish(); } else { close(); location.hash = '#/speaking'; }
    }
  }
  function finish() {
    const sp = SP;
    sp.gen++;
    sp.items.forEach(stopRec);
    if (sp.voice) sp.voice.cancel();
    BW.tts.cancelAll();
    setTimeout(() => {
      const rec = {
        id: BW.uid(), date: new Date().toISOString(), mode: sp.mode, card: sp.card ? sp.card.id : null,
        items: sp.items.map(it => {
          const tx = (it.final || '').replace(/\s+/g, ' ').trim();
          return { part: it.part, question: it.question, transcript: tx, seconds: Math.round(it.seconds || 0), stats: BW.analyzer.speechStats(tx, it.seconds || 0, it.pauses) };
        }),
        srNote: sp.srBlocked || (SR ? null : 'unsupported'), self: null, ai: null
      };
      memAudio[rec.id] = sp.items.map(it => it.url || null);
      BW.store.s.speaking.push(rec); BW.store.save(true);
      if (sp.stream) sp.stream.getTracks().forEach(tr => tr.stop());
      close(true);
      if (sp.onFinish) sp.onFinish(rec.id); else location.hash = '#/speaking-result/' + rec.id;
    }, 400);
  }
  function close(keepStream) {
    if (!SP) return;
    SP.gen++;
    if (SP.voice) SP.voice.cancel();
    BW.tts.cancelAll();
    SP.items.forEach(stopRec);
    if (!keepStream && SP.stream) SP.stream.getTracks().forEach(tr => tr.stop());
    const host = document.getElementById('main');
    host.removeEventListener('click', onClick);
    host.removeEventListener('change', onChange);
    document.body.classList.remove('exam-mode');
    SP = null;
  }

  /* ---------- result page ---------- */
  function bandOf(rec) {
    // AI receives transcripts only; even legacy AI results cannot establish a Speaking band.
    if (rec.self && Number.isFinite(rec.self.band) && rec.self.band >= 0 && rec.self.band <= 9) return { band: rec.self.band, src: 'self' };
    return { band: null, src: null };
  }
  function resultPage(id) {
    const rec = BW.store.s.speaking.find(r => r.id === id);
    if (!rec) return `<div class="page"><div class="empty">${t('notFound')}</div></div>`;
    const audio = memAudio[rec.id] || [];
    const total = rec.items.reduce((a, it) => a + it.seconds, 0);
    const words = rec.items.reduce((a, it) => a + it.stats.wc, 0);
    const fill = rec.items.reduce((a, it) => a + it.stats.fillers, 0);
    const b = bandOf(rec);
    const aiOn = BW.ai.cfg().enabled;
    const hasTx = rec.items.some(it => it.transcript);
    const names = { FC: t('crit_FC'), LR: t('crit_LR'), GRA: t('crit_GRA'), P: t('crit_P') };
    let h = `<div class="page"><a class="back" href="#/speaking">${BW.icon('back')} ${t('speaking')}</a>
      <div class="page-head"><div><div class="muted small">${BW.fmtDate(rec.date, BW.lang())} · ${esc(t('sp_mode_' + rec.mode))}</div><h1 class="h1">${t('yourSpeaking')}</h1></div><div class="btn-row"><a class="btn" href="#/speak/${esc(rec.mode)}${rec.card && rec.mode !== 'part1' ? '/' + esc(rec.card) : ''}">${t('tryAgain')}</a></div></div>
      <div class="result-hero"><div class="result-band">${BW.fmtBand(b.band)}<small>${b.src === 'ai' ? t('aiEstimate') : b.src === 'self' ? t('selfAssessed') : t('rateYourself')}</small></div>
      <div><div class="stat-line"><span>${t('speakingTime')}: <b>${BW.fmtClock(total)}</b></span>${hasTx ? `<span>${t('words')}: <b>${words}</b></span><span>${t('wordsPerMinute')}: <b>${total ? Math.round(words / (total / 60)) : 0}</b></span><span>${t('fillers')}: <b>${fill}</b></span>` : ''}</div>
      ${!hasTx ? `<p class="small muted" style="margin-top:8px">${esc(rec.srNote === 'unsupported' ? t('noTranscriptSupport') : t('noTranscriptOffline'))}</p>` : `<p class="small muted" style="margin-top:8px">${esc(t('wpmHint'))}</p>`}
      ${aiOn && hasTx ? `<button class="btn btn-hl" data-spai="${esc(rec.id)}">${BW.icon('sparkle')} ${rec.ai ? t('aiMarkAgain') : t('aiMark')}</button>` : (hasTx ? `<a class="btn btn-ghost btn-sm" href="#/settings#ai">${t('setUpAi')}</a>` : '')}</div></div>`;
    if (rec.ai) {
      const bands = rec.ai.bands || {};
      h += `<div class="section"><div class="section-head"><h2 class="h3">${t('aiFeedback')}</h2><span class="chip hl">${t('speakingTextOnly')}</span></div><p class="notice">${esc(t('speakingTextNote'))}</p><div class="crit-grid">${['FC', 'LR', 'GRA', 'P'].map(c => `<div class="crit"><h4>${esc(names[c])}<span>${['FC', 'P'].includes(c) ? `<small>${esc(t('notAssessed'))}</small>` : BW.fmtBand(bands[c])}</span></h4></div>`).join('')}</div>
        ${rec.ai.summary ? `<p class="prose" style="margin-top:14px">${esc(rec.ai.summary)}</p>` : ''}<div class="cols"><div><h3 class="h4">${t('strengths')}</h3><ul>${(rec.ai.strengths || []).map(s => `<li>${esc(s)}</li>`).join('')}</ul></div><div><h3 class="h4">${t('toImprove')}</h3><ul>${(rec.ai.improvements || []).map(s => `<li>${esc(s)}</li>`).join('')}</ul></div></div>
        ${(rec.ai.corrections || []).length ? `<div class="table-wrap"><table class="rt" lang="en"><thead><tr><th>${t('original')}</th><th>${t('better')}</th><th>${t('why')}</th></tr></thead><tbody>${rec.ai.corrections.map(c => `<tr><td>${esc(c.original)}</td><td><b>${esc(c.corrected)}</b></td><td>${esc(c.note || '')}</td></tr>`).join('')}</tbody></table></div>` : ''}</div>`;
    }
    h += `<div class="section"><h2 class="h3">${t('yourAnswers')}</h2><ul class="ruled">${rec.items.map((it, i) => `<li style="padding:14px 4px"><div class="small muted">${t('part')} ${it.part} · ${BW.fmtClock(it.seconds)}${it.transcript ? ` · ${it.stats.wpm} ${t('wpm')} · ${t('fillers')} ${it.stats.fillers}` : ''}</div><div class="row-title" lang="en">${esc(it.question)}</div>
      ${audio[i] ? `<audio controls preload="none" src="${audio[i]}" style="width:100%;margin-top:8px"></audio>` : ''}
      ${it.transcript ? `<p class="muted" lang="en" style="margin-top:6px;font-family:var(--font-read)">${esc(it.transcript)}</p>` : ''}
      ${it.stats.repeated && it.stats.repeated.length ? `<div class="small faint">${t('repeatedWords')}: ${esc(it.stats.repeated.map(([w, c]) => w + ' ×' + c).join(', '))}</div>` : ''}</li>`).join('')}</ul>
      ${audio.some(Boolean) ? `<p class="small faint">${esc(t('audioSessionOnly'))}</p>` : ''}</div>`;
    const s = rec.self || {};
    const crit = (BW.data.guide && BW.data.guide.scoring && BW.data.guide.scoring.speakingCriteria) || [];
    h += `<div class="section"><div class="section-head"><h2 class="h3">${t('selfAssess')}</h2><span class="small muted">${t('selfAssessSpeakHelp')}</span></div><div id="spself">${['FC', 'LR', 'GRA', 'P'].map(c => { const v = s[c] || 6; const cd = crit.find(x => x.id === c); return `<div class="slider-row"><div><b>${esc(names[c])}</b>${cd ? `<div class="small muted">${esc(BW.L(cd.desc))}</div>` : ''}</div><input type="range" min="3" max="9" step="0.5" value="${v}" data-c="${c}" aria-label="${esc(names[c])}"><output>${BW.fmtBand(v)}</output></div>`; }).join('')}
      <div class="btn-row" style="margin-top:12px"><button class="btn btn-ink" data-spself="${esc(rec.id)}">${t('saveSelf')}</button>${s.band != null ? `<span class="chip">${t('band')}: ${BW.fmtBand(s.band)}</span>` : ''}</div></div></div>`;
    h += `<div class="section"><h2 class="h3">${t('speakingTipsTitle')}</h2><ul class="prose">${t('speakingTipsList').split('\n').map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div>`;
    return h;
  }
  function bindResult(id) {
    const main = document.getElementById('main');
    main.addEventListener('input', e => { if (e.target.matches('#spself input[type=range]')) e.target.nextElementSibling.textContent = BW.fmtBand(+e.target.value); });
    main.addEventListener('click', async e => {
      const rec = BW.store.s.speaking.find(r => r.id === id);
      if (!rec) return;
      if (e.target.closest('[data-spself]')) {
        const s = {};
        BW.$$('#spself input[type=range]').forEach(i => { s[i.dataset.c] = +i.value; });
        s.band = BW.roundBand((s.FC + s.LR + s.GRA + s.P) / 4);
        rec.self = s; BW.store.save(); BW.toast(t('saved')); BW.app.render();
      }
      const ab = e.target.closest('[data-spai]');
      if (ab) {
        ab.disabled = true; ab.textContent = t('aiWorking');
        try { rec.ai = await BW.ai.markSpeaking(rec.items); BW.store.save(); BW.app.render(); }
        catch (err) { ab.disabled = false; ab.textContent = t('aiMark'); BW.toast(t('aiError') + ' ' + err.message, 6000); }
      }
    });
  }

  BW.speaking = { open, close, resultPage, bindResult, bandOf, active: () => !!SP };
})();
