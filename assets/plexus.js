// Learn the Plexus – interactive schematic, click-to-learn and "guess the missing label" quiz.
// Data: one JSON per plexus in games/plexus/<slug>.json, embedded by build.mjs into #pxData.
(function () {
  const G = window.MAGame;
  const root = document.getElementById('px');
  if (!root) return;
  const ALL = JSON.parse(document.getElementById('pxData').textContent);
  const BASE = root.dataset.base || '/';
  const $ = (s) => root.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  };
  const WIDTH = { radix: 14, truncus: 14, divisio: 9, fasciculus: 12, terminalis: 10, ramus: 4 };
  const LEVEL_WORD = { radix: 'a Radix (root)', truncus: 'a Truncus (trunk)', divisio: 'a Divisio (division)', fasciculus: 'a Fasciculus (cord)', terminalis: 'a terminal nerve', ramus: 'a branch' };

  let P, byId, svg, layers;
  let selected = null, rootHl = null, mode = 'explore';
  const Q = { level: 1, queue: [], i: 0, score: 0, streak: 0, best: 0, done: false, cur: null, tries: 0, hint: 0, missed: [], log: [] };

  // ---------- text matching (Latin abbreviations are treated as equal to the full word) ----------
  const ABBR = [
    [/\b(nervus|nervi|n)\b/g, 'n'], [/\b(nn)\b/g, 'nn'], [/\b(musculus|musculi|m)\b/g, 'm'], [/\bmm\b/g, 'm'],
    [/\b(fasciculus|fasc|fas)\b/g, 'fasc'], [/\b(divisio|divisiones|div)\b/g, 'div'], [/\b(truncus|trunci|tr)\b/g, 'tr'],
    [/\b(radix|radices|rad)\b/g, 'rad'], [/\b(ramus|rami|rr|r)\b/g, 'r'],
    [/\b(anterior|ant)\b/g, 'ant'], [/\b(posterior|post)\b/g, 'post'], [/\b(superior|superioris|sup)\b/g, 'sup'],
    [/\b(inferior|inferioris|inf)\b/g, 'inf'], [/\b(lateralis|lat)\b/g, 'lat'], [/\b(medialis|med)\b/g, 'med'],
    [/\bmedii\b/g, 'medius'], [/\bth\s?1\b/g, 't1'], [/\bmediani\b/g, 'mediani'],
  ];
  function canon(s) {
    let t = String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[–—\-_.,()'"’]/g, ' ').replace(/\s+/g, ' ').trim();
    for (const [re, to] of ABBR) t = t.replace(re, to);
    return t.replace(/\s+/g, ' ').trim();
  }
  const dropN = (t) => t.replace(/^(n|m|rad|fasc|tr|div) /, '');
  function judge(input, node) {
    const a = canon(input);
    if (!a) return { kind: 'empty' };
    const latin = node.answers.map(canon);
    if (latin.includes(a)) return { kind: 'ok' };
    if (latin.some((x) => dropN(x) === a && x !== a)) return { kind: 'ok', note: `Write it with the prefix: ${node.answers[0]}` };
    const eng = (node.en || []).map(canon);
    if (eng.includes(a)) return { kind: 'en' };
    // almost: small spelling slip, and not closer to another structure's name
    const lim = a.length <= 4 ? 0 : input.trim().length <= 10 ? 1 : 2;
    let bestD = Infinity;
    const plain = (t) => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[–—\-_.,()'"’]/g, ' ').replace(/\s+/g, ' ').trim();
    const ap = plain(input);
    for (const x of latin) bestD = Math.min(bestD, G.dist(a, x), G.dist(a, dropN(x)));
    for (const x of node.answers) bestD = Math.min(bestD, G.dist(ap, plain(x)));
    if (bestD <= lim) {
      const other = P.structures.some((s) => s.id !== node.id && s.answers[0] !== node.answers[0] && s.answers.map(canon).some((x) => G.dist(a, x) < bestD || x === a) || s.answers.some((x) => G.dist(ap, plain(x)) < bestD));
      if (!other) return { kind: 'almost' };
    }
    const hit = P.structures.find((s) => s.id !== node.id && s.answers.map(canon).concat((s.en || []).map(canon)).includes(a));
    return { kind: 'bad', other: hit && hit.answers[0] !== node.answers[0] ? hit : null };
  }

  // ---------- pathway tracing (follow only the fibres of the selected structure's segments) ----------
  const meets = (a, b) => a.some((x) => b.includes(x));
  function upstream(n, roots = n.roots, acc = new Set()) {
    acc.add(n.id);
    for (const p of n.parents || []) { const pn = byId[p]; if (pn && meets(pn.roots, roots)) upstream(pn, roots, acc); }
    return acc;
  }
  function downstream(n, roots = n.roots, acc = new Set()) {
    for (const c of P.structures) if ((c.parents || []).includes(n.id) && meets(c.roots, roots) && !acc.has(c.id)) { acc.add(c.id); downstream(c, roots, acc); }
    return acc;
  }
  function chain(n) {
    // readable pathway, e.g. "C6–C8 → Truncus superior + medius + inferior → Divisiones posteriores → Fasciculus posterior → N. thoracodorsalis"
    const up = upstream(n);
    const order = ['radix', 'truncus', 'divisio', 'fasciculus', 'ramus', 'terminalis'];
    const merge = (names) => {
      const w = names.map((x) => x.split(' '));
      if (names.length > 1 && w.every((x) => x[0] === w[0][0] && x.length === 2)) return w[0][0] + ' ' + w.map((x) => x[1]).join(' + ');
      return names.join(' + ');
    };
    const steps = [];
    for (const lv of order) {
      const ns = P.structures.filter((s) => up.has(s.id) && s.level === lv && s.id !== n.id);
      if (!ns.length) continue;
      if (lv === 'radix') steps.push(ns.length > 1 ? `${ns[0].short}–${ns[ns.length - 1].short}` : ns[0].short);
      else if (lv === 'divisio') {
        const post = ns.every((s) => s.posterior), ant = ns.every((s) => !s.posterior);
        steps.push(ns.length === 1 ? ns[0].answers[0] : ant ? 'Divisiones anteriores' : post ? 'Divisiones posteriores' : 'Divisiones');
      } else if (lv === 'ramus' && ns.every((s) => s.id.startsWith('radix-'))) steps.push('Radix lateralis + medialis');
      else steps.push(merge(ns.map((s) => s.answers[0])));
    }
    steps.push(n.answers[0]);
    return steps.join(' → ');
  }

  // ---------- drawing ----------
  function colorOf(n) {
    const lv = n.level === 'ramus' ? n.of : n.level;
    return P.levels[lv].color;
  }
  function draw() {
    const stage = $('#pxStage');
    stage.innerHTML = '';
    svg = el('svg', { viewBox: P.viewBox, class: 'px-svg', role: 'img', 'aria-label': `Schematic of the ${P.title}` }, stage);
    const [, , W, H] = P.viewBox.split(' ').map(Number);
    el('rect', { x: 0, y: 0, width: W, height: H, class: 'px-board', rx: 18 }, svg);
    layers = {};
    ['bg', 'under', 'post', 'front', 'circles', 'labels', 'hit'].forEach((k) => (layers[k] = el('g', { class: 'px-l-' + k }, svg)));
    // column headers
    for (const c of P.columns) {
      const t = el('text', { x: c.x, y: 34, class: 'px-col', 'text-anchor': 'middle', fill: P.levels[c.level].color }, layers.bg);
      t.textContent = c.label;
    }
    for (const L of P.landmarks || []) {
      if (L.type === 'band') {
        el('rect', { x: L.x, y: L.y, width: L.w, height: L.h, rx: L.w / 2, class: 'px-band' }, layers.bg);
        const t = el('text', { x: L.lx, y: L.ly, class: 'px-landmark', 'text-anchor': 'middle' }, layers.bg); t.textContent = L.label;
      } else {
        const lines = L.text.split('\n');
        const t = el('text', { x: L.x, y: L.y, class: L.type === 'note' ? 'px-note' : 'px-landmark', 'text-anchor': L.anchor || 'start' }, layers.bg);
        lines.forEach((ln, i) => { const s = el('tspan', { x: L.x, dy: i ? 15 : 0 }, t); s.textContent = ln; });
      }
    }
    for (const n of P.structures) {
      const layer = n.under ? layers.under : n.posterior || ['subscapularis-superior', 'thoracodorsalis', 'subscapularis-inferior'].includes(n.id) ? layers.post : layers.front;
      const g = el('g', { class: `px-n lv-${n.level}${n.posterior ? ' is-post' : ''}`, 'data-id': n.id }, layer);
      const w = WIDTH[n.level];
      el('path', { d: n.d, class: 'px-halo', 'stroke-width': w + 7 }, g);
      el('path', { d: n.d, class: 'px-stroke', stroke: colorOf(n), 'stroke-width': w, 'stroke-dasharray': n.level === 'divisio' && n.posterior ? '14 7' : null }, g);
      el('path', { d: n.d, class: 'px-hit', 'data-id': n.id, 'stroke-width': Math.max(22, w + 12) }, layers.hit);
      n._g = g;
      n._path = g.querySelector('.px-stroke');
      if (n.circle) {
        const cg = el('g', { class: 'px-root', 'data-id': n.id, tabindex: 0, role: 'button', 'aria-label': n.short }, layers.circles);
        el('circle', { cx: n.circle[0], cy: n.circle[1], r: 25, fill: colorOf(n) }, cg);
        const t = el('text', { x: n.circle[0], y: n.circle[1] + 7, 'text-anchor': 'middle', class: 'px-root-t' }, cg);
        t.textContent = n.short;
        n._lbl = cg; n._lblText = t;
      } else {
        drawLabel(n);
      }
    }
  }
  function labelPoint(n) {
    const L = n.label || {};
    if (L.t !== undefined && L.x === undefined) {
      const len = n._path.getTotalLength();
      const pt = n._path.getPointAtLength(len * L.t);
      return { x: pt.x + (L.dx || 0), y: pt.y + (L.dy || 0), anchor: L.anchor || 'middle', lead: L.lead ? pt : null };
    }
    let lead = null;
    if (L.lead) { const len = n._path.getTotalLength(); lead = n._path.getPointAtLength(len * (L.t ?? 0.5)); }
    return { x: L.x, y: L.y, anchor: L.anchor || 'start', lead };
  }
  function drawLabel(n) {
    const L = n.label || {};
    const p = labelPoint(n);
    const g = el('g', { class: `px-lbl${L.big ? ' big' : ''}${L.small ? ' small' : ''}${n.level === 'ramus' ? ' thin' : ''}`, 'data-id': n.id, tabindex: 0, role: 'button' }, layers.labels);
    const lines = n.short.split('\n');
    const fs = L.big ? 19 : L.small ? 12.5 : n.level === 'ramus' ? 13.5 : 15.5;
    const lh = fs * 1.15;
    const y0 = p.y - ((lines.length - 1) * lh) / 2 + fs * 0.35;
    if (p.lead) n._lead = el('line', { x1: p.lead.x, y1: p.lead.y, x2: p.x + (p.anchor === 'end' ? 4 : p.anchor === 'start' ? -4 : 0), y2: p.y, class: 'px-lead' }, g);
    const bg = el('rect', { class: 'px-pill', rx: 7 }, g);
    const t = el('text', { x: p.x, y: y0, 'text-anchor': p.anchor, 'font-size': fs, fill: tint(colorOf(n)) }, g);
    lines.forEach((ln, i) => { const s = el('tspan', { x: p.x, dy: i ? lh : 0 }, t); s.textContent = ln; });
    const q = el('text', { x: p.x, y: p.y + fs * 0.35, 'text-anchor': p.anchor, 'font-size': fs, class: 'px-q' }, g);
    q.textContent = '?';
    n._lbl = g; n._lblText = t; n._q = q; n._pill = bg;
    fitPill(n);
    g.setAttribute('aria-label', n.short.replace('\n', ' '));
  }
  function fitPill(n) {
    const tgt = n._lbl.classList.contains('hide') ? n._q : n._lblText;
    let b;
    try { b = tgt.getBBox(); } catch { return; }
    if (!b.width && tgt === n._q) b = { x: b.x - 10, y: b.y, width: 20, height: b.height };
    const padX = 6, padY = 3;
    const minW = tgt === n._q ? 56 : 0;
    const w = Math.max(b.width + padX * 2, minW);
    const x = tgt === n._q ? (n._q.getAttribute('text-anchor') === 'start' ? b.x - padX : n._q.getAttribute('text-anchor') === 'end' ? b.x + b.width + padX - w : b.x + b.width / 2 - w / 2) : b.x - padX;
    n._pill.setAttribute('x', x); n._pill.setAttribute('y', b.y - padY);
    n._pill.setAttribute('width', w); n._pill.setAttribute('height', b.height + padY * 2);
  }
  function tint(hex) {
    // lighter version of a level colour for label text on the dark board
    const h = hex.replace('#', '');
    const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    return '#' + c.map((v) => Math.round(v + (255 - v) * 0.42).toString(16).padStart(2, '0')).join('');
  }

  // ---------- highlight state ----------
  function paint() {
    let on = null, mid = null, focus = null;
    if (selected) { focus = byId[selected]; on = upstream(focus); mid = downstream(focus); }
    else if (rootHl) { on = new Set(P.structures.filter((s) => s.roots.includes(rootHl)).map((s) => s.id)); }
    const asking = mode === 'quiz' && Q.cur && !selected;
    svg.classList.toggle('dim', !!on);
    for (const n of P.structures) {
      const st = asking ? (n.id === Q.cur.id ? 'focus' : '') : !on ? '' : on.has(n.id) ? (focus && n.id === focus.id ? 'focus' : 'on') : mid && mid.has(n.id) ? 'mid' : 'off';
      [n._g, n._lbl].forEach((e) => { e.classList.remove('focus', 'on', 'mid', 'off'); if (st) e.classList.add(st); });
    }
    root.querySelectorAll('[data-root]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.root === rootHl)));
  }
  function select(id, { scroll = false } = {}) {
    selected = id; rootHl = null;
    paint();
    showInfo(id ? byId[id] : null);
    if (scroll && id) $('#pxInfo').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ---------- info panel ----------
  function showInfo(n) {
    const box = $('#pxInfo');
    if (!n) {
      box.innerHTML = `<div class="px-info-empty"><strong>Tap any nerve, label or root.</strong><span>You will see its full Latin name, origin, root values, muscles and course – and the schematic lights up its pathway from the spinal cord.</span></div>`;
      return;
    }
    const lv = P.levels[n.level === 'ramus' ? n.of : n.level];
    const muscles = n.muscles || [];
    const withFig = muscles.filter((m) => n.figs && n.figs[m]);
    const levelName = n.level === 'ramus' ? `Branch of the ${lv.label.split(' (')[0].replace(/s$/, '').replace('Radice', 'Radix').replace('Trunci', 'Truncus').replace('Fasciculi', 'Fasciculus')} level` : lv.label;
    const quizHidden = mode === 'quiz' && Q.cur && Q.cur.id === n.id && !Q.cur._answered;
    if (quizHidden) { box.innerHTML = `<div class="px-info-empty"><strong>Name the highlighted structure first.</strong><span>Its facts appear here after you answer.</span></div>`; return; }
    box.innerHTML = `
      <div class="px-info-main">
        <div class="px-chip" style="--c:${colorOf(n)}">${esc(levelName)}</div>
        <h2 class="px-name">${esc(n.name)}</h2>
        ${n.en ? `<p class="px-en">English: ${esc(n.en[0])}</p>` : ''}
        <dl class="px-facts">
          <dt>Origin</dt><dd>${esc(n.origin)}</dd>
          <dt>Root values</dt><dd><span class="px-rv">${esc(n.rootText)}</span></dd>
          <dt>Pathway</dt><dd class="px-path">${esc(chain(n))}</dd>
          ${muscles.length ? `<dt>Innervated muscle${muscles.length > 1 ? 's' : ''}</dt><dd><ul class="px-mus">${muscles.map((m) => `<li><button type="button" class="px-m${n.figs && n.figs[m] ? ' has-fig' : ''}" data-m="${esc(m)}">${esc(m)}</button></li>`).join('')}</ul></dd>` : n.level === 'ramus' || n.level === 'terminalis' ? `<dt>Muscles</dt><dd>None – purely sensory</dd>` : ''}
          ${n.skin ? `<dt>Skin (sensory)</dt><dd>${esc(n.skin)}</dd>` : ''}
          ${n.course ? `<dt>Course</dt><dd>${esc(n.course)}</dd>` : ''}
          ${(n.facts || []).length ? `<dt>Good to know</dt><dd><ul class="px-list">${n.facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></dd>` : ''}
        </dl>
        ${n.clinical ? `<details class="px-clin"><summary>🩺 Clinical note</summary><p>${esc(n.clinical)}</p></details>` : ''}
      </div>
      <div class="px-info-side">${withFig.length || n.m3d ? `<figure class="px-fig" id="pxFig"></figure>` : n.level === 'radix' ? rootSide(n) : ''}</div>`;
    if (withFig.length) showFig(n, withFig[0]);
    else if (n.m3d) $('#pxFig').innerHTML = m3dLink(n, null);
    box.querySelectorAll('.px-m').forEach((b) => b.addEventListener('click', () => { if (n.figs && n.figs[b.dataset.m]) showFig(n, b.dataset.m); else if (n.m3d) $('#pxFig').innerHTML = m3dLink(n, b.dataset.m); }));
  }
  function rootSide(n) {
    const nerves = P.structures.filter((s) => (s.level === 'terminalis' || s.level === 'ramus') && s.roots.includes(n.id) && !s.id.startsWith('radix-'));
    return `<div class="px-carry"><strong>Nerves carrying ${esc(n.short)} fibres</strong><ul>${nerves.map((s) => `<li><button type="button" class="px-link" data-go="${s.id}">${esc(s.short.replace('\n', ' '))}</button></li>`).join('')}</ul></div>`;
  }
  function m3dLink(n, m) {
    const r = n.m3d;
    return `<div class="px-3d"><span>${m ? esc(m) + ' – ' : ''}see the muscles of this nerve on the rotating 3D model.</span><a class="btn" href="${BASE}games/muscle-3d/?region=${encodeURIComponent(r)}">Open 3D muscles ›</a></div>`;
  }
  function showFig(n, m) {
    const f = n.figs[m];
    const fig = $('#pxFig');
    if (!fig) return;
    $('#pxInfo').querySelectorAll('.px-m').forEach((b) => b.classList.toggle('on', b.dataset.m === m));
    fig.innerHTML = `<div class="px-zoom" title="Tap to zoom in or out"><img alt="${esc(m)} – ${esc(f.title)}" src="${BASE}games/plates/${esc(f.image)}"><span class="px-pin"></span></div>
      <figcaption><strong>${esc(m)}</strong> · ${esc(f.title)}<br><small>${esc(f.credit)}</small>${n.m3d ? `<br><a href="${BASE}games/muscle-3d/?region=${encodeURIComponent(n.m3d)}">Rotate it in 3D ›</a>` : ''}</figcaption>`;
    const box = fig.querySelector('.px-zoom');
    const img = box.querySelector('img');
    let zoom = 1.6;
    const place = () => {
      const W = box.clientWidth, H = box.clientHeight;
      if (!img.naturalWidth || !W) return;
      const iw = W * zoom, ih = iw * img.naturalHeight / img.naturalWidth;
      let left = W / 2 - (f.x / 100) * iw, top = H / 2 - (f.y / 100) * ih;
      left = Math.min(0, Math.max(W - iw, left)); top = Math.min(0, Math.max(H - ih, top));
      if (ih < H) top = (H - ih) / 2;
      img.style.width = iw + 'px'; img.style.left = left + 'px'; img.style.top = top + 'px';
      const pin = box.querySelector('.px-pin');
      pin.style.left = left + (f.x / 100) * iw + 'px'; pin.style.top = top + (f.y / 100) * ih + 'px';
    };
    img.onload = place; if (img.complete) place();
    box.addEventListener('click', () => { zoom = zoom > 1 ? 1 : 1.6; place(); });
    addEventListener('resize', place, { passive: true });
  }

  // ---------- quiz ----------
  function pool(level) {
    const s = P.structures;
    return level === 0 ? s : s.filter((n) => n.diff === level);
  }
  function startQuiz(level, only) {
    Q.level = level;
    const base = only ? only.map((id) => byId[id]) : pool(level);
    // divisions all share the answer "Divisio anterior/posterior" – use at most two of them per round
    let q = G.shuffle(base);
    let div = 0;
    q = q.filter((n) => (n.level === 'divisio' ? ++div <= 2 : true));
    Q.queue = q.slice(0, only ? q.length : 10);
    Q.i = 0; Q.score = 0; Q.streak = 0; Q.missed = []; Q.log = []; Q.done = false;
    root.classList.add('px-playing');
    $('#pxEnd').hidden = true;
    $('#pxPlay').hidden = false;
    next();
  }
  function next() {
    if (Q.cur) unhide(Q.cur);
    if (Q.i >= Q.queue.length) return finish();
    const n = Q.queue[Q.i];
    Q.cur = n; Q.tries = 0; Q.hint = 0; n._answered = false;
    selected = null; rootHl = null;
    hide(n);
    paint();
    showInfo(null);
    $('#pxInfo').innerHTML = `<div class="px-info-empty"><strong>Which structure is highlighted?</strong><span>Look at where it comes from and where it goes. Type the Latin name – abbreviations like N., M., Fasc. are fine.</span></div>`;
    $('#pxPrompt').innerHTML = `Question ${Q.i + 1} of ${Q.queue.length} – name the <strong>highlighted, hidden</strong> structure.`;
    $('#pxMsg').innerHTML = '';
    $('#pxInput').value = ''; $('#pxInput').disabled = false;
    $('#pxForm').hidden = false; $('#pxNext').hidden = true;
    hud();
    setTimeout(() => $('#pxInput').focus({ preventScroll: true }), 30);
  }
  function hide(n) {
    n._lbl.classList.add('hide', 'ask');
    if (n.circle) n._lblText.textContent = '?';
    else fitPill(n);
  }
  function unhide(n) {
    n._lbl.classList.remove('hide', 'ask', 'right', 'wrong');
    if (n.circle) n._lblText.textContent = n.short;
    else fitPill(n);
  }
  function reveal(n, good) {
    n._lbl.classList.remove('hide', 'ask');
    n._lbl.classList.add(good ? 'right' : 'wrong');
    if (n.circle) n._lblText.textContent = n.short;
    else fitPill(n);
  }
  function hud() {
    const total = Q.queue.length || 1;
    $('#pxBar').style.width = (Q.i / total) * 100 + '%';
    $('#pxScore').textContent = Q.score % 1 ? Q.score.toFixed(1) : Q.score;
    $('#pxStreak').textContent = Q.streak;
    $('#pxCount').textContent = `${Math.min(Q.i + 1, total)} / ${total}`;
  }
  function answer(e) {
    e.preventDefault();
    const n = Q.cur;
    if (!n || n._answered) return;
    const v = $('#pxInput').value;
    const r = judge(v, n);
    const msg = $('#pxMsg');
    if (r.kind === 'empty') return;
    const shown = `<strong>${esc(n.answers[0])}</strong>`;
    if (r.kind === 'ok' || r.kind === 'almost' || r.kind === 'en') {
      const pts = r.kind === 'en' ? 0.5 : Q.hint ? 0.5 : 1;
      Q.score += pts; Q.streak = r.kind === 'en' ? 0 : Q.streak + 1;
      if (r.kind === 'ok') { G.sfx[Q.streak >= 3 ? 'great' : 'good'](); msg.innerHTML = `<span class="ok">Alhamdulillah – correct!</span> ${shown}${r.note ? ` <span class="muted">· ${esc(r.note)}</span>` : ''}`; }
      else if (r.kind === 'almost') { G.sfx.good(); msg.innerHTML = `<span class="almost">SubhanAllah – almost! Check the spelling:</span> ${shown}`; }
      else { G.sfx.good(); msg.innerHTML = `<span class="almost">Right structure – now say it in Latin:</span> ${shown} <span class="muted">(half a point)</span>`; }
      if (Q.streak && Q.streak % 5 === 0) G.float($('#pxHud'), `🔥 ${Q.streak} in a row`);
      settle(n, true, v, r.kind);
    } else {
      Q.tries++;
      G.sfx.bad();
      Q.streak = 0;
      if (Q.tries < 2) {
        msg.innerHTML = `<span class="bad">Astaghfirullah – not quite.</span> ${r.other ? `“${esc(r.other.answers[0])}” is somewhere else in the schematic. ` : ''}Look again at where it comes from – one more try.`;
        $('#pxInput').select();
        hud();
        return;
      }
      msg.innerHTML = `<span class="bad">Astaghfirullah – it is</span> ${shown}`;
      settle(n, false, v, 'bad');
    }
  }
  function settle(n, good, typed, kind) {
    n._answered = true;
    Q.log.push({ id: n.id, good, kind, typed });
    if (!good) Q.missed.push(n.id);
    reveal(n, good);
    selected = n.id; paint(); showInfo(n);
    $('#pxInput').disabled = true;
    $('#pxForm').hidden = true;
    $('#pxNext').hidden = false;
    $('#pxNext').focus({ preventScroll: true });
    Q.i++;
    hud();
  }
  function giveHint() {
    const n = Q.cur;
    if (!n || n._answered) return;
    Q.hint++;
    const a = n.answers[0];
    const msg = $('#pxMsg');
    if (Q.hint === 1) msg.innerHTML = `💡 It is ${LEVEL_WORD[n.level]}${n.level === 'ramus' ? ` of the ${n.of === 'radix' ? 'roots' : n.of === 'truncus' ? 'Truncus superior' : esc(byId[n.parents[0]].name)}` : ''} · root values <strong>${esc(n.rootText)}</strong>${n.muscles && n.muscles.length ? ` · supplies <strong>${esc(n.muscles[0])}</strong>` : ''}. (A correct answer now gives half a point.)`;
    else msg.innerHTML = `💡 Starts with: <strong>${esc(a.slice(0, Math.ceil(a.length / 2)))}…</strong>`;
  }
  function showAnswer() {
    const n = Q.cur;
    if (!n || n._answered) return;
    Q.streak = 0; G.sfx.bad();
    $('#pxMsg').innerHTML = `It is <strong>${esc(n.answers[0])}</strong> – it will come back in “Practise my mistakes”.`;
    settle(n, false, '', 'shown');
  }
  function finish() {
    Q.done = true;
    if (Q.cur) unhide(Q.cur);
    Q.cur = null; selected = null; paint(); showInfo(null);
    $('#pxPlay').hidden = true;
    root.classList.remove('px-playing');
    const total = Q.queue.length;
    const ratio = total ? Q.score / total : 0;
    const stars = G.stars(ratio);
    const id = `plexus-${P.slug}-${Q.level}`;
    const res = G.saveBest(id, { score: Q.score, stars });
    ratio >= 0.9 ? (G.sfx.win(), G.confetti()) : G.sfx.good();
    const end = $('#pxEnd');
    end.hidden = false;
    end.innerHTML = `
      <div class="px-end-top"><div class="stars" id="pxStars"></div>
        <h2>${ratio >= 0.9 ? 'MashaAllah – excellent!' : ratio >= 0.6 ? 'Good work – keep going!' : 'Every round makes it stick.'}</h2>
        <p class="lede">You scored <strong>${Q.score % 1 ? Q.score.toFixed(1) : Q.score} / ${total}</strong>${res.better && !res.first ? ' – a new best!' : res.prev ? ` · best ${res.prev.score}` : ''}.</p></div>
      ${Q.log.length ? `<ul class="px-review">${Q.log.map((l) => { const n = byId[l.id]; return `<li class="${l.good ? 'good' : 'bad'}"><button type="button" class="px-link" data-go="${n.id}">${esc(n.answers[0])}</button>${!l.good && l.typed ? ` <span class="muted">you wrote “${esc(l.typed)}”</span>` : l.kind === 'almost' ? ' <span class="muted">spelling</span>' : l.kind === 'en' ? ' <span class="muted">English</span>' : ''}</li>`; }).join('')}</ul>` : ''}
      <div class="btns">
        <button type="button" class="btn primary" data-again>Play again</button>
        ${Q.missed.length ? `<button type="button" class="btn" data-mistakes>Practise my mistakes (${Q.missed.length})</button>` : ''}
        <button type="button" class="btn" data-explore>Explore the schematic</button>
      </div>`;
    G.paintStars(end.querySelector('#pxStars'), stars);
    const missed = [...new Set(Q.missed)];
    end.querySelector('[data-again]').onclick = () => startQuiz(Q.level);
    const mb = end.querySelector('[data-mistakes]'); if (mb) mb.onclick = () => startQuiz(Q.level, missed);
    end.querySelector('[data-explore]').onclick = () => setMode('explore');
    paintBest();
  }
  function paintBest() {
    const all = G.load();
    root.querySelectorAll('[data-best-level]').forEach((e) => {
      const b = all[`plexus-${P.slug}-${e.dataset.bestLevel}`];
      e.textContent = b ? `${'★'.repeat(b.stars || 0)}${'☆'.repeat(3 - (b.stars || 0))} best ${b.score}` : '';
    });
  }

  // ---------- modes ----------
  function setMode(m) {
    mode = m;
    root.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
    $('#pxLevels').hidden = m !== 'quiz';
    $('#pxRoots').hidden = m === 'quiz';
    if (Q.cur) { unhide(Q.cur); Q.cur = null; }
    $('#pxPlay').hidden = true; $('#pxEnd').hidden = true;
    root.classList.remove('px-playing');
    selected = null; rootHl = null; paint(); showInfo(null);
    if (m === 'quiz') $('#pxPrompt2').hidden = false; else $('#pxPrompt2').hidden = true;
  }

  // ---------- wiring ----------
  function load(slug) {
    P = ALL.find((p) => p.slug === slug) || ALL[0];
    byId = Object.fromEntries(P.structures.map((s) => [s.id, s]));
    $('#pxTitle').textContent = P.title;
    $('#pxIntro').textContent = P.intro;
    $('#pxLegend').innerHTML = Object.entries(P.levels).filter(([, v]) => v.color).map(([, v]) => `<span><i style="background:${v.color}"></i>${esc(v.label)}</span>`).join('') +
      `<span><i class="dash"></i>Divisio posterior → extensor side</span><span><i class="thin"></i>Thin line = collateral branch, coloured by where it leaves</span>`;
    $('#pxRoots').innerHTML = `<span>Show the fibres of:</span>` + P.structures.filter((s) => s.level === 'radix').map((s) => `<button type="button" data-root="${s.id}" aria-pressed="false" style="--c:${colorOf(s)}">${s.short}</button>`).join('') + `<button type="button" data-root="" class="clear">Clear</button>`;
    draw();
    paint(); showInfo(null); paintBest();
  }
  root.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (go) { if (mode === 'quiz' && Q.cur && !Q.cur._answered) return; select(go.dataset.go, { scroll: true }); return; }
    const rb = e.target.closest('[data-root]');
    if (rb) { selected = null; rootHl = rb.dataset.root && rootHl !== rb.dataset.root ? rb.dataset.root : null; paint(); showInfo(rootHl ? byId[rootHl] : null); return; }
    const t = e.target.closest('.px-hit, .px-lbl, .px-root');
    if (t && svg.contains(t)) {
      const id = t.dataset.id;
      if (mode === 'quiz' && Q.cur && !Q.cur._answered) {
        if (id === Q.cur.id) return;
        // peeking at other structures is allowed – it is how you reason
        selected = id; paint(); showInfo(byId[id]);
        return;
      }
      select(selected === id ? null : id);
      return;
    }
    if (e.target.closest('.px-board') && mode === 'explore') select(null);
  });
  root.addEventListener('keydown', (e) => {
    const t = e.target.closest('.px-lbl, .px-root');
    if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); t.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
  });
  root.addEventListener('mouseover', (e) => {
    const t = e.target.closest('.px-hit, .px-lbl, .px-root');
    P.structures.forEach((n) => n._g.classList.toggle('hover', !!t && n.id === t.dataset.id));
  });
  root.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  root.querySelectorAll('[data-level]').forEach((b) => b.addEventListener('click', () => startQuiz(Number(b.dataset.level))));
  $('#pxForm').addEventListener('submit', answer);
  $('#pxHint').addEventListener('click', giveHint);
  $('#pxShow').addEventListener('click', showAnswer);
  $('#pxNext').addEventListener('click', next);
  $('#pxQuit').addEventListener('click', () => setMode('quiz'));
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !$('#pxNext').hidden && e.target.tagName !== 'BUTTON') { e.preventDefault(); next(); } });
  if ($('#pxSound')) G.sound($('#pxSound'));
  root.querySelectorAll('[data-plexus]').forEach((b) => b.addEventListener('click', () => { if (!b.disabled) load(b.dataset.plexus); }));
  const params = new URLSearchParams(location.search);
  load(params.get('plexus') || ALL[0].slug);
  setMode(params.get('mode') === 'quiz' ? 'quiz' : 'explore');
})();
