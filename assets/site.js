// Small enhancements: "show all answers", table-of-contents highlight, interactive plexus diagram.
(function () {
  // Show / hide all answers in any section with several toggles (exam questions).
  document.querySelectorAll('.topic article > section').forEach((sec) => {
    const ds = sec.querySelectorAll(':scope > details.toggle');
    if (ds.length < 2) return;
    const bar = document.createElement('div');
    bar.className = 'qa-tools';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn';
    btn.textContent = 'Show all answers';
    btn.addEventListener('click', () => {
      const open = ![...ds].every((d) => d.open);
      ds.forEach((d) => (d.open = open));
      btn.textContent = open ? 'Hide all answers' : 'Show all answers';
    });
    bar.appendChild(btn);
    ds[0].before(bar);
  });

  // Highlight the current section in the table of contents.
  const links = [...document.querySelectorAll('.toc a')];
  if (links.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) links.forEach((a) => a.classList.toggle('here', a.getAttribute('href') === '#' + e.target.id));
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    document.querySelectorAll('.topic article > section').forEach((s) => io.observe(s));
  }

  // Interactive brachial plexus diagram (only on pages that include it).
  const svg = document.getElementById('plexus');
  if (!svg) return;
  const NS = 'http://www.w3.org/2000/svg';
  const cols = { R: 70, T: 250, D: 430, C: 610, B: 800 };
  const nodes = {
    C5: ['R', 60, 'C5'], C6: ['R', 125, 'C6'], C7: ['R', 190, 'C7'], C8: ['R', 255, 'C8'], T1: ['R', 320, 'T1'],
    TS: ['T', 92, 'Superior'], TM: ['T', 190, 'Middle'], TI: ['T', 288, 'Inferior'],
    SA: ['D', 50, 'Ant.'], SP: ['D', 110, 'Post.'], MA: ['D', 170, 'Ant.'], MP: ['D', 230, 'Post.'], IA: ['D', 290, 'Ant.'], IP: ['D', 350, 'Post.'],
    CL: ['C', 90, 'Lateral'], CP: ['C', 200, 'Posterior'], CM: ['C', 310, 'Medial'],
    Bmc: ['B', 50, 'Musculocut.'], Bax: ['B', 120, 'Axillary'], Bra: ['B', 190, 'Radial'], Bme: ['B', 260, 'Median'], Bul: ['B', 330, 'Ulnar'],
  };
  const edges = [['C5', 'TS'], ['C6', 'TS'], ['C7', 'TM'], ['C8', 'TI'], ['T1', 'TI'],
    ['TS', 'SA'], ['TS', 'SP', 1], ['TM', 'MA'], ['TM', 'MP', 1], ['TI', 'IA'], ['TI', 'IP', 1],
    ['SA', 'CL'], ['MA', 'CL'], ['SP', 'CP', 1], ['MP', 'CP', 1], ['IP', 'CP', 1], ['IA', 'CM'],
    ['CL', 'Bmc'], ['CL', 'Bme'], ['CM', 'Bme'], ['CM', 'Bul'], ['CP', 'Bax', 1], ['CP', 'Bra', 1]];
  const mk = (t, a) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); return e; };
  [['R', 'ROOTS'], ['T', 'TRUNKS'], ['D', 'DIVISIONS'], ['C', 'CORDS'], ['B', 'BRANCHES']].forEach(([c, l]) => {
    const t = mk('text', { x: cols[c], y: 22, 'text-anchor': 'middle', class: 'col' }); t.textContent = l; svg.appendChild(t);
  });
  const W = { R: 56, T: 92, D: 64, C: 96, B: 112 }, H = 30;
  const edgeEls = edges.map(([a, b, p]) => {
    const A = nodes[a], B = nodes[b];
    const x1 = cols[A[0]] + W[A[0]] / 2, y1 = A[1], x2 = cols[B[0]] - W[B[0]] / 2, y2 = B[1], mx = (x1 + x2) / 2;
    const path = mk('path', { d: `M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`, class: 'edge' + (p ? ' post' : '') });
    path.dataset.a = a; path.dataset.b = b; svg.appendChild(path); return path;
  });
  const nodeEls = {};
  Object.entries(nodes).forEach(([id, [c, y, label]]) => {
    const g = mk('g', { class: 'node', tabindex: 0, role: 'button', 'aria-label': 'Trace ' + label });
    g.appendChild(mk('rect', { x: cols[c] - W[c] / 2, y: y - H / 2, width: W[c], height: H, rx: 6 }));
    const t = mk('text', { x: cols[c], y: y + 4.5, 'text-anchor': 'middle' }); t.textContent = label; g.appendChild(t);
    g.addEventListener('click', () => trace(id));
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); trace(id); } });
    svg.appendChild(g); nodeEls[id] = g;
  });
  function reach(start, down) {
    const seen = new Set([start]), stack = [start];
    while (stack.length) {
      const n = stack.pop();
      edges.forEach(([a, b]) => { const f = down ? a : b, t = down ? b : a; if (f === n && !seen.has(t)) { seen.add(t); stack.push(t); } });
    }
    return seen;
  }
  const buttons = [...document.querySelectorAll('[data-root]')];
  function trace(id) {
    buttons.forEach((b) => b.setAttribute('aria-pressed', b.dataset.root === id ? 'true' : 'false'));
    if (!id) { svg.classList.remove('lit'); return; }
    const down = reach(id, true), up = reach(id, false), on = new Set([...down, ...up]);
    svg.classList.add('lit');
    Object.entries(nodeEls).forEach(([k, g]) => g.classList.toggle('on', on.has(k)));
    edgeEls.forEach((p) => { const a = p.dataset.a, b = p.dataset.b; p.classList.toggle('on', (down.has(a) && down.has(b)) || (up.has(a) && up.has(b))); });
  }
  buttons.forEach((b) => b.addEventListener('click', () => trace(b.dataset.root === 'clear' ? null : b.dataset.root)));
})();

