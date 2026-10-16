/* Bandwise — listening audio via the device's text-to-speech voices */
(function () {
  'use strict';
  const BW = window.BW;
  const synth = window.speechSynthesis;
  const supported = !!(synth && window.SpeechSynthesisUtterance);

  const FEMALE = /\b(libby|sonia|maisie|hazel|susan|natasha|catherine|aria|jenny|michelle|ana|clara|molly|emily|zira|heera|neerja|linda|samantha|karen|moira|tessa|fiona|victoria|serena|kate|allison|ava|joanna|salli|kimberly|olivia|amy|emma|nicole|sara|abbi|bella|hollie|elsie|freya|annette|carly|kim|tina|leah|luna|nova|ashley|cora|elizabeth|jane|nancy|female|woman)\b/i;
  const MALE = /\b(ryan|george|thomas|william|james|guy|christopher|eric|roger|steffan|liam|mitchell|connor|david|mark|richard|daniel|alex|fred|tom|oliver|arthur|brian|matthew|justin|joey|prabhat|ravi|sean|alfie|elliot|ethan|noah|ken|duncan|darren|neil|tim|andrew|brandon|davis|jason|tony|male|man)\b/i;

  let voices = [];
  function refresh() { if (supported) voices = synth.getVoices().filter(v => /^en([-_]|$)/i.test(v.lang)); return voices; }
  const ready = new Promise(resolve => {
    if (!supported) return resolve([]);
    refresh();
    if (voices.length) return resolve(voices);
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(refresh()); } };
    synth.addEventListener && synth.addEventListener('voiceschanged', finish);
    setTimeout(finish, 2500);
  });
  const langOf = v => String(v.lang || '').replace('_', '-');
  const genderOf = v => FEMALE.test(v.name) ? 'female' : MALE.test(v.name) ? 'male' : null;
  const quality = v => /natural|neural|online|enhanced|premium/i.test(v.name) ? 3 : 0;

  function pick(spec, avoid) {
    avoid = avoid || new Set();
    const online = navigator.onLine !== false;
    let best = null, bestScore = -1e9;
    for (const v of voices) {
      let s = 0;
      const lang = langOf(v);
      if (lang.toLowerCase() === String(spec.accent || '').toLowerCase()) s += 10;
      else if (lang.slice(0, 2) === 'en') s += 2;
      const g = genderOf(v);
      if (spec.gender && g) s += g === spec.gender ? 6 : -6;
      s += quality(v);
      if (!online && !v.localService) s -= 30;
      if (avoid.has(v.name)) s -= 8;
      if (s > bestScore) { bestScore = s; best = v; }
    }
    if (!best) return { voice: null, pitch: spec.gender === 'male' ? 0.85 : 1.1 };
    const g = genderOf(best);
    let pitch = 1;
    if (spec.gender && g !== spec.gender) pitch = spec.gender === 'male' ? 0.82 : 1.18;
    if (avoid.has(best.name)) pitch *= spec.gender === 'male' ? 0.92 : 1.08;
    return { voice: best, pitch };
  }

  function spellOut(text) {
    return String(text).replace(/\b[A-Za-z](?:-[A-Za-z]){1,}\b/g, m => m.split('-').join(', '));
  }
  function sentences(text) {
    text = spellOut(text);
    // split only where punctuation is followed by a space, so emails, web addresses and decimals stay whole
    const parts = String(text).split(/(?<=[.!?…]["'’)\]]?)\s+/);
    const out = [];
    for (const p of parts) {
      const t = p.trim();
      if (!t) continue;
      if (t.length > 220) out.push(...t.split(/(?<=[,;:])\s+/));
      else out.push(t);
    }
    return out;
  }

  function speakOne(text, cfg, isLive) {
    return new Promise(resolve => {
      if (!supported) return resolve();
      const u = new SpeechSynthesisUtterance(text);
      if (cfg.voice) { u.voice = cfg.voice; u.lang = cfg.voice.lang; } else u.lang = 'en-GB';
      u.pitch = cfg.pitch || 1;
      u.rate = cfg.rate || 1;
      let settled = false;
      const done = () => { if (!settled) { settled = true; clearTimeout(watch); resolve(); } };
      u.onend = done; u.onerror = done;
      const est = (BW.words(text) / 2.4) / (u.rate || 1) * 1000;
      const watch = setTimeout(() => { if (isLive()) { try { synth.cancel(); } catch (e) {} } done(); }, est * 2 + 6000);
      synth.speak(u);
    });
  }

  function speak(text, spec) {
    spec = spec || {};
    const cfg = pick({ accent: spec.accent || 'en-GB', gender: spec.gender || 'female' });
    cfg.rate = spec.rate || (BW.store.s.settings.rate || 1);
    let live = true;
    const run = (async () => { for (const s of sentences(text)) { if (!live) return; await speakOne(s, cfg, () => live); } })();
    return { done: run, cancel() { live = false; try { synth.cancel(); } catch (e) {} } };
  }
  function cancelAll() { if (supported) try { synth.cancel(); } catch (e) {} }

  /* Plays one or more listening parts in sequence.
     parts: [{n, speakers, script}]
     hooks: onPart(pi), onSeg(pi, si, seg), onWait(secondsLeft, seg), onProgress(frac), onEnd() */
  class ScriptPlayer {
    constructor(parts, hooks) {
      this.parts = parts; this.hooks = hooks || {};
      this.pi = 0; this.si = 0; this.gen = 0; this.state = 'idle'; this.waitLeft = null;
      this.cast = parts.map(p => this.castPart(p));
      this.total = parts.reduce((a, p) => a + p.script.length, 0);
    }
    castPart(p) {
      const used = new Set(), cast = {};
      for (const [k, sp] of Object.entries(p.speakers || {})) {
        const c = pick(sp, used);
        if (c.voice) used.add(c.voice.name);
        cast[k] = c;
      }
      const narr = pick({ accent: 'en-GB', gender: 'male' }, used);
      cast.__narr = narr;
      return cast;
    }
    get rate() { return BW.store.s.settings.rate || 1; }
    progress() {
      let done = 0;
      for (let i = 0; i < this.pi; i++) done += this.parts[i].script.length;
      return this.total ? (done + this.si) / this.total : 0;
    }
    async run(gen) {
      const live = () => gen === this.gen;
      while (live() && this.pi < this.parts.length) {
        const part = this.parts[this.pi];
        if (this.si === 0 && this.hooks.onPart) this.hooks.onPart(this.pi);
        while (live() && this.si < part.script.length) {
          const seg = part.script[this.si];
          if (this.hooks.onSeg) this.hooks.onSeg(this.pi, this.si, seg);
          if (this.hooks.onProgress) this.hooks.onProgress(this.progress());
          if (seg.t === 'pause') {
            let left = this.waitLeft != null ? this.waitLeft : seg.s;
            this.waitLeft = null;
            while (live() && left > 0) {
              if (this.hooks.onWait) this.hooks.onWait(left, seg);
              await BW.sleep(250); left -= 0.25;
              if (!live()) { this.waitLeft = left; return; }
            }
            if (this.hooks.onWait) this.hooks.onWait(0, seg);
          } else {
            const c = seg.t === 'narr' ? this.cast[this.pi].__narr : (this.cast[this.pi][seg.who] || this.cast[this.pi].__narr);
            const cfg = { voice: c.voice, pitch: c.pitch, rate: this.rate };
            const chunks = sentences(seg.text);
            for (let k = this.chunk || 0; k < chunks.length; k++) {
              if (!live()) { this.chunk = k; return; }
              await speakOne(chunks[k], cfg, live);
              if (!live()) { this.chunk = k; return; }
            }
            this.chunk = 0;
            if (live()) await BW.sleep(seg.t === 'narr' ? 500 : 220);
          }
          if (!live()) return;
          this.si++;
        }
        if (!live()) return;
        this.pi++; this.si = 0;
      }
      if (live()) { this.state = 'done'; if (this.hooks.onProgress) this.hooks.onProgress(1); if (this.hooks.onEnd) this.hooks.onEnd(); }
    }
    play() {
      if (this.state === 'playing') return;
      this.state = 'playing';
      const gen = ++this.gen;
      this.run(gen);
    }
    pause() {
      if (this.state !== 'playing') return;
      this.state = 'paused'; this.gen++;
      cancelAll();
    }
    stop() { this.state = 'idle'; this.gen++; cancelAll(); }
    seek(pi, si) {
      const was = this.state === 'playing';
      this.gen++; cancelAll();
      this.pi = pi; this.si = si || 0; this.chunk = 0; this.waitLeft = null;
      this.state = 'paused';
      if (was) this.play();
    }
  }

  function describeVoices() {
    const by = {};
    for (const v of voices) { const l = langOf(v); (by[l] = by[l] || []).push(v); }
    return by;
  }

  BW.tts = { supported, ready, refresh, pick, speak, cancelAll, ScriptPlayer, describeVoices, genderOf, get voices() { return voices; } };
})();
