// Mumen Anatomy – speed typing game. Read the clue, type the term.
(function () {
  const dataEl = document.getElementById('gameDecks');
  if (!dataEl) return;
  const decks = JSON.parse(dataEl.textContent);
  const KEY = 'mumen-anatomy-games';
  const $ = (id) => document.getElementById(id);
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} };
  const norm = (s) => s.toLowerCase().replace(/[–—-]/g, ' ').replace(/\s+/g, ' ').replace(/^ /, '');
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (ms) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

  let deck, mode, order, i, st, item, typedOk, hints, timer, mistakeHere;

  function paintBest() {
    const best = load();
    document.querySelectorAll('[data-best]').forEach((el) => {
      const b = best[el.dataset.best];
      el.textContent = b ? `best ${b.wpm} wpm · ${b.acc}%` : 'no score yet';
    });
  }

  function start(id) {
    deck = decks.find((d) => d.id === id);
    if (!deck) return;
    mode = document.querySelector('input[name="mode"]:checked').value;
    order = deck.items.map((_, k) => k).sort(() => Math.random() - 0.5);
    i = 0;
    st = { t0: 0, chars: 0, keys: 0, good: 0, missed: [] };
    $('gamePick').hidden = true; $('gameEnd').hidden = true; $('gamePlay').hidden = false;
    $('gameTitle').textContent = deck.title + (mode === 'test' ? ' · Test' : ' · Practise');
    history.replaceState(null, '', '#' + deck.id);
    clearInterval(timer);
    $('gWpm').textContent = '0'; $('gAcc').textContent = '100'; $('gTime').textContent = '0:00';
    timer = setInterval(tick, 250);
    next();
  }

  function answers(it) { return [it.answer, ...(it.also || [])].map(norm); }

  function next() {
    if (i >= order.length) return finish();
    item = deck.items[order[i]];
    hints = 0; mistakeHere = false; typedOk = '';
    $('gClue').textContent = item.clue;
    $('gInput').value = '';
    $('gMsg').textContent = '';
    $('gCount').textContent = `${i}/${order.length}`;
    $('gMeter').style.width = (100 * i / order.length) + '%';
    paintWord('');
    $('gInput').focus();
  }

  // Longest correct prefix against any accepted answer
  function match(v) {
    const n = norm(v);
    let best = { ans: norm(item.answer), ok: 0 };
    for (const a of answers(item)) {
      let k = 0;
      while (k < n.length && k < a.length && n[k] === a[k]) k++;
      if (k > best.ok || (k === best.ok && a.startsWith(n))) best = { ans: a, ok: k };
    }
    return { ...best, n, done: answers(item).includes(n) };
  }

  function paintWord(v) {
    const m = match(v);
    const target = m.ans;
    let html = '';
    for (let k = 0; k < Math.max(target.length, m.n.length); k++) {
      const typed = m.n[k];
      const want = target[k];
      if (typed !== undefined) {
        const good = k < m.ok;
        html += `<span class="${good ? 'ok' : 'bad'}">${esc(good ? want : typed === ' ' ? '·' : typed)}</span>`;
      } else if (k < target.length) {
        const shown = mode === 'learn' || k < hints;
        html += `<span class="todo">${shown ? esc(want) : want === ' ' ? '&nbsp;' : '_'}</span>`;
      }
    }
    if (m.n.length === 0) html += '';
    $('gWord').innerHTML = `<span class="caret-wrap">${html}</span>`;
    return m;
  }

  function onInput(e) {
    if (!st.t0) st.t0 = Date.now();
    const v = $('gInput').value;
    const m = paintWord(v);
    if (e.inputType && e.inputType.startsWith('insert')) {
      st.keys++;
      if (m.ok === m.n.length) { st.good++; } else if (!mistakeHere) { mistakeHere = true; }
    }
    if (m.ok === m.n.length) mistakeHere = false;
    typedOk = m.n.slice(0, m.ok);
    if (m.done) {
      st.chars += m.n.length + 1;
      $('gWord').classList.add('flash');
      setTimeout(() => $('gWord').classList.remove('flash'), 250);
      i++;
      setTimeout(next, 120);
    }
  }

  function hint() {
    const m = match($('gInput').value);
    $('gInput').value = m.ans.slice(0, m.ok + 1);
    hints = m.ok + 1;
    st.keys++; // counts as a miss
    if (!st.t0) st.t0 = Date.now();
    onInput({ inputType: '' });
    $('gInput').focus();
  }

  function skip() {
    st.missed.push(item);
    st.keys += 3;
    $('gMsg').innerHTML = `Answer: <b>${esc(item.answer)}</b>`;
    $('gInput').value = '';
    hints = 999;
    paintWord('');
    i++;
    setTimeout(next, 1400);
  }

  function tick() {
    if (!st || !st.t0) return;
    const ms = Date.now() - st.t0;
    $('gTime').textContent = fmt(ms);
    $('gWpm').textContent = Math.round((st.chars / 5) / Math.max(ms / 60000, 1 / 60));
    $('gAcc').textContent = st.keys ? Math.round(100 * st.good / st.keys) : 100;
  }

  function finish() {
    clearInterval(timer);
    tick();
    const ms = st.t0 ? Date.now() - st.t0 : 0;
    const wpm = Math.round((st.chars / 5) / Math.max(ms / 60000, 1 / 60));
    const acc = st.keys ? Math.round(100 * st.good / st.keys) : 100;
    const right = order.length - st.missed.length;
    const best = load();
    const prev = best[deck.id];
    let isBest = false;
    if (mode === 'test' || !prev) {
      if (!prev || right / order.length > (prev.right || 0) / order.length || (right >= (prev.right || 0) && wpm > prev.wpm)) {
        best[deck.id] = { wpm, acc, right, of: order.length, date: new Date().toISOString().slice(0, 10) };
        save(best); isBest = !!prev;
      }
    }
    $('gamePlay').hidden = true; $('gameEnd').hidden = false;
    $('gEndTitle').textContent = isBest ? 'New best score!' : right === order.length ? 'All correct – well done!' : 'Round finished';
    $('gEndStats').innerHTML = `<div><b>${right}/${order.length}</b><span>correct</span></div><div><b>${wpm}</b><span>wpm</span></div><div><b>${acc}%</b><span>accuracy</span></div><div><b>${fmt(ms)}</b><span>time</span></div>`;
    $('gEndMissed').innerHTML = st.missed.length
      ? `<h3>Review these</h3><ul class="game-missed">${st.missed.map((it) => `<li><span>${esc(it.clue)}</span> <b>${esc(it.answer)}</b></li>`).join('')}</ul>`
      : '';
    $('gAgain').focus();
    paintBest();
  }

  function back() {
    clearInterval(timer);
    $('gamePlay').hidden = true; $('gameEnd').hidden = true; $('gamePick').hidden = false;
    history.replaceState(null, '', location.pathname);
    paintBest();
  }

  document.querySelectorAll('[data-deck]').forEach((b) => b.addEventListener('click', () => start(b.dataset.deck)));
  $('gInput').addEventListener('input', onInput);
  $('gInput').addEventListener('keydown', (e) => {
    if (e.key === 'Tab') { e.preventDefault(); hint(); }
    else if (e.key === 'Escape') { e.preventDefault(); skip(); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (!match($('gInput').value).done) { $('gMsg').textContent = 'Not quite – keep typing, or press Tab for a hint.'; st.keys++; }
    }
  });
  $('gHint').addEventListener('click', hint);
  $('gSkip').addEventListener('click', skip);
  $('gameQuit').addEventListener('click', back);
  $('gBack').addEventListener('click', back);
  $('gAgain').addEventListener('click', () => start(deck.id));
  $('gWord').addEventListener('click', () => $('gInput').focus());

  paintBest();
  const fromHash = location.hash.slice(1);
  if (fromHash && decks.some((d) => d.id === fromHash)) start(fromHash);
})();
