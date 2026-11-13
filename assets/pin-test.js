// Pin test – clip-test practice on pinned plates.
// Modes: type, choose, find, study. A "mixed clip test" draws random pins from every plate of a region.
(function () {
  const G = window.MAGame;
  const dataEl = document.getElementById('ptPlates');
  if (!G || !dataEl) return;
  const plates = JSON.parse(dataEl.textContent);
  const BASE = window.PT_BASE || '/';
  const $ = (id) => document.getElementById(id);
  const EXAM_SIZE = 20;
  const MODE_NAMES = { type: 'Clip test', choose: 'Choose', find: 'Find it', study: 'Study' };

  let run, mode, qs, idx, q, score, streak, bestStreak, results, waiting, shownPlate;

  const answers = (pin) => [pin.answer, ...(pin.also || [])].map(G.norm);
  const title = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const pinOf = (x) => plates[x.p].pins[x.i];

  function begin(r) {
    run = r;
    mode = document.querySelector('input[name="ptmode"]:checked').value;
    if (run.exam && mode === 'study') mode = 'type';
    idx = 0; score = 0; streak = 0; bestStreak = 0; results = []; shownPlate = -1;
    $('ptPick').hidden = true; $('ptEnd').hidden = true; $('ptPlay').hidden = false;
    document.body.classList.add('g-playing');
    $('ptTitle').textContent = `${run.title} · ${MODE_NAMES[mode]}`;
    $('ptPlay').dataset.mode = mode;
    history.replaceState(null, '', '#' + run.id);
    if (mode === 'study') return studyMode(run.plates[0]);
    const all = run.plates.flatMap((p) => plates[p].pins.map((_, i) => ({ p, i })));
    qs = G.shuffle(all).slice(0, run.exam ? EXAM_SIZE : all.length);
    next();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function startPlate(id) {
    const p = plates.findIndex((x) => x.id === id);
    if (p >= 0) begin({ id, title: plates[p].title, plates: [p] });
  }
  function startExam(region) {
    const ps = plates.map((x, n) => (x.region === region ? n : -1)).filter((n) => n >= 0);
    if (ps.length) begin({ id: 'exam:' + region, title: `Mixed clip test · ${region}`, plates: ps, exam: true });
  }

  function showPlate(p) {
    if (shownPlate === p) return;
    shownPlate = p;
    $('ptImg').src = `${BASE}games/plates/${plates[p].image}`;
    $('ptImg').alt = plates[p].title;
    $('ptCredit').textContent = plates[p].credit || '';
  }

  function pinEl(p, i, cls, label) {
    const pin = plates[p].pins[i];
    return `<button type="button" class="pin ${cls}" data-i="${i}" style="left:${pin.x}%;top:${pin.y}%" aria-label="Pin"><span>${label != null ? G.esc(label) : ''}</span></button>`;
  }

  function paintDots() {
    $('ptDots').innerHTML = qs.map((_, n) => `<i class="${results[n] ? results[n].state : n === idx ? 'now' : ''}"></i>`).join('');
    $('ptScore').textContent = score;
    $('ptStreak').textContent = streak >= 2 ? `🔥 ${streak}` : '';
    $('ptStreak').classList.toggle('hot', streak >= 3);
  }

  function kind(p) { return { muscles: 'muscle', nerves: 'nerve', vessels: 'vessel' }[plates[p].category] || 'structure'; }

  function next() {
    if (idx >= qs.length) return finish();
    q = qs[idx];
    const pin = pinOf(q);
    waiting = false;
    showPlate(q.p);
    $('ptFeedback').innerHTML = '';
    $('ptFeedback').className = 'pt-feedback';
    $('ptNext').hidden = true;
    $('ptForm').hidden = mode !== 'type';
    $('ptOptions').hidden = mode !== 'choose';
    $('ptOptions').innerHTML = '';
    const where = run.exam ? `<small class="pt-where">${G.esc(plates[q.p].title)}</small>` : '';
    if (mode === 'find') {
      $('ptQ').innerHTML = `<span class="pt-ask">Find ${idx + 1} of ${qs.length}</span><strong>${G.esc(title(pin.answer))}</strong><small>Click the right pin on the plate.</small>${where}`;
      $('ptPins').innerHTML = plates[q.p].pins.map((_, i) => pinEl(q.p, i, 'dot')).join('');
    } else {
      $('ptQ').innerHTML = `<span class="pt-ask">Pin ${idx + 1} of ${qs.length}</span><strong>What is this structure?</strong><small>Name the ${kind(q.p)} under the pin.</small>${where}`;
      $('ptPins').innerHTML = pinEl(q.p, q.i, 'active', '');
      const el = $('ptPins').querySelector('.pin.active');
      if (el && window.innerWidth < 900) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    if (mode === 'type') { $('ptInput').value = ''; $('ptInput').disabled = false; $('ptInput').focus({ preventScroll: true }); }
    if (mode === 'choose') {
      const same = plates[q.p].pins.map((x) => x.answer);
      const cat = plates.filter((x) => x.category === plates[q.p].category && x.region === plates[q.p].region).flatMap((x) => x.pins.map((y) => y.answer));
      const pool = [...new Set([...G.shuffle(same), ...G.shuffle(cat)])].filter((a) => a !== pin.answer);
      const opts = G.shuffle([pin.answer, ...pool.slice(0, 3)]);
      $('ptOptions').innerHTML = opts.map((o, k) => `<button type="button" class="opt" data-a="${G.esc(o)}"><kbd>${k + 1}</kbd>${G.esc(title(o))}</button>`).join('');
    }
    paintDots();
  }

  function label(i, cls) {
    const el = $('ptPins').querySelector(`.pin[data-i="${i}"]`);
    if (el) { el.classList.add(cls); el.querySelector('span').textContent = title(plates[q.p].pins[i].answer); }
  }

  function judge(state, typed) {
    waiting = true;
    const pin = pinOf(q);
    let gain = 0;
    if (state === 'perfect') { streak++; bestStreak = Math.max(bestStreak, streak); gain = 10 * (streak >= 6 ? 3 : streak >= 3 ? 2 : 1); }
    else if (state === 'ok') { streak = 0; gain = 5; }
    else streak = 0;
    score += gain;
    results.push({ q, state, typed });
    const fb = $('ptFeedback');
    fb.className = 'pt-feedback ' + state;
    const name = `<b>${G.esc(title(pin.answer))}</b>`;
    if (state === 'perfect') { fb.innerHTML = `✓ Correct – ${name} <span class="combo">+${gain}${gain > 10 ? ' ×' + gain / 10 : ''}</span>`; (gain > 10 ? G.sfx.great : G.sfx.good)(); }
    else if (state === 'ok') { fb.innerHTML = `≈ Almost – check the spelling: ${name} <span class="combo">+5</span>`; G.sfx.good(); }
    else { fb.innerHTML = `✗ ${typed ? `Not “${G.esc(typed)}”. ` : ''}This is ${name}`; G.sfx.bad(); }
    if (pin.note) fb.innerHTML += `<small class="pt-note">${G.esc(pin.note)}</small>`;
    if (state === 'miss') { const st = $('ptStage'); st.classList.remove('shake'); void st.offsetWidth; st.classList.add('shake'); }
    label(q.i, state === 'miss' ? 'wrong' : 'right');
    if (mode === 'type') $('ptInput').disabled = true;
    $('ptNext').hidden = false;
    paintDots();
    const at = idx;
    if (state === 'perfect') setTimeout(() => { if (waiting && idx === at) advance(); }, 1100);
    else $('ptNext').focus({ preventScroll: true });
  }

  function advance() { if (!waiting) return; idx++; next(); }

  function checkTyped(v) {
    const n = G.norm(v);
    if (!n) return;
    const acc = answers(pinOf(q));
    if (acc.includes(n)) return judge('perfect', v);
    const close = acc.some((a) => a.length >= 5 && G.dist(n, a) <= (a.length >= 10 ? 2 : 1));
    judge(close ? 'ok' : 'miss', v);
  }

  function studyMode(p) {
    showPlate(p);
    q = { p, i: -1 };
    $('ptForm').hidden = true; $('ptOptions').hidden = true; $('ptNext').hidden = true;
    $('ptFeedback').innerHTML = '';
    $('ptQ').innerHTML = `<span class="pt-ask">Study</span><strong>Tap a pin to see its name.</strong><small>Say the name out loud first, then check.</small><div class="pt-btns"><button type="button" class="btn" id="ptShowAll">Show all names</button></div>`;
    $('ptPins').innerHTML = plates[p].pins.map((_, i) => pinEl(p, i, 'dot study', String(i + 1))).join('');
    $('ptDots').innerHTML = ''; $('ptScore').textContent = ''; $('ptStreak').textContent = '';
    $('ptShowAll').addEventListener('click', (e) => {
      const on = e.target.dataset.on !== '1';
      e.target.dataset.on = on ? '1' : '';
      e.target.textContent = on ? 'Hide names' : 'Show all names';
      plates[p].pins.forEach((pin, i) => { const el = $('ptPins').querySelector(`.pin[data-i="${i}"]`); el.classList.toggle('open', on); el.querySelector('span').textContent = on ? title(pin.answer) : String(i + 1); });
    });
  }

  function finish() {
    const perfect = results.filter((r) => r.state === 'perfect').length;
    const ok = results.filter((r) => r.state === 'ok').length;
    const stars = G.stars((perfect + ok * 0.5) / qs.length);
    const { better, first } = G.saveBest(run.id, { score, stars });
    $('ptPlay').hidden = true; $('ptEnd').hidden = false;
    G.paintStars($('ptStars'), stars);
    const pct = Math.round(100 * (perfect + ok) / qs.length);
    $('ptEndTitle').textContent = stars === 3 ? 'Ready for the clip test!' : stars === 2 ? 'Good – a few more rounds.' : 'Keep practising!';
    $('ptEndStats').innerHTML = [
      [`${pct}%`, 'named correctly'], [score, 'points' + (better && !first ? ' · new best!' : '')], [bestStreak, 'best streak'], [`${qs.length - perfect - ok}`, 'missed'],
    ].map(([b, s]) => `<div><b>${b}</b><span>${s}</span></div>`).join('');
    const wrong = results.filter((r) => r.state !== 'perfect');
    $('ptReview').innerHTML = wrong.length
      ? `<h3>Review these</h3><ul class="review">${wrong.map((r) => `<li class="${r.state}"><span>${r.typed ? 'You: ' + G.esc(r.typed) : 'No answer'}${run.exam ? ' · ' + G.esc(plates[r.q.p].title) : ''}</span><b>${G.esc(title(pinOf(r.q).answer))}</b></li>`).join('')}</ul>`
      : '<p class="empty">Every pin correct. Try another mode or the next plate!</p>';
    if (stars === 3) { G.sfx.win(); G.confetti(); } else G.sfx.good();
    $('ptAgain').focus();
  }

  function back() {
    $('ptPlay').hidden = true; $('ptEnd').hidden = true; $('ptPick').hidden = false;
    document.body.classList.remove('g-playing');
    history.replaceState(null, '', location.pathname);
    G.paintBest();
  }

  // ---- category tabs ----
  function paintCat() {
    const el = document.querySelector('input[name="ptcat"]:checked');
    if (!el) return;
    document.querySelectorAll('[data-cat-group]').forEach((g) => { g.hidden = g.dataset.catGroup !== el.value; });
    try { localStorage.setItem('mumen-anatomy-ptcat', el.value); } catch {}
  }
  try { const c = localStorage.getItem('mumen-anatomy-ptcat'); const el = c && document.querySelector(`input[name="ptcat"][value="${c}"]`); if (el) el.checked = true; } catch {}
  document.querySelectorAll('input[name="ptcat"]').forEach((r) => r.addEventListener('change', paintCat));
  paintCat();

  // ---- events ----
  document.querySelectorAll('[data-plate]').forEach((b) => b.addEventListener('click', () => startPlate(b.dataset.plate)));
  document.querySelectorAll('[data-exam]').forEach((b) => b.addEventListener('click', () => startExam(b.dataset.exam)));
  $('ptForm').addEventListener('submit', (e) => { e.preventDefault(); if (waiting) return advance(); checkTyped($('ptInput').value); });
  $('ptDunno').addEventListener('click', () => { if (!waiting) judge('miss', ''); });
  $('ptNext').addEventListener('click', advance);
  $('ptOptions').addEventListener('click', (e) => {
    const b = e.target.closest('.opt');
    if (!b || waiting) return;
    const ans = pinOf(q).answer;
    const right = b.dataset.a === ans;
    $('ptOptions').querySelectorAll('.opt').forEach((o) => { o.disabled = true; if (o.dataset.a === ans) o.classList.add('right'); });
    if (!right) b.classList.add('wrong');
    judge(right ? 'perfect' : 'miss', right ? '' : title(b.dataset.a));
  });
  $('ptPins').addEventListener('click', (e) => {
    const b = e.target.closest('.pin');
    if (!b) return;
    const i = +b.dataset.i;
    if (mode === 'study') {
      const open = b.classList.toggle('open');
      b.querySelector('span').textContent = open ? title(plates[q.p].pins[i].answer) : String(i + 1);
      if (open) G.sfx.key();
      return;
    }
    if (mode !== 'find' || waiting) return;
    if (i === q.i) judge('perfect', '');
    else { b.classList.add('wrong-pick'); label(q.i, 'target'); judge('miss', title(plates[q.p].pins[i].answer)); }
  });
  document.addEventListener('keydown', (e) => {
    if ($('ptPlay').hidden) return;
    if (mode === 'choose' && !waiting && /^[1-4]$/.test(e.key)) { const o = $('ptOptions').querySelectorAll('.opt')[+e.key - 1]; if (o) o.click(); }
    else if (waiting && e.key === 'Enter' && document.activeElement !== $('ptInput')) { e.preventDefault(); advance(); }
    else if (e.key === 'Escape') back();
  });
  $('ptQuit').addEventListener('click', back);
  $('ptBack').addEventListener('click', back);
  $('ptAgain').addEventListener('click', () => begin(run));
  G.sound($('ptSound'));
  G.paintBest();
  const h = decodeURIComponent(location.hash.slice(1));
  if (h.startsWith('exam:')) startExam(h.slice(5));
  else if (h && plates.some((p) => p.id === h)) startPlate(h);
})();