// ---- Visitor tracker: "How well do you know this?" (saved only in this browser) ----
(function () {
  const STORE = 'mumen-anatomy-feelings';
  const FEEL = { bad: ['😟', 'Bad'], unsure: ['😕', 'Unsure'], ok: ['😐', 'OK'], good: ['🙂', 'Good'], strong: ['💪', 'Strong'] };
  const ORDER = ['bad', 'unsure', 'ok', 'good', 'strong'];
  const load = () => { try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { return {}; } };
  const save = (d) => { try { localStorage.setItem(STORE, JSON.stringify(d)); return true; } catch { return false; } };
  let data = load();

  function paint() {
    document.querySelectorAll('.feel').forEach((w) => {
      const cur = data[w.dataset.key]?.v;
      w.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === cur)));
    });
    document.querySelectorAll('[data-key] .feel-badge').forEach((el) => {
      const v = data[el.closest('[data-key]').dataset.key]?.v;
      el.textContent = v ? FEEL[v][0] : '';
      el.title = v ? FEEL[v][1] : '';
    });
  }
  document.querySelectorAll('.feel').forEach((w) => {
    w.querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', () => {
        const key = w.dataset.key;
        if (data[key]?.v === b.dataset.v) delete data[key];
        else data[key] = { v: b.dataset.v, name: w.dataset.name, at: new Date().toISOString().slice(0, 10) };
        if (!save(data)) w.querySelector('.feel-note').textContent = 'Your browser does not allow saving here.';
        paint();
      })
    );
  });
  paint();

  // My progress page
  const list = document.getElementById('progressList');
  const all = document.getElementById('allTopics');
  if (!list || !all) return;
  const topics = JSON.parse(all.textContent);
  function render() {
    data = load();
    const rated = topics.filter((t) => data[t.key]);
    document.getElementById('progressEmpty').hidden = rated.length > 0;
    document.getElementById('progressSummary').innerHTML = rated.length
      ? ORDER.map((v) => `<span class="sum sum-${v}"><b>${rated.filter((t) => data[t.key].v === v).length}</b> ${FEEL[v][0]} ${FEEL[v][1]}</span>`).join('') +
        `<span class="sum"><b>${topics.length - rated.length}</b> not rated yet</span>`
      : '';
    list.innerHTML = ORDER.map((v) => {
      const items = rated.filter((t) => data[t.key].v === v);
      if (!items.length) return '';
      return `<section class="progress-group"><h2>${FEEL[v][0]} ${FEEL[v][1]}</h2>${items
        .map((t) => `<a class="topic-row" href="${t.href}"><span><span class="t">${t.name.replace(/</g, '&lt;')}</span><span class="s">${t.group}</span></span><span class="m">rated ${data[t.key].at || ''}</span></a>`)
        .join('')}</section>`;
    }).join('');
  }
  document.getElementById('progressReset').addEventListener('click', () => {
    data = {};
    save(data);
    render();
  });
  render();
})();
