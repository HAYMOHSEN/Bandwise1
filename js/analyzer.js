/* Bandwise — offline writing checks. Indicators only: they cannot judge meaning the way an examiner does. */
(function () {
  'use strict';
  const BW = window.BW;

  const LINKERS = ['however', 'moreover', 'furthermore', 'in addition', 'additionally', 'therefore', 'thus', 'consequently', 'as a result',
    'on the other hand', 'nevertheless', 'nonetheless', 'although', 'even though', 'though', 'whereas', 'while', 'whilst', 'despite', 'in spite of',
    'for example', 'for instance', 'such as', 'firstly', 'secondly', 'thirdly', 'finally', 'lastly', 'in conclusion', 'to conclude', 'to sum up',
    'overall', 'similarly', 'likewise', 'in contrast', 'by contrast', 'meanwhile', 'hence', 'accordingly', 'in particular', 'notably', 'namely',
    'in other words', 'admittedly', 'indeed', 'besides', 'because', 'since', 'due to', 'owing to', 'so that', 'unless', 'provided that', 'as long as',
    'subsequently', 'afterwards', 'then', 'next', 'in comparison', 'conversely', 'instead', 'otherwise', 'as well as', 'not only'];
  const SUBORD = /\b(although|though|because|since|whereas|while|whilst|if|unless|which|who|whom|whose|that|when|where|so that|even if|as long as|provided that|despite the fact that|in order to)\b/i;
  const STOP = new Set('a an the and or but if of to in on at by for with from as is are was were be been being it its this that these those there their they them he she his her we our you your i me my not no so do does did have has had can could will would should may might must also than then which who whom whose what when where why how all any some more most such very just only into over under about after before between through during up down out off again further once here both each few other own same too s t don very can will'.split(' '));
  const INFORMAL = ['kids', 'kid', 'stuff', 'gonna', 'wanna', 'gotta', 'okay', 'ok', 'guys', 'guy', 'awesome', 'cool', 'big deal', 'lots of', 'a lot of', 'pretty much', 'super', 'tons of', 'nowadays people', 'thing is', 'etc'];
  const CONTRACTION = /\b(\w+n't|i'm|you're|we're|they're|it's|that's|there's|let's|i've|we've|they've|i'll|we'll|they'll|i'd|we'd|they'd|he's|she's|what's)\b/gi;
  const ACADEMIC = 'analys approach assess assum authorit availab benefit concept consist constitut context contract creat data defin deriv distribut econom environment establish estimat eviden factor financ function identif impact implement implicat indicat individual interpret involv issue labour legislat method occur percent period policy principl proceed process requir research respond role sector significan similar source specific structur theor vari achiev acquir affect appropriat aspect assist categor communit complex conclu conduct consequen construct consum cultur design distinct element evaluat featur focus institut invest maintain obtain participat perce potential previous primar purchas region regulat relevan resourc restrict secur select strateg survey tradition transfer alternativ circumstan component consent considerabl constant constrain contribut coordinat corporat correspond criteri demonstrat dominat emphas ensur exclu framework fund illustrat imply initial interact justif link locat maximi minor outcome perspectiv proportion publish rely scheme sequen shift sufficient technic techniqu technolog valid access adequat annual apparent approximat attitud attribut commit concentrat contrast debat dimension domestic emerg ethic goal hypothes integrat internal investigat mechanism obvious option output overall parallel phase predict prior profession promot resolv retain statistic status subsequent undertak adjust alter capacit challeng conflict consult declin enabl enforc equivalent evolv expan expos external facilitat fundamental generat infrastructur medic mental modif monitor network notion objectiv precis psycholog pursu ratio reject revenue stabl substitut sustain target trend version welfare whereas compris elimina exceed fluctuat plummet plateau surge steadil substantial marginal dramatic gradual'.split(' ');
  const MISSPELL = { accomodation: 'accommodation', acheive: 'achieve', adress: 'address', advertisment: 'advertisement', agressive: 'aggressive', apparantly: 'apparently', arguement: 'argument', begining: 'beginning', beleive: 'believe', buisness: 'business', calender: 'calendar', comming: 'coming', comittee: 'committee', completly: 'completely', concious: 'conscious', definately: 'definitely', developement: 'development', diffrent: 'different', dissapear: 'disappear', enviroment: 'environment', enviromental: 'environmental', embarass: 'embarrass', existance: 'existence', experiance: 'experience', familar: 'familiar', finaly: 'finally', foriegn: 'foreign', freind: 'friend', goverment: 'government', goverments: 'governments', grammer: 'grammar', happend: 'happened', immediatly: 'immediately', independant: 'independent', intresting: 'interesting', knowlege: 'knowledge', libary: 'library', maintainance: 'maintenance', neccessary: 'necessary', necesary: 'necessary', nowdays: 'nowadays', occured: 'occurred', occurence: 'occurrence', oppurtunity: 'opportunity', oportunity: 'opportunity', parliment: 'parliament', peice: 'piece', persue: 'pursue', posession: 'possession', prefered: 'preferred', privelege: 'privilege', probaly: 'probably', publically: 'publicly', realy: 'really', recieve: 'receive', recomend: 'recommend', refered: 'referred', relevent: 'relevant', religous: 'religious', resturant: 'restaurant', seperate: 'separate', sucess: 'success', succesful: 'successful', successfull: 'successful', suprise: 'surprise', tecnology: 'technology', technolgy: 'technology', tommorow: 'tomorrow', truely: 'truly', untill: 'until', wich: 'which', wierd: 'weird', becuase: 'because', becouse: 'because', beacuse: 'because', thier: 'their', studing: 'studying', writting: 'writing', comunity: 'community', comunication: 'communication', benifit: 'benefit', benifits: 'benefits', alot: 'a lot', infomation: 'information', temprature: 'temperature', percentege: 'percentage', decrese: 'decrease', increse: 'increase', significent: 'significant', approximatly: 'approximately', propotion: 'proportion', proffesional: 'professional', profesional: 'professional', responsability: 'responsibility', especialy: 'especially', espacially: 'especially', helpfull: 'helpful', usefull: 'useful', carefull: 'careful', beautifull: 'beautiful', wonderfull: 'wonderful', sincerly: 'sincerely', faithfuly: 'faithfully', desicion: 'decision', dicision: 'decision', ocassion: 'occasion', reccomend: 'recommend', adviced: 'advised', choosen: 'chosen', heared: 'heard', teached: 'taught', buyed: 'bought', thinked: 'thought' };
  const RULES = [
    { re: /\b(informations|advices|furnitures|equipments|knowledges|evidences|homeworks|luggages|staffs|feedbacks|researches(?= (?:show|shows|suggest)))\b/gi, msg: 'This noun is usually uncountable — no plural -s.' },
    { re: /\bmore (better|worse|easier|cheaper|faster|bigger|smaller|higher|lower|larger)\b/gi, msg: 'Double comparative — use the -er form alone.' },
    { re: /\bmost (best|worst)\b/gi, msg: 'Double superlative.' },
    { re: /\bdiscuss about\b/gi, msg: '“discuss” takes a direct object: discuss the issue.' },
    { re: /\bdespite of\b/gi, msg: 'Use “despite” or “in spite of”.' },
    { re: /\baccording to me\b/gi, msg: 'Use “in my opinion” or “in my view”.' },
    { re: /\bin the other hand\b/gi, msg: 'The phrase is “on the other hand”.' },
    { re: /\bthe life (is|has|was|can)\b/gi, msg: 'General “life” takes no article: “Life is…”.' },
    { re: /\bpeople (is|was|has)\b/gi, msg: '“people” is plural: people are / were / have.' },
    { re: /\bpeoples (is|are|was|were|has|have)\b/gi, msg: 'Use “people” (already plural): people are…' },
    { re: /\b(he|she|it) (have|do not|don't|were)\b/gi, msg: 'Subject–verb agreement (he/she/it has, does not, was).' },
    { re: /\b(could|should|would|must) of\b/gi, msg: 'Use “have”, not “of”: could have.' },
    { re: /\bcan not\b/gi, msg: 'Write “cannot” as one word.' },
    { re: /\bin nowadays\b/gi, msg: 'Use “nowadays” without “in”.' },
    { re: /\b(make|makes|made|let|lets) (people|them|us|him|her|students|children|me) to\b/gi, msg: 'After make/let use the base verb without “to”.' },
    { re: /\bexplain (me|him|her|them|us)\b/gi, msg: '“explain to me”, not “explain me”.' },
    { re: /\blisten music\b/gi, msg: '“listen to music”.' },
    { re: /\benjoy to\b/gi, msg: '“enjoy” is followed by -ing: enjoy reading.' },
    { re: /\blook(ing)? forward to (see|meet|hear|receive|work)\b/gi, msg: '“look forward to” + -ing: look forward to seeing.' },
    { re: /\bit is depend(s)?\b/gi, msg: 'Use “it depends”.' },
    { re: /\bthe most of\b/gi, msg: 'Use “most of” (no “the”).' },
    { re: /\bmarried with\b/gi, msg: '“married to”.' },
    { re: /\bsuggest (him|her|them|me|us) to\b/gi, msg: 'Use “suggest that they…” or “suggest doing…”.' },
    { re: /\b(\w{2,}) \1\b/gi, msg: 'Repeated word.' },
    { re: /\s,|,(?=[A-Za-z])/g, msg: 'Spacing around the comma.' },
    { re: /(?<![A-Z0-9.])\.(?=[A-Za-z]{2})/g, msg: 'Add a space after the full stop.' },
    { re: /(^|(?<!\b(?:e\.g|i\.e|etc|approx|vs|Mr|Mrs|Ms|Dr|St|No))[.!?]\s+)[a-z]/g, msg: 'Start the sentence with a capital letter.' },
    { re: /\bi\b(?!\.)/g, msg: 'Capitalise the pronoun “I”.' }
  ];
  const AN_EXCEPT = /^(uni|use|usu|usa|eu|one|once|ufo|ubiq)/i;
  const A_EXCEPT = /^(hour|honest|honou?r|heir|herb)/i;

  function splitSentences(text) {
    return (text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+|[^.!?]+$/g) || []).map(s => s.trim()).filter(s => BW.words(s) > 0);
  }
  function tokens(text) { return (text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) || []); }
  function mattr(tok, win) {
    win = win || 50;
    if (tok.length < win) return tok.length ? new Set(tok).size / tok.length : 0;
    let sum = 0, n = 0;
    for (let i = 0; i + win <= tok.length; i += 5) { sum += new Set(tok.slice(i, i + win)).size / win; n++; }
    return sum / n;
  }
  const sd = arr => { const m = arr.reduce((a, b) => a + b, 0) / (arr.length || 1); return Math.sqrt(arr.reduce((a, b) => a + (b - m) * (b - m), 0) / (arr.length || 1)); };

  function findIssues(text, task) {
    const out = [];
    const add = (i, len, msg, kind) => out.push({ i, len, msg, kind });
    for (const r of RULES) {
      r.re.lastIndex = 0; let m;
      while ((m = r.re.exec(text))) {
        if (r.msg.startsWith('Repeated') && /^(that|had|is|very)$/i.test(m[1])) continue;
        let i = m.index, len = m[0].length;
        if (r.msg.startsWith('Start the sentence')) { i = m.index + m[0].length - 1; len = 1; }
        add(i, len, r.msg, 'g');
        if (m[0].length === 0) r.re.lastIndex++;
      }
    }
    let m; const art = /\b(a|an) ([a-z]+)/gi;
    while ((m = art.exec(text))) {
      const w = m[2];
      if (m[1].toLowerCase() === 'a' && /^[aeiou]/i.test(w) && !AN_EXCEPT.test(w)) add(m.index, m[0].length, 'Use “an” before a vowel sound.', 'g');
      if (m[1].toLowerCase() === 'an' && /^[^aeiou]/i.test(w) && !A_EXCEPT.test(w)) add(m.index, m[0].length, 'Use “a” before a consonant sound.', 'g');
    }
    const wre = /[A-Za-z]+/g;
    while ((m = wre.exec(text))) {
      const fix = MISSPELL[m[0].toLowerCase()];
      if (fix) add(m.index, m[0].length, `Spelling: ${fix}`, 's');
    }
    const formal = task.kind !== 'gt1' || task.tone !== 'informal';
    if (formal) {
      CONTRACTION.lastIndex = 0;
      while ((m = CONTRACTION.exec(text))) add(m.index, m[0].length, 'Contraction — write the full form in formal writing.', 'w');
      for (const inf of INFORMAL) {
        const re = new RegExp('\\b' + inf.replace(/ /g, '\\s+') + '\\b', 'gi');
        while ((m = re.exec(text))) add(m.index, m[0].length, 'Informal for this task — choose a more formal word.', 'w');
      }
    }
    out.sort((a, b) => a.i - b.i);
    const merged = [];
    for (const it of out) { const last = merged[merged.length - 1]; if (last && it.i < last.i + last.len) continue; merged.push(it); }
    return merged;
  }

  /* task: {kind:'at1'|'gt1'|'t2', minWords, essayType?, tone?, visual?} */
  function analyze(text, task) {
    text = String(text || '');
    const wc = BW.words(text);
    const paras = text.split(/\n\s*\n|\n(?=\s*\S)/).map(p => p.trim()).filter(Boolean);
    const sents = splitSentences(text);
    const lens = sents.map(s => BW.words(s));
    const avgLen = lens.length ? wc / lens.length : 0;
    const tok = tokens(text);
    const low = ' ' + text.toLowerCase().replace(/\s+/g, ' ') + ' ';
    const used = {};
    for (const l of LINKERS) {
      const re = new RegExp('(^|[^a-z])' + l.replace(/ /g, '\\s+') + '(?=[^a-z])', 'g');
      const c = (low.match(re) || []).length;
      if (c) used[l] = c;
    }
    const linkerKinds = Object.keys(used).length;
    const linkerTotal = Object.values(used).reduce((a, b) => a + b, 0);
    const overused = Object.entries(used).filter(([k, c]) => c >= 3 && !['because', 'such as', 'while', 'as well as', 'then', 'since'].includes(k)).map(([k]) => k);
    const content = tok.filter(t => t.length > 3 && !STOP.has(t));
    const freq = {};
    content.forEach(t => { freq[t] = (freq[t] || 0) + 1; });
    const repeated = Object.entries(freq).filter(([w, c]) => c >= Math.max(5, Math.round(wc / 45))).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const acad = new Set(content.filter(t => ACADEMIC.some(a => t.startsWith(a))));
    const div = mattr(tok);
    const complex = sents.filter(s => SUBORD.test(s) || /,\s*(which|who|where)\b/i.test(s)).length;
    const complexRatio = sents.length ? complex / sents.length : 0;
    const passive = (text.match(/\b(is|are|was|were|been|be|being)\s+\w+(ed|en)\b/gi) || []).length;
    const longS = lens.filter(n => n > 45).length;
    const issues = findIssues(text, task);
    const gram = issues.filter(i => i.kind === 'g').length, spell = issues.filter(i => i.kind === 's').length, inform = issues.filter(i => i.kind === 'w').length;

    const has = re => re.test(low);
    const overview = has(/\b(overall|in general|generally speaking|it is (clear|evident|noticeable)|the (most )?(striking|noticeable|significant) (feature|trend|change)|in summary|to summari[sz]e)\b/);
    const conclusion = has(/\b(in conclusion|to conclude|to sum up|in summary|overall,|all things considered|on balance|to summari[sz]e)\b/);
    const position = has(/\b(i (strongly )?(believe|agree|disagree|think|feel|would argue|am convinced)|in my (view|opinion)|this essay (will )?(argue|argues|disagree|agree)|i (partly|partially|completely|totally|fully) (agree|disagree)|from my perspective|my view is)\b/);
    const numbers = (text.match(/\d+(\.\d+)?\s*(%|per ?cent|million|billion|thousand)?/gi) || []).length;
    const salutation = /^\s*dear\b/i.test(text);
    const signoff = /\b(yours (sincerely|faithfully)|kind regards|best regards|best wishes|regards|warm wishes|love|all the best|take care|cheers|see you soon)\b/i.test(text.slice(-200));
    const yoursF = /yours faithfully/i.test(text), yoursS = /yours sincerely/i.test(text), dearSir = /dear (sir|madam|sir or madam)/i.test(text);

    const F = []; // feedback items {c, lvl, msg}
    const push = (c, lvl, msg) => F.push({ c, lvl, msg });
    const min = task.minWords;
    const t = BW.t;
    // Task achievement / response
    let TA = 6;
    if (wc < min * 0.7) { TA -= 1.5; push('TA', 'bad', t('wa_tooShortBad', { wc, min })); }
    else if (wc < min) { TA -= 0.5; push('TA', 'warn', t('wa_tooShort', { wc, min })); }
    else push('TA', 'good', t('wa_lengthOk', { wc, min }));
    if (task.kind === 'at1') {
      if (overview) { TA += 0.5; push('TA', 'good', t('wa_overviewYes')); } else { TA -= 1; push('TA', 'bad', t('wa_overviewNo')); }
      if (task.visual !== 'process' && task.visual !== 'map') { if (numbers >= 4) { push('TA', 'good', t('wa_dataYes')); } else { TA -= 0.5; push('TA', 'warn', t('wa_dataNo')); } }
      if (has(/\b(i think|in my opinion|i believe)\b/)) { TA -= 0.5; push('TA', 'warn', t('wa_noOpinionT1')); }
    } else if (task.kind === 't2') {
      if (task.essayType === 'opinion' || task.essayType === 'discussion' || task.essayType === 'positive_negative' || task.essayType === 'advantages') {
        if (position) { TA += 0.5; push('TA', 'good', t('wa_positionYes')); } else { TA -= 0.5; push('TA', 'warn', t('wa_positionNo')); }
      }
      if (conclusion) push('TA', 'good', t('wa_conclusionYes')); else { TA -= 0.5; push('TA', 'warn', t('wa_conclusionNo')); }
      if (/\bfor example|for instance|such as|to illustrate\b/.test(low)) push('TA', 'good', t('wa_examplesYes')); else push('TA', 'warn', t('wa_examplesNo'));
    } else if (task.kind === 'gt1') {
      if (salutation) push('TA', 'good', t('wa_salutationYes')); else { TA -= 0.5; push('TA', 'bad', t('wa_salutationNo')); }
      if (signoff) push('TA', 'good', t('wa_signoffYes')); else { TA -= 0.5; push('TA', 'warn', t('wa_signoffNo')); }
      if (task.tone === 'formal' && dearSir && yoursS) push('TA', 'warn', t('wa_faithfully'));
      if (task.tone === 'informal' && (yoursF || dearSir)) { TA -= 0.5; push('TA', 'warn', t('wa_tooFormal')); }
      push('TA', 'warn', t('wa_bullets'));
    }
    // Coherence & cohesion
    let CC = 6;
    const idealParas = task.kind === 't2' ? 4 : task.kind === 'gt1' ? 3 : 3;
    if (paras.length <= 1) { CC -= 1; push('CC', 'bad', t('wa_paraNone')); }
    else if (paras.length < idealParas) { CC -= 0.5; push('CC', 'warn', t('wa_paraFew', { n: paras.length, ideal: idealParas })); }
    else { CC += 0.5; push('CC', 'good', t('wa_paraOk', { n: paras.length })); }
    if (linkerKinds >= 6) { CC += 0.5; push('CC', 'good', t('wa_linkersGood', { n: linkerKinds })); }
    else if (linkerKinds <= 2) { CC -= 0.5; push('CC', 'warn', t('wa_linkersFew')); }
    if (overused.length) { CC -= 0.5; push('CC', 'warn', t('wa_linkersOver', { list: overused.join(', ') })); }
    if (sents.length && linkerTotal / sents.length > 1.1) { CC -= 0.5; push('CC', 'warn', t('wa_linkersMech')); }
    // Lexical resource
    let LR = 6;
    if (div >= 0.8) { LR += 1; push('LR', 'good', t('wa_lexHigh')); }
    else if (div >= 0.74) { LR += 0.5; push('LR', 'good', t('wa_lexOk')); }
    else if (div < 0.66 && wc > 80) { LR -= 0.5; push('LR', 'warn', t('wa_lexLow')); }
    if (acad.size >= 10) { LR += 0.5; push('LR', 'good', t('wa_acadGood', { n: acad.size })); }
    else if (task.kind !== 'gt1' && acad.size < 4 && wc > 100) push('LR', 'warn', t('wa_acadFew'));
    if (repeated.length) { LR -= 0.5; push('LR', 'warn', t('wa_repeat', { list: repeated.map(([w, c]) => `${w} ×${c}`).join(', ') })); }
    if (spell >= 3) { LR -= 0.5; push('LR', 'bad', t('wa_spellMany', { n: spell })); } else if (spell) push('LR', 'warn', t('wa_spellSome', { n: spell }));
    if (inform >= 2) { LR -= 0.5; push('LR', 'warn', t('wa_informal', { n: inform })); }
    // Grammar
    let GR = 6;
    if (complexRatio >= 0.5) { GR += 0.5; push('GRA', 'good', t('wa_complexGood')); }
    else if (complexRatio < 0.25 && sents.length > 4) { GR -= 0.5; push('GRA', 'warn', t('wa_complexFew')); }
    if (sd(lens) >= 6) { GR += 0.5; push('GRA', 'good', t('wa_varietyGood')); }
    if (avgLen && avgLen < 11 && sents.length > 4) { GR -= 0.5; push('GRA', 'warn', t('wa_shortSents')); }
    if (longS) { GR -= 0.5; push('GRA', 'warn', t('wa_longSents', { n: longS })); }
    if (gram) { GR -= Math.min(1.5, gram * 0.25); push('GRA', gram >= 4 ? 'bad' : 'warn', t('wa_gramFound', { n: gram })); }
    else push('GRA', 'good', t('wa_gramNone'));
    if (passive >= 2 && task.kind === 'at1' && task.visual === 'process') push('GRA', 'good', t('wa_passiveGood'));
    if (task.kind === 'at1' && task.visual === 'process' && passive < 2) push('GRA', 'warn', t('wa_passiveFew'));

    const c = v => BW.clamp(BW.halfRound(v), 3, 8);
    const est = { TA: c(TA), CC: c(CC), LR: c(LR), GRA: c(GR) };
    const avg = (est.TA + est.CC + est.LR + est.GRA) / 4;
    est.task = BW.roundBand(avg);
    if (wc < 20) { est.TA = est.CC = est.LR = est.GRA = est.task = null; }
    return {
      wc, paragraphs: paras.length, sentences: sents.length, avgLen: +avgLen.toFixed(1), diversity: +div.toFixed(2),
      linkers: used, linkerKinds, academic: [...acad].slice(0, 30), repeated, complexRatio: +complexRatio.toFixed(2),
      issues, feedback: F, est
    };
  }

  // Highlights issues inside the essay text (escaped).
  function markup(text, issues) {
    let out = '', pos = 0;
    for (const it of issues) {
      if (it.i < pos) continue;
      out += BW.esc(text.slice(pos, it.i));
      out += `<mark class="${it.kind === 'w' ? 'w' : it.kind === 's' ? 'l' : ''}" title="${BW.esc(it.msg)}">${BW.esc(text.slice(it.i, it.i + it.len))}</mark>`;
      pos = it.i + it.len;
    }
    return out + BW.esc(text.slice(pos));
  }

  /* Speaking transcript metrics */
  const FILLERS = /\b(um+|uh+|er+|erm+|ah+|hmm+|like|you know|i mean|sort of|kind of|basically|actually)\b/gi;
  function speechStats(text, seconds, pauses) {
    const wc = BW.words(text);
    const fill = (text.match(FILLERS) || []).length;
    const tok = tokens(text);
    const content = tok.filter(t => t.length > 3 && !STOP.has(t));
    const freq = {}; content.forEach(t => { freq[t] = (freq[t] || 0) + 1; });
    const repeated = Object.entries(freq).filter(([, c]) => c >= 4).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const used = LINKERS.filter(l => new RegExp('\\b' + l + '\\b', 'i').test(text));
    return { wc, wpm: seconds > 5 ? Math.round(wc / (seconds / 60)) : 0, fillers: fill, pauses: pauses || 0, diversity: +mattr(tok, 40).toFixed(2), repeated, linkers: used, seconds: Math.round(seconds) };
  }

  BW.analyzer = { analyze, markup, speechStats, splitSentences };
})();
