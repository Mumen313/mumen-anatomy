// Pin test – clip-test practice on pinned plates. Modes: type, choose, find, study.
(function () {
  const G = window.MAGame;
  const dataEl = document.getElementById('ptPlates');
  if (!G || !dataEl) return;
  const plates = JSON.parse(dataEl.textContent);
  const BASE = window.PT_BASE || '/';
  const $ = (id) => document.getElementById(id);

  let plate, mode, order, idx, pin, score, streak, bestStreak, results, waiting, studySeen;

  const answers = (p) => [p.answer, ...(p.also || [])].map(G.norm);
  const title = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

  function start(id) {
    plate = plates.find((p) => p.id === id);
    if (!plate) return;
    mode = document.querySelector('input[name="ptmode"]:checked').value;
    order = G.shuffle(plate.pins.map((_, i) => i));
    idx = 0; score = 0; streak = 0; bestStreak = 0; results = []; studySeen = new Set();
    $('ptPick').hidden = true; $('ptEnd').hidden = true; $('ptPlay').hidden = false;
    document.body.classList.add('g-playing');
    $('ptTitle').textContent = `${plate.title} · ${{ type: 'Clip test', choose: 'Choose', find: 'Find it', study: 'Study' }[mode]}`;
    $('ptImg').src = `${BASE}games/plates/${plate.image}`;
    $('ptImg').alt = plate.title;
    $('ptCredit').textContent = plate.credit || '';
    $('ptPlay').dataset.mode = mode;
    history.replaceState(null, '', '#' + plate.id);
    if (mode === 'study') return studyMode();
    next();
  }

  function pinEl(i, cls, label) {
    const p = plate.pins[i];
    return `<button type="button" class="pin ${cls}" data-i="${i}" style="left:${p.x}%;top:${p.y}%" aria-label="${label || 'Pin ' + (i + 1)}"><span>${label != null ? G.esc(label) : ''}</span></button>`;
  }

  function paintDots() {
    $('ptDots').innerHTML = order.map((_, i) => `<i class="${results[i] ? results[i].state : i === idx ? 'now' : ''}"></i>`).join('');
    $('ptScore').textContent = score;
    $('ptStreak').textContent = streak >= 2 ? `🔥 ${streak}` : '';
    $('ptStreak').classList.toggle('hot', streak >= 3);
  }

  function next() {
    if (idx >= order.length) return finish();
    pin = plate.pins[order[idx]];
    waiting = false;
    $('ptFeedback').innerHTML = '';
    $('ptFeedback').className = 'pt-feedback';
    $('ptNext').hidden = true;
    $('ptForm').hidden = mode !== 'type';
    $('ptOptions').hidden = mode !== 'choose';
    $('ptOptions').innerHTML = '';
    if (mode === 'find') {
      $('ptQ').innerHTML = `<span class="pt-ask">Find</span><strong>${G.esc(title(pin.answer))}</strong><small>Click the right pin on the plate.</small>`;
      $('ptPins').innerHTML = plate.pins.map((_, i) => pinEl(i, 'dot')).join('');
    } else {
      $('ptQ').innerHTML = `<span class="pt-ask">Pin ${idx + 1} of ${order.length}</span><strong>What is this structure?</strong><small>Name the muscle under the pin.</small>`;
      $('ptPins').innerHTML = pinEl(order[idx], 'active', '');
      focusPin();
    }
    if (mode === 'type') { $('ptInput').value = ''; $('ptInput').disabled = false; $('ptInput').focus({ preventScroll: true }); }
    if (mode === 'choose') {
      const others = G.shuffle([...new Set(plate.pins.map((p) => p.answer).filter((a) => a !== pin.answer))]).slice(0, 3);
      const opts = G.shuffle([pin.answer, ...others]);
      $('ptOptions').innerHTML = opts.map((o, k) => `<button type="button" class="opt" data-a="${G.esc(o)}"><kbd>${k + 1}</kbd>${G.esc(title(o))}</button>`).join('');
    }
    paintDots();
  }

  function focusPin() {
    const el = $('ptPins').querySelector('.pin.active');
    if (el && window.innerWidth < 900) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function label(i, cls) {
    const p = plate.pins[i];
    const el = $('ptPins').querySelector(`.pin[data-i="${i}"]`);
    if (el) { el.classList.add(cls); el.querySelector('span').textContent = title(p.answer); }
  }

  function judge(state, typed) {
    waiting = true;
    const i = order[idx];
    let gain = 0;
    if (state === 'perfect') { streak++; bestStreak = Math.max(bestStreak, streak); gain = 10 * (streak >= 6 ? 3 : streak >= 3 ? 2 : 1); }
    else if (state === 'ok') { streak = 0; gain = 5; }
    else streak = 0;
    score += gain;
    results.push({ i, state, typed });
    const fb = $('ptFeedback');
    fb.className = 'pt-feedback ' + state;
    const name = `<b>${G.esc(title(pin.answer))}</b>`;
    if (state === 'perfect') { fb.innerHTML = `✓ Correct – ${name}${gain > 10 ? ` <span class="combo">+${gain} ×${gain / 10}</span>` : ` <span class="combo">+${gain}</span>`}`; (gain > 10 ? G.sfx.great : G.sfx.good)(); }
    else if (state === 'ok') { fb.innerHTML = `≈ Almost – check the spelling: ${name} <span class="combo">+5</span>`; G.sfx.good(); }
    else { fb.innerHTML = `✗ ${typed ? `Not “${G.esc(typed)}”. ` : ''}This is ${name}`; G.sfx.bad(); }
    if (pin.note) fb.innerHTML += `<small class="pt-note">${G.esc(pin.note)}</small>`;
    if (state !== 'perfect') { const st = $('ptStage'); st.classList.remove('shake'); void st.offsetWidth; if (state === 'miss') st.classList.add('shake'); }
    label(i, state === 'miss' ? 'wrong' : 'right');
    if (mode === 'type') $('ptInput').disabled = true;
    $('ptNext').hidden = false;
    paintDots();
    if (state === 'perfect') setTimeout(() => { if (waiting && results.length === idx + 1) advance(); }, 1100);
    else $('ptNext').focus({ preventScroll: true });
  }

  function advance() { if (!waiting) return; idx++; next(); }

  function checkTyped(v) {
    const n = G.norm(v);
    if (!n) return;
    const acc = answers(pin);
    if (acc.includes(n)) return judge('perfect', v);
    const close = acc.some((a) => { const d = G.dist(n, a); return a.length >= 5 && d <= (a.length >= 10 ? 2 : 1); });
    judge(close ? 'ok' : 'miss', v);
  }

  // ---- Study mode: all pins, tap to reveal ----
  function studyMode() {
    $('ptForm').hidden = true; $('ptOptions').hidden = true; $('ptNext').hidden = true;
    $('ptFeedback').innerHTML = '';
    $('ptQ').innerHTML = `<span class="pt-ask">Study</span><strong>Tap a pin to see its name.</strong><small>Say the name out loud first, then check.</small><div class="pt-btns"><button type="button" class="btn" id="ptShowAll">Show all names</button></div>`;
    $('ptPins').innerHTML = plate.pins.map((_, i) => pinEl(i, 'dot study', String(i + 1))).join('');
    $('ptDots').innerHTML = ''; $('ptScore').textContent = ''; $('ptStreak').textContent = '';
    $('ptShowAll').addEventListener('click', (e) => {
      const on = e.target.dataset.on !== '1';
      e.target.dataset.on = on ? '1' : '';
      e.target.textContent = on ? 'Hide names' : 'Show all names';
      plate.pins.forEach((p, i) => { const el = $('ptPins').querySelector(`.pin[data-i="${i}"]`); el.classList.toggle('open', on); el.querySelector('span').textContent = on ? title(p.answer) : String(i + 1); });
    });
  }

  function finish() {
    const perfect = results.filter((r) => r.state === 'perfect').length;
    const ok = results.filter((r) => r.state === 'ok').length;
    const stars = G.stars((perfect + ok * 0.5) / order.length);
    const { better, first } = G.saveBest(plate.id, { score, stars });
    G.saveBest(plate.id + ':' + mode, { score, stars });
    $('ptPlay').hidden = true; $('ptEnd').hidden = false;
    G.paintStars($('ptStars'), stars);
    const pct = Math.round(100 * (perfect + ok) / order.length);
    $('ptEndTitle').textContent = stars === 3 ? 'Ready for the clip test!' : stars === 2 ? 'Good – a few more rounds.' : 'Keep practising!';
    $('ptEndStats').innerHTML = [
      [`${pct}%`, 'named correctly'], [score, 'points' + (better && !first ? ' · new best!' : '')], [bestStreak, 'best streak'], [`${order.length - perfect - ok}`, 'missed'],
    ].map(([b, s]) => `<div><b>${b}</b><span>${s}</span></div>`).join('');
    const wrong = results.filter((r) => r.state !== 'perfect');
    $('ptReview').innerHTML = wrong.length
      ? `<h3>Review these</h3><ul class="review">${wrong.map((r) => `<li class="${r.state}"><span>${r.typed ? 'You: ' + G.esc(r.typed) : 'No answer'}</span><b>${G.esc(title(plate.pins[r.i].answer))}</b></li>`).join('')}</ul>`
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

  // ---- events ----
  document.querySelectorAll('[data-plate]').forEach((b) => b.addEventListener('click', () => start(b.dataset.plate)));
  $('ptForm').addEventListener('submit', (e) => { e.preventDefault(); if (waiting) return advance(); checkTyped($('ptInput').value); });
  $('ptDunno').addEventListener('click', () => { if (!waiting) judge('miss', ''); });
  $('ptNext').addEventListener('click', advance);
  $('ptOptions').addEventListener('click', (e) => {
    const b = e.target.closest('.opt');
    if (!b || waiting) return;
    const right = b.dataset.a === pin.answer;
    $('ptOptions').querySelectorAll('.opt').forEach((o) => { o.disabled = true; if (o.dataset.a === pin.answer) o.classList.add('right'); });
    if (!right) b.classList.add('wrong');
    judge(right ? 'perfect' : 'miss', right ? '' : title(b.dataset.a));
  });
  $('ptPins').addEventListener('click', (e) => {
    const b = e.target.closest('.pin');
    if (!b) return;
    const i = +b.dataset.i;
    if (mode === 'study') {
      const open = b.classList.toggle('open');
      b.querySelector('span').textContent = open ? title(plate.pins[i].answer) : String(i + 1);
      if (open) { studySeen.add(i); G.sfx.key(); }
      return;
    }
    if (mode !== 'find' || waiting) return;
    if (i === order[idx]) { label(i, 'right'); judge('perfect', ''); }
    else { b.classList.add('wrong-pick'); label(order[idx], 'target'); judge('miss', title(plate.pins[i].answer)); }
  });
  document.addEventListener('keydown', (e) => {
    if ($('ptPlay').hidden) return;
    if (mode === 'choose' && !waiting && /^[1-4]$/.test(e.key)) { const o = $('ptOptions').querySelectorAll('.opt')[+e.key - 1]; if (o) o.click(); }
    else if (waiting && e.key === 'Enter' && document.activeElement !== $('ptInput')) { e.preventDefault(); advance(); }
    else if (e.key === 'Escape') back();
  });
  $('ptQuit').addEventListener('click', back);
  $('ptBack').addEventListener('click', back);
  $('ptAgain').addEventListener('click', () => start(plate.id));
  G.sound($('ptSound'));
  G.paintBest();
  const h = location.hash.slice(1);
  if (h && plates.some((p) => p.id === h)) start(h);
})();
