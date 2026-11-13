// Name it! – read the clue, spell the term. Hearts, streak, combo, stars. No timer.
(function () {
  const G = window.MAGame;
  const dataEl = document.getElementById('gameDecks');
  if (!G || !dataEl) return;
  const decks = JSON.parse(dataEl.textContent);
  const $ = (id) => document.getElementById(id);
  const LIVES = 3;
  const MAX_MISTAKES = 5;

  let deck, mode, queue, idx, item, target, lives, score, streak, bestStreak, perfect, results, mistakes, hints, locked;

  const answers = (it) => [it.answer, ...(it.also || [])].map(G.norm);

  function start(id) {
    deck = decks.find((d) => d.id === id);
    if (!deck) return;
    mode = document.querySelector('input[name="nimode"]:checked').value;
    queue = G.shuffle(deck.items);
    idx = 0; lives = LIVES; score = 0; streak = 0; bestStreak = 0; perfect = 0; results = [];
    $('niPick').hidden = true; $('niEnd').hidden = true; $('niPlay').hidden = false;
    document.body.classList.add('g-playing');
    $('niDeckName').textContent = `${deck.title} · ${mode === 'test' ? 'Challenge' : 'Practise'}`;
    history.replaceState(null, '', '#' + deck.id);
    paintHud();
    next();
  }

  function next() {
    if (idx >= queue.length || lives <= 0) return finish();
    item = queue[idx];
    target = G.norm(item.answer);
    mistakes = 0; hints = 0; locked = false;
    $('niClue').textContent = item.clue;
    $('niInput').value = '';
    $('niMsg').textContent = '';
    $('niCard').classList.remove('done', 'fail');
    $('niCard').classList.add('enter');
    setTimeout(() => $('niCard').classList.remove('enter'), 300);
    paintTiles('');
    paintHud();
    $('niInput').focus();
  }

  // Compare typed text against the best-matching accepted answer
  function match(v) {
    const n = G.norm(v).slice(0, 80);
    let best = { ans: target, ok: 0 };
    for (const a of answers(item)) {
      let k = 0;
      while (k < n.length && k < a.length && n[k] === a[k]) k++;
      if (k > best.ok) best = { ans: a, ok: k };
    }
    if (best.ok === 0) best.ans = target;
    return { ...best, n, done: answers(item).includes(n) };
  }

  function paintTiles(v, reveal = false) {
    const m = match(v);
    const t = reveal ? target : m.ans;
    let html = '<span class="word">';
    for (let k = 0; k < t.length; k++) {
      const want = t[k];
      if (want === ' ') { html += '</span><span class="word">'; continue; }
      const typed = reveal ? undefined : m.n[k];
      let cls = 'tile';
      let ch = '';
      if (reveal) { cls += ' reveal'; ch = want; }
      else if (typed !== undefined && k < m.ok) { cls += ' ok'; ch = want; }
      else if (typed !== undefined) { cls += ' bad'; ch = typed === ' ' ? '·' : typed; }
      else if (k < hints) { cls += ' hint'; ch = want; }
      else if (mode === 'learn') { cls += ' ghost'; ch = want; }
      if (!reveal && k === m.n.length) cls += ' cur';
      html += `<span class="${cls}">${G.esc(ch)}</span>`;
    }
    html += '</span>';
    // extra wrong letters beyond the word
    if (!reveal && m.n.length > t.length) html += `<span class="word">${[...m.n.slice(t.length)].map((c) => `<span class="tile bad">${G.esc(c)}</span>`).join('')}</span>`;
    $('niTiles').innerHTML = html;
    return m;
  }

  function onInput(e) {
    if (locked) return;
    const v = $('niInput').value;
    const m = paintTiles(v);
    const inserting = e && e.inputType && e.inputType.startsWith('insert');
    if (inserting) {
      if (m.ok < m.n.length) {
        mistakes++;
        G.sfx.bad();
        const tiles = $('niTiles');
        tiles.classList.remove('shake'); void tiles.offsetWidth; tiles.classList.add('shake');
        if (mistakes >= MAX_MISTAKES) return giveUp(true);
      } else G.sfx.key();
    }
    if (m.done) solved();
  }

  function solved() {
    locked = true;
    const clean = mistakes === 0 && hints === 0;
    let gain;
    if (clean) {
      streak++; perfect++;
      bestStreak = Math.max(bestStreak, streak);
      const combo = streak >= 6 ? 3 : streak >= 3 ? 2 : 1;
      gain = 10 * combo;
      G.float($('niFloat'), `+${gain}${combo > 1 ? ' ×' + combo : ''}`, 'good');
      (combo > 1 ? G.sfx.great : G.sfx.good)();
      $('niMsg').textContent = streak >= 3 ? `🔥 ${streak} in a row!` : 'Perfect!';
    } else {
      streak = 0;
      gain = 5;
      G.float($('niFloat'), `+${gain}`, '');
      G.sfx.good();
      $('niMsg').textContent = hints ? 'Correct – with help.' : 'Correct – watch the spelling next time.';
    }
    score += gain;
    results.push({ item, state: clean ? 'perfect' : 'ok' });
    paintTiles(item.answer, true);
    $('niCard').classList.add('done');
    paintHud();
    idx++;
    setTimeout(next, clean ? 650 : 1100);
  }

  function giveUp(auto) {
    if (locked) return;
    locked = true;
    lives--; streak = 0;
    results.push({ item, state: 'miss' });
    G.sfx.lose();
    $('niMsg').innerHTML = `${auto ? 'Too many wrong letters. ' : ''}It is <b>${G.esc(item.answer)}</b>. ${lives > 0 ? '−1 ❤' : ''}`;
    paintTiles('', true);
    $('niCard').classList.add('fail');
    paintHud(true);
    idx++;
    setTimeout(next, 2000);
  }

  function hint() {
    if (locked) return;
    const m = match($('niInput').value);
    if (m.ok >= m.ans.length) return;
    hints = Math.max(hints, m.ok + 1);
    $('niInput').value = m.ans.slice(0, m.ok + 1);
    G.sfx.key();
    onInput(null);
    $('niInput').focus();
  }

  function paintHud(hurt) {
    $('niHearts').innerHTML = Array.from({ length: LIVES }, (_, i) => `<span class="heart${i < lives ? '' : ' lost'}${hurt && i === lives ? ' hurt' : ''}">❤</span>`).join('');
    $('niScore').textContent = score;
    $('niStreak').textContent = streak >= 2 ? `🔥 ${streak}` : '';
    $('niStreak').classList.toggle('hot', streak >= 3);
    $('niDots').innerHTML = queue.map((_, i) => {
      const r = results[i];
      return `<i class="${r ? r.state : i === idx ? 'now' : ''}"></i>`;
    }).join('');
  }

  function finish() {
    const done = results.length;
    const gameOver = lives <= 0 && done < queue.length;
    const stars = gameOver ? 0 : G.stars(perfect / queue.length);
    const { better, first } = G.saveBest(deck.id + (mode === 'test' ? ':test' : ''), { score, stars });
    if (mode === 'test') G.saveBest(deck.id, { score, stars });
    $('niPlay').hidden = true; $('niEnd').hidden = false;
    G.paintStars($('niStars'), stars);
    $('niEndTitle').textContent = gameOver ? 'Out of hearts – try again!' : stars === 3 ? 'Brilliant!' : stars === 2 ? 'Well done!' : 'Round finished';
    $('niEndStats').innerHTML = [
      [score, 'points' + (better && !first ? ' · new best!' : '')],
      [`${perfect}/${queue.length}`, 'perfect'],
      [bestStreak, 'best streak'],
      [`${'❤'.repeat(Math.max(lives, 0))}${'♡'.repeat(LIVES - Math.max(lives, 0))}`, 'hearts left'],
    ].map(([b, s]) => `<div><b>${b}</b><span>${s}</span></div>`).join('');
    const review = results.filter((r) => r.state !== 'perfect');
    const rest = queue.slice(done);
    $('niReview').innerHTML = review.length || rest.length
      ? `<h3>Practise these</h3><ul class="review">${review.map((r) => `<li class="${r.state}"><span>${G.esc(r.item.clue)}</span><b>${G.esc(r.item.answer)}</b></li>`).join('')}${rest.map((it) => `<li class="miss"><span>${G.esc(it.clue)}</span><b>${G.esc(it.answer)}</b></li>`).join('')}</ul>`
      : '<p class="empty">No mistakes at all. Try Challenge mode next!</p>';
    if (stars === 3) { G.sfx.win(); G.confetti(); } else if (gameOver) G.sfx.lose(); else G.sfx.good();
    $('niAgain').focus();
  }

  function back() {
    $('niPlay').hidden = true; $('niEnd').hidden = true; $('niPick').hidden = false;
    document.body.classList.remove('g-playing');
    history.replaceState(null, '', location.pathname);
    G.paintBest();
  }

  document.querySelectorAll('[data-deck]').forEach((b) => b.addEventListener('click', () => start(b.dataset.deck)));
  $('niInput').addEventListener('input', onInput);
  $('niInput').addEventListener('keydown', (e) => {
    if (e.key === 'Tab') { e.preventDefault(); hint(); }
    else if (e.key === 'Escape') { e.preventDefault(); giveUp(false); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (!locked && !match($('niInput').value).done) { $('niMsg').textContent = 'Not yet – keep typing, or press Tab for a hint.'; G.sfx.bad(); }
    }
  });
  $('niHint').addEventListener('click', hint);
  $('niGive').addEventListener('click', () => giveUp(false));
  $('niQuit').addEventListener('click', back);
  $('niBack').addEventListener('click', back);
  $('niAgain').addEventListener('click', () => start(deck.id));
  $('niTiles').addEventListener('click', () => $('niInput').focus());
  G.sound($('niSound'));
  G.paintBest();
  const h = location.hash.slice(1);
  if (h && decks.some((d) => d.id === h)) start(h);
})();
