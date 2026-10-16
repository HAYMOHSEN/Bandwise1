/* Bandwise — optional AI marking with the learner's own API key (sent only to the provider they choose). */
(function () {
  'use strict';
  const BW = window.BW;

  const PRESETS = {
    anthropic: { label: 'Claude (Anthropic)', kind: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-sonnet-5-5', keyHint: 'sk-ant-…' },
    openai: { label: 'OpenAI', kind: 'openai', baseUrl: 'https://api.openai.com/v1', model: '', keyHint: 'sk-…' },
    gemini: { label: 'Google Gemini', kind: 'openai', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: '', keyHint: 'AIza…' },
    openrouter: { label: 'OpenRouter', kind: 'openai', baseUrl: 'https://openrouter.ai/api/v1', model: '', keyHint: 'sk-or-…' },
    ollama: { label: 'Ollama (this PC)', kind: 'openai', baseUrl: 'http://localhost:11434/v1', model: '', keyHint: 'ollama', local: true },
    lmstudio: { label: 'LM Studio (this PC)', kind: 'openai', baseUrl: 'http://localhost:1234/v1', model: '', keyHint: 'lm-studio', local: true },
    custom: { label: 'Other (OpenAI-compatible)', kind: 'openai', baseUrl: '', model: '', keyHint: '' }
  };

  function cfg() {
    const a = BW.store.s.settings.ai || {};
    const p = PRESETS[a.preset] || PRESETS.openai;
    return { enabled: a.provider === 'on' && !!(a.model || p.model) && !!(a.baseUrl || p.baseUrl) && (!!a.key || p.local), kind: p.kind, baseUrl: (a.baseUrl || p.baseUrl || '').replace(/\/+$/, ''), model: a.model || p.model, key: a.key || '', preset: a.preset };
  }

  async function chat(system, user, maxTokens) {
    const c = cfg();
    if (!c.enabled) throw new Error(BW.t('aiNotSet'));
    let res, data;
    if (c.kind === 'anthropic') {
      res = await fetch(c.baseUrl + '/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': c.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: c.model, max_tokens: maxTokens || 2000, system, messages: [{ role: 'user', content: user }] })
      });
      data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data.error && data.error.message) || ('HTTP ' + res.status));
      return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
    }
    const headers = { 'content-type': 'application/json' };
    if (c.key) headers.authorization = 'Bearer ' + c.key;
    res = await fetch(c.baseUrl + '/chat/completions', {
      method: 'POST', headers,
      body: JSON.stringify({ model: c.model, temperature: 0.2, max_tokens: maxTokens || 2000, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] })
    });
    data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data.error && (data.error.message || data.error)) || ('HTTP ' + res.status));
    return ((data.choices || [])[0] || {}).message ? data.choices[0].message.content : '';
  }

  function parseJson(text) {
    const s = String(text || '');
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error(BW.t('aiBadReply'));
    return JSON.parse(s.slice(a, b + 1));
  }
  function feedback(value, criteria, text) {
    if (!value || typeof value !== 'object' || !value.bands) throw new Error(BW.t('aiBadReply'));
    const bands = {};
    for (const criterion of criteria) {
      const score = value.bands[criterion];
      if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 9) throw new Error(BW.t('aiBadReply'));
      bands[criterion] = BW.halfRound(score);
    }
    const strings = list => Array.isArray(list) ? list.filter(item => typeof item === 'string').slice(0, 20) : [];
    return {
      bands, overall: BW.roundBand(Object.values(bands).reduce((sum, score) => sum + score, 0) / criteria.length),
      summary: typeof value.summary === 'string' ? value.summary : '', strengths: strings(value.strengths), improvements: strings(value.improvements),
      corrections: Array.isArray(value.corrections) ? value.corrections.filter(item => item && typeof item.original === 'string' && item.original && text.includes(item.original) && typeof item.corrected === 'string').slice(0, 12).map(item => ({ original: item.original, corrected: item.corrected, note: typeof item.note === 'string' ? item.note : '' })) : [],
      rewrite: typeof value.rewrite === 'string' ? value.rewrite : ''
    };
  }
  const fbLang = () => BW.lang() === 'ar' ? 'Write "summary", "strengths", "improvements" and every "note" in Modern Standard Arabic. Keep "original", "corrected" and "rewrite" in English.' : 'Write all feedback in clear, simple English.';

  async function markWriting(task, text) {
    const crit1 = task.kind === 't2' ? 'Task Response (TR)' : 'Task Achievement (TA)';
    const system = `You are an experienced, strict but fair IELTS Writing examiner. Assess the candidate's response against the public IELTS Writing band descriptors: ${crit1}, Coherence and Cohesion (CC), Lexical Resource (LR) and Grammatical Range and Accuracy (GRA). Use whole or half bands (e.g. 5.5, 6.0, 6.5). Penalise responses under the word minimum, off-topic or memorised material, and, for Academic Task 1, a missing overview or inaccurate data. Do not inflate scores.
${fbLang()}
Reply with JSON only, no markdown, in exactly this shape:
{"bands":{"TA":0,"CC":0,"LR":0,"GRA":0},"overall":0,"summary":"2-3 sentences","strengths":["..."],"improvements":["specific, actionable"],"corrections":[{"original":"exact phrase from the response","corrected":"...","note":"why"}],"rewrite":"one improved paragraph from the response"}
Give 3-8 corrections, quoting the candidate's exact words in "original".`;
    const user = `Task type: ${task.label}
Minimum words: ${task.minWords}
Task prompt: ${task.promptText}
${task.visualText ? 'Visual data (exact values): ' + task.visualText + '\n' : ''}Candidate response (${BW.words(text)} words):
"""
${text}
"""`;
    return feedback(parseJson(await chat(system, user, 2600)), ['TA', 'CC', 'LR', 'GRA'], text);
  }

  async function markSpeaking(items) {
    const system = `You are an IELTS Speaking practice tutor. You receive automatic speech-recognition transcripts only, without audio. Recognition errors are possible; do not penalise obvious transcription glitches. Give tentative text-based indicators for Lexical Resource (LR) and Grammatical Range and Accuracy (GRA), using the public band descriptors. Discuss coherence in prose. You cannot assess spoken fluency, delivery or pronunciation from these transcripts: FC, P and overall must be null. Never infer pronunciation from spelling, grammar or transcript fluency. Explain this limitation in the summary. Use whole or half bands for LR and GRA. Do not inflate scores.
${fbLang()}
Reply with JSON only: {"bands":{"FC":null,"LR":0,"GRA":0,"P":null},"overall":null,"summary":"...","strengths":["..."],"improvements":["..."],"corrections":[{"original":"...","corrected":"...","note":"..."}]}`;
    const user = items.map((it, i) => `Q${i + 1} (${it.part}): ${it.question}\nAnswer (${it.seconds}s): ${it.transcript || '[no transcript]'}`).join('\n\n');
    const result = feedback(parseJson(await chat(system, user, 2000)), ['LR', 'GRA'], items.map(item => item.transcript || '').join('\n'));
    return Object.assign(result, { bands: Object.assign(result.bands, { FC: null, P: null }), overall: null, assessedFrom: 'transcript' });
  }

  async function test() {
    const r = await chat('Reply with the single word OK.', 'Say OK.', 10);
    return String(r || '').trim();
  }

  BW.ai = { PRESETS, cfg, chat, markWriting, markSpeaking, test };
})();
