/* Bandwise — Writing Task 1 visuals, band ruler, progress charts */
(function () {
  'use strict';
  const BW = window.BW;
  const { esc } = BW;
  // Validated categorical order (adjacent-pair CVD safe on white). Colour follows the entity.
  const PAL = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
  const lum = hex => { const n = parseInt(hex.slice(1), 16); const r = n >> 16, g = (n >> 8) & 255, b = n & 255; return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
  const inkOn = hex => lum(hex) > 0.62 ? '#111' : '#fff';

  function nice(maxV, minV) {
    minV = Math.min(0, minV || 0);
    const span = (maxV - minV) || 1;
    const raw = span / 5;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || raw;
    return { min: Math.floor(minV / step) * step, max: Math.ceil(maxV / step) * step, step };
  }
  const fmtNum = v => {
    if (Math.abs(v) >= 1000) return (v / 1000).toFixed(v % 1000 ? 1 : 0).replace('.0', '') + 'K';
    return String(+v.toFixed(2));
  };
  function wrap(text, max) {
    const out = []; let line = '';
    for (const w of String(text).split(/\s+/)) {
      if ((line + ' ' + w).trim().length > max && line) { out.push(line); line = w; }
      else line = (line + ' ' + w).trim();
    }
    if (line) out.push(line);
    return out;
  }
  const tspans = (lines, x, lh) => lines.map((l, i) => `<tspan x="${x}" dy="${i ? lh : 0}">${esc(l)}</tspan>`).join('');

  function legend(names, square) {
    if (names.length < 2) return '';
    return `<div class="legend">${names.map((n, i) => `<span><i class="${square ? 'sq' : ''}" style="background:${PAL[i % PAL.length]}"></i>${esc(n)}</span>`).join('')}</div>`;
  }

  function lineChart(c, o) {
    const W = 660, H = 360, m = { l: 58, r: c.series.length <= 4 ? 118 : 24, t: 18, b: 56 };
    const all = c.series.flatMap(s => s.values.map(Number));
    const sc = nice(Math.max(...all), Math.min(...all));
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const x = i => m.l + (c.x.length === 1 ? iw / 2 : i * iw / (c.x.length - 1));
    const y = v => m.t + ih - (v - sc.min) / (sc.max - sc.min) * ih;
    let g = '';
    for (let v = sc.min; v <= sc.max + 1e-9; v += sc.step) g += `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end" font-size="12">${fmtNum(v)}</text>`;
    const every = Math.ceil(c.x.length / 10);
    c.x.forEach((lab, i) => { if (i % every === 0 || i === c.x.length - 1) g += `<text x="${x(i)}" y="${H - m.b + 20}" text-anchor="middle" font-size="12">${esc(lab)}</text>`; });
    g += `<line class="ax" x1="${m.l}" x2="${W - m.r}" y1="${y(sc.min)}" y2="${y(sc.min)}"/>`;
    const ends = [];
    c.series.forEach((s, k) => {
      const col = PAL[k % PAL.length];
      const pts = s.values.map((v, i) => `${x(i)},${y(+v)}`).join(' ');
      g += `<polyline points="${pts}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
      s.values.forEach((v, i) => { g += `<circle cx="${x(i)}" cy="${y(+v)}" r="4" fill="${col}" stroke="#fff" stroke-width="2">${o.tips ? `<title>${esc(s.name)} — ${esc(c.x[i])}: ${v}</title>` : ''}</circle>`; });
      ends.push({ name: s.name, y: y(+s.values[s.values.length - 1]), col });
    });
    if (c.series.length <= 4) {
      ends.sort((a, b) => a.y - b.y);
      const clash = ends.some((e, i) => i && e.y - ends[i - 1].y < 15);
      if (!clash) ends.forEach(e => { g += `<line x1="${W - m.r + 6}" x2="${W - m.r + 16}" y1="${e.y}" y2="${e.y}" stroke="${e.col}" stroke-width="2"/><text x="${W - m.r + 20}" y="${e.y + 4}" font-size="12">${esc(wrap(e.name, 14)[0])}</text>`; });
    }
    if (c.yLabel) g += `<text transform="translate(14 ${m.t + ih / 2}) rotate(-90)" text-anchor="middle" font-size="12">${esc(c.yLabel)}</text>`;
    if (c.xLabel) g += `<text x="${m.l + iw / 2}" y="${H - 8}" text-anchor="middle" font-size="12">${esc(c.xLabel)}</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(c.title || 'Line graph')}">${g}</svg>` + legend(c.series.map(s => s.name));
  }

  function roundTop(x, y, w, h) {
    const r = Math.min(4, w / 2, h);
    if (h <= 0) return '';
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  }
  function roundEnd(x, y, w, h) { // horizontal bar, rounded right end
    const r = Math.min(4, h / 2, w);
    if (w <= 0) return '';
    return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
  }

  function barChart(c, o) {
    const ns = c.series.length, nc = c.categories.length;
    const longLabels = c.categories.some(l => String(l).length > 14) || nc > 8;
    const all = c.series.flatMap(s => s.values.map(Number));
    const sc = nice(Math.max(...all), Math.min(...all));
    let g = '';
    if (!longLabels) {
      const W = 660, H = 360, m = { l: 58, r: 20, t: 18, b: 60 };
      const iw = W - m.l - m.r, ih = H - m.t - m.b, band = iw / nc;
      const bw = Math.min(24, (band * 0.7 - (ns - 1) * 2) / ns);
      const y = v => m.t + ih - (v - sc.min) / (sc.max - sc.min) * ih;
      for (let v = sc.min; v <= sc.max + 1e-9; v += sc.step) g += `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end" font-size="12">${fmtNum(v)}</text>`;
      c.categories.forEach((cat, i) => {
        const gx = m.l + i * band + band / 2 - (ns * bw + (ns - 1) * 2) / 2;
        c.series.forEach((s, k) => {
          const v = +s.values[i], top = y(Math.max(v, 0)), h = y(0) - top;
          g += `<path d="${roundTop(gx + k * (bw + 2), top, bw, h)}" fill="${PAL[k % PAL.length]}">${o.tips ? `<title>${esc(s.name)} — ${esc(cat)}: ${v}</title>` : ''}</path>`;
        });
        const lines = wrap(cat, 12);
        g += `<text y="${H - m.b + 18}" text-anchor="middle" font-size="12">${tspans(lines, m.l + i * band + band / 2, 14)}</text>`;
      });
      g += `<line class="ax" x1="${m.l}" x2="${W - m.r}" y1="${y(0)}" y2="${y(0)}"/>`;
      if (c.yLabel) g += `<text transform="translate(14 ${m.t + ih / 2}) rotate(-90)" text-anchor="middle" font-size="12">${esc(c.yLabel)}</text>`;
      if (c.xLabel) g += `<text x="${m.l + iw / 2}" y="${H - 6}" text-anchor="middle" font-size="12">${esc(c.xLabel)}</text>`;
      return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(c.title || 'Bar chart')}">${g}</svg>` + legend(c.series.map(s => s.name), true);
    }
    const rowH = Math.max(28, ns * 14 + 12), W = 660, m = { l: 170, r: 30, t: 14, b: 44 };
    const H = m.t + m.b + rowH * nc, iw = W - m.l - m.r;
    const x = v => m.l + (v - sc.min) / (sc.max - sc.min) * iw;
    const bh = Math.min(16, (rowH - 10 - (ns - 1) * 2) / ns);
    for (let v = sc.min; v <= sc.max + 1e-9; v += sc.step) g += `<line class="grid" y1="${m.t}" y2="${H - m.b}" x1="${x(v)}" x2="${x(v)}"/><text y="${H - m.b + 18}" x="${x(v)}" text-anchor="middle" font-size="12">${fmtNum(v)}</text>`;
    c.categories.forEach((cat, i) => {
      const gy = m.t + i * rowH + rowH / 2 - (ns * bh + (ns - 1) * 2) / 2;
      c.series.forEach((s, k) => { const v = +s.values[i]; g += `<path d="${roundEnd(x(0), gy + k * (bh + 2), x(v) - x(0), bh)}" fill="${PAL[k % PAL.length]}">${o.tips ? `<title>${esc(s.name)} — ${esc(cat)}: ${v}</title>` : ''}</path>`; });
      const lines = wrap(cat, 22);
      g += `<text y="${m.t + i * rowH + rowH / 2 + 4 - (lines.length - 1) * 7}" text-anchor="end" font-size="12">${tspans(lines, m.l - 10, 14)}</text>`;
    });
    g += `<line class="ax" y1="${m.t}" y2="${H - m.b}" x1="${x(0)}" x2="${x(0)}"/>`;
    if (c.yLabel) g += `<text x="${m.l + iw / 2}" y="${H - 6}" text-anchor="middle" font-size="12">${esc(c.yLabel)}</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(c.title || 'Bar chart')}">${g}</svg>` + legend(c.series.map(s => s.name), true);
  }

  function pieChart(c) {
    const names = [];
    c.pies.forEach(p => p.slices.forEach(s => { if (!names.includes(s.name)) names.push(s.name); }));
    const n = c.pies.length, R = 92, cw = 250, W = cw * n, H = 270;
    let g = '';
    c.pies.forEach((p, pi) => {
      const cx = cw * pi + cw / 2, cy = 128;
      const total = p.slices.reduce((a, s) => a + Number(s.value), 0) || 1;
      let a0 = -Math.PI / 2, lastSmall = -9, bump = 0;
      p.slices.forEach(s => {
        const frac = Number(s.value) / total, a1 = a0 + frac * Math.PI * 2;
        const col = PAL[names.indexOf(s.name) % PAL.length];
        const large = a1 - a0 > Math.PI ? 1 : 0;
        const x0 = cx + R * Math.cos(a0), y0 = cy + R * Math.sin(a0), x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
        g += frac >= 0.999 ? `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${col}"/>` :
          `<path d="M${cx},${cy}L${x0},${y0}A${R},${R} 0 ${large} 1 ${x1},${y1}Z" fill="${col}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>`;
        const mid = (a0 + a1) / 2, lab = `${s.value}${c.unit || ''}`;
        if (frac >= 0.07) g += `<text x="${cx + R * 0.62 * Math.cos(mid)}" y="${cy + R * 0.62 * Math.sin(mid) + 4}" text-anchor="middle" font-size="12" font-weight="600" style="fill:${inkOn(col)}">${esc(lab)}</text>`;
        else {
          bump = mid - lastSmall < 0.3 ? (bump ? 0 : 16) : 0; lastSmall = mid;
          const ex = cx + (R + 14 + bump) * Math.cos(mid), ey = cy + (R + 14 + bump) * Math.sin(mid);
          g += `<line x1="${cx + R * Math.cos(mid)}" y1="${cy + R * Math.sin(mid)}" x2="${ex}" y2="${ey}" stroke="#777" stroke-width="1"/><text x="${ex + (Math.cos(mid) >= 0 ? 3 : -3)}" y="${ey + 4}" text-anchor="${Math.cos(mid) >= 0 ? 'start' : 'end'}" font-size="11">${esc(lab)}</text>`;
        }
        a0 = a1;
      });
      g += `<text x="${cx}" y="${H - 14}" text-anchor="middle" font-size="13" font-weight="700" class="ttl">${esc(p.label)}</text>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(c.title || 'Pie charts')}" style="max-width:${n * 300}px;margin:0 auto">${g}</svg>` + legend(names, true);
  }

  function tableViz(c) {
    return `<div class="table-wrap"><table class="viz-table"><thead><tr>${c.headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${c.rows.map(r => `<tr>${r.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  function processViz(c) {
    const n = c.steps.length;
    const bw = 186;
    const wrapped = c.steps.map(st => wrap(st, 25));
    const maxLines = Math.max(...wrapped.map(l => l.length));
    const bh = Math.max(70, 26 + maxLines * 15);
    let g = '', W, H;
    const box = (x, y, i) => {
      const lines = wrapped[i];
      return `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="8" fill="#F3F6FA" stroke="#5B6B82" stroke-width="1.2"/>` +
        `<circle cx="${x + 16}" cy="${y + 16}" r="11" fill="#17233B"/><text x="${x + 16}" y="${y + 20}" text-anchor="middle" font-size="12" font-weight="700" style="fill:#fff">${i + 1}</text>` +
        `<text y="${y + bh / 2 - (lines.length - 1) * 7.5 + 4}" text-anchor="middle" font-size="12">${tspans(lines, x + bw / 2 + 8, 15)}</text>`;
    };
    const mid = 'ah' + Math.random().toString(36).slice(2, 7);
    const arrow = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#5B6B82" stroke-width="1.6" marker-end="url(#${mid})"/>`;
    const defs = `<defs><marker id="${mid}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="#5B6B82"/></marker></defs>`;
    if (c.cycle) {
      const R = Math.max(160, n * 36);
      W = 2 * R + bw + 40; H = 2 * R + bh + 40;
      const cx = W / 2, cy = H / 2;
      const pos = [...Array(n)].map((_, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + R * Math.cos(a), cy + R * Math.sin(a), a]; });
      pos.forEach(([x, y], i) => { g += box(x - bw / 2, y - bh / 2, i); });
      pos.forEach(([, , a], i) => {
        const b = -Math.PI / 2 + (i + 1) * 2 * Math.PI / n, m1 = a + (b - a) * 0.3, m2 = a + (b - a) * 0.7, r = R * 0.98;
        g += `<path d="M${cx + r * Math.cos(m1)},${cy + r * Math.sin(m1)} A${r},${r} 0 0 1 ${cx + r * Math.cos(m2)},${cy + r * Math.sin(m2)}" fill="none" stroke="#5B6B82" stroke-width="1.6" marker-end="url(#${mid})"/>`;
      });
    } else {
      const cols = n <= 4 ? n : 3, rows = Math.ceil(n / cols), gx = 44, gy = 40;
      W = cols * bw + (cols - 1) * gx + 20; H = rows * bh + (rows - 1) * gy + 20;
      const at = i => { const r = Math.floor(i / cols); let col = i % cols; if (r % 2) col = cols - 1 - col; return [10 + col * (bw + gx), 10 + r * (bh + gy), r]; };
      for (let i = 0; i < n; i++) {
        const [x, y] = at(i); g += box(x, y, i);
        if (i < n - 1) {
          const [x2, y2, r2] = at(i + 1), r = Math.floor(i / cols);
          if (r2 === r) g += x2 > x ? arrow(x + bw + 4, y + bh / 2, x2 - 4, y2 + bh / 2) : arrow(x - 4, y + bh / 2, x2 + bw + 4, y2 + bh / 2);
          else g += arrow(x + bw / 2, y + bh + 4, x2 + bw / 2, y2 - 4);
        }
      }
    }
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(c.title || 'Process diagram')}">${defs}${g}</svg>`;
  }

  const MAPSTYLE = {
    building: ['#D9DDE3', '#4A5568'], road: ['#9AA3AE', 'none'], park: ['#CFE6C2', '#6E9C5A'], water: ['#BBD7F0', '#5E8DB8'],
    car_park: ['#ECEEF1', '#7D8794'], trees: ['#E3F0DA', 'none'], field: ['#F1E7C6', '#B39A54'], path: ['#E9D9B8', 'none']
  };
  function oneMap(m, k) {
    const S = 6, W = 100 * S, H = 60 * S;
    let g = `<rect x="0" y="0" width="${W}" height="${H}" fill="#FAFAF7" stroke="#8A8A8A"/>`;
    const order = ['field', 'park', 'water', 'trees', 'road', 'path', 'car_park', 'building'];
    const feats = (m.features || []).slice().sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
    for (const f of feats) {
      const [fill, stroke] = MAPSTYLE[f.kind] || MAPSTYLE.building;
      const x = f.x * S, y = f.y * S, w = f.w * S, h = f.h * S;
      g += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${f.kind === 'building' ? 2 : 4}" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>`;
      if (f.kind === 'trees') {
        for (let tx = x + 10; tx < x + w - 6; tx += 18) for (let ty = y + 10; ty < y + h - 6; ty += 18) g += `<circle cx="${tx}" cy="${ty}" r="6" fill="#7FB069"/>`;
      }
      if (f.kind === 'car_park') g += `<text x="${x + 12}" y="${y + 18}" font-size="14" font-weight="700" style="fill:#4A5568">P</text>`;
      if (f.label) {
        const horizontal = w >= h || w > 70;
        const lines = wrap(f.label, Math.max(6, Math.floor(w / 7.5)));
        const fs = w < 70 || h < 30 ? 11 : 12;
        g += horizontal || lines.length === 1
          ? `<text y="${y + h / 2 + 4 - (lines.length - 1) * 6}" text-anchor="middle" font-size="${fs}" style="fill:${f.kind === 'road' ? '#fff' : '#222'}">${tspans(lines, x + w / 2, 13)}</text>`
          : `<text transform="translate(${x + w / 2 + 4} ${y + h / 2}) rotate(-90)" text-anchor="middle" font-size="${fs}" style="fill:${f.kind === 'road' ? '#fff' : '#222'}">${esc(f.label)}</text>`;
      }
    }
    g += `<g transform="translate(${W - 26} 26)"><path d="M0,-16 L6,4 L0,0 L-6,4 Z" fill="#333"/><text y="18" text-anchor="middle" font-size="11" font-weight="700">N</text></g>`;
    return `<figure style="margin:0"><svg viewBox="-2 -2 ${W + 4} ${H + 4}" role="img" aria-label="${esc(m.label || 'Map')}">${g}</svg><figcaption class="viz-title">${esc(m.label || '')}</figcaption></figure>`;
  }
  function mapViz(c) {
    return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;padding:8px">${c.maps.map(oneMap).join('')}</div>`;
  }

  function render(c, o) {
    o = o || {};
    if (!c) return '';
    let body = '';
    switch (c.type) {
      case 'line': body = lineChart(c, o); break;
      case 'bar': body = barChart(c, o); break;
      case 'pie': body = pieChart(c, o); break;
      case 'table': body = tableViz(c); break;
      case 'process': body = processViz(c); break;
      case 'map': body = mapViz(c); break;
      case 'mixed': return c.parts.map(p => render(p, o)).join('<div style="height:10px"></div>');
      default: body = '';
    }
    return `<div class="viz">${c.title ? `<div class="viz-title">${esc(c.title)}</div>` : ''}${body}</div>`;
  }

  // Plain-text description of a visual, used for AI marking and screen readers.
  function describe(c) {
    if (!c) return '';
    switch (c.type) {
      case 'line': return `${c.title || 'Line graph'}. X axis (${c.xLabel || ''}): ${c.x.join(', ')}. Y axis: ${c.yLabel || ''}. ` + c.series.map(s => `${s.name}: ${s.values.join(', ')}`).join('; ');
      case 'bar': return `${c.title || 'Bar chart'}. ${c.yLabel || ''}. Categories: ${c.categories.join(', ')}. ` + c.series.map(s => `${s.name}: ${s.values.join(', ')}`).join('; ');
      case 'pie': return `${c.title || 'Pie charts'}. ` + c.pies.map(p => `${p.label}: ` + p.slices.map(s => `${s.name} ${s.value}${c.unit || ''}`).join(', ')).join('; ');
      case 'table': return `${c.title || 'Table'}. ${c.headers.join(' | ')}. ` + c.rows.map(r => r.join(' | ')).join('; ');
      case 'process': return `${c.title || 'Process'}${c.cycle ? ' (cycle)' : ''}: ` + c.steps.map((s, i) => `${i + 1}. ${s}`).join(' ');
      case 'map': return `${c.title || 'Maps'}. ` + c.maps.map(m => `${m.label}: ` + (m.features || []).filter(f => f.label).map(f => `${f.label} (${f.kind}, at x${f.x} y${f.y})`).join(', ')).join(' || ');
      case 'mixed': return c.parts.map(describe).join(' Second visual: ');
    }
    return '';
  }

  /* Band ruler on the home screen */
  function ruler(tokens, target) {
    const pos = b => (b / 9 * 100).toFixed(3) + '%';
    let ticks = '';
    for (let b = 0; b <= 9; b += 0.5) {
      const major = b % 1 === 0;
      ticks += `<i class="ruler-tick ${major ? 'major' : 'minor'}" style="left:${pos(b)}"></i>`;
      if (major) ticks += `<span class="ruler-label" style="left:${pos(b)}">${b}</span>`;
    }
    let tg = '';
    if (target) tg = `<i class="ruler-target" style="left:${pos(target)}"></i><span class="ruler-target-label" style="left:${pos(target)}">${esc(BW.t('target'))} ${BW.fmtBand(target)}</span>`;
    const placed = [];
    const toks = tokens.map(t => {
      const b = t.band == null ? null : t.band;
      const at = b == null ? null : b;
      let stack = 0;
      if (at != null) { while (placed.some(p => Math.abs(p.at - at) < 0.45 && p.stack === stack)) stack++; placed.push({ at, stack }); }
      return at == null ? '' : `<span class="ruler-token" data-stack="${stack}" style="left:${pos(at)}" title="${esc(t.title)}">${esc(t.letter)}</span>`;
    }).join('');
    return `<div class="ruler-wrap"><div class="ruler" role="img" aria-label="${esc(tokens.filter(t => t.band != null).map(t => t.title + ' ' + BW.fmtBand(t.band)).join(', '))}"><div class="ruler-track"></div>${ticks}${tg}${toks}</div></div>`;
  }

  function miniRuler(band, target) {
    const pos = b => (b / 9 * 100).toFixed(2) + '%';
    let s = '';
    for (let b = 0; b <= 9; b++) s += `<i style="left:${pos(b)}"></i>`;
    if (target) s += `<em style="left:${pos(target)}"></em>`;
    if (band != null) s += `<b style="left:${pos(band)}"></b>`;
    return `<div class="mini-ruler" aria-hidden="true">${s}</div>`;
  }

  /* Small-multiple trend for one skill */
  function trend(points, target) {
    const W = 260, H = 120, m = { l: 22, r: 30, t: 10, b: 18 };
    const lo = 3, hi = 9;
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const x = i => m.l + (points.length < 2 ? iw / 2 : i * iw / (points.length - 1));
    const y = v => m.t + ih - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * ih;
    let g = '';
    for (let b = lo; b <= hi; b += 1) g += `<line class="gl" x1="${m.l}" x2="${W - m.r}" y1="${y(b)}" y2="${y(b)}"/>${b % 2 ? `<text x="${m.l - 6}" y="${y(b) + 4}" text-anchor="end">${b}</text>` : ''}`;
    if (target) g += `<line class="tgt" x1="${m.l}" x2="${W - m.r}" y1="${y(target)}" y2="${y(target)}" opacity=".85"/>`;
    if (points.length) {
      g += `<polyline class="ln" points="${points.map((p, i) => `${x(i)},${y(p.band)}`).join(' ')}"/>`;
      points.forEach((p, i) => { g += `<circle class="dot" r="4" cx="${x(i)}" cy="${y(p.band)}"><title>${esc(p.label)}: ${BW.fmtBand(p.band)}</title></circle>`; });
      const last = points[points.length - 1];
      g += `<text x="${x(points.length - 1) + 8}" y="${y(last.band) + 4}" style="fill:var(--ink);font-weight:600">${BW.fmtBand(last.band)}</text>`;
    }
    return `<svg viewBox="0 0 ${W} ${H}">${g}</svg>`;
  }

  BW.charts = { render, describe, ruler, miniRuler, trend, PAL };
})();
