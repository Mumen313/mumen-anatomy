// Shared helpers for Mumen Anatomy games: sound, saved scores, confetti, text matching.
(function () {
  const KEY = 'mumen-anatomy-games';
  const SKEY = 'mumen-anatomy-sound';
  let ctx;
  let soundOn = true;
  try { soundOn = localStorage.getItem(SKEY) !== 'off'; } catch {}

  function tone(freq, dur, type = 'sine', vol = 0.06, when = 0) {
    if (!soundOn) return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      const t = ctx.currentTime + when;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t); o.stop(t + dur);
    } catch {}
  }

  const G = {
    sfx: {
      key() { tone(660, 0.04, 'triangle', 0.025); },
      good() { tone(660, 0.09, 'triangle'); tone(990, 0.14, 'triangle', 0.06, 0.08); },
      great() { [660, 830, 990, 1320].forEach((f, i) => tone(f, 0.12, 'triangle', 0.06, i * 0.07)); },
      bad() { tone(180, 0.18, 'sawtooth', 0.035); },
      lose() { tone(300, 0.15, 'square', 0.04); tone(200, 0.25, 'square', 0.04, 0.14); },
      win() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.18, 'triangle', 0.06, i * 0.1)); },
    },
    sound(btn) {
      const paint = () => { btn.textContent = soundOn ? '🔊' : '🔇'; btn.setAttribute('aria-pressed', String(soundOn)); };
      paint();
      btn.addEventListener('click', () => {
        soundOn = !soundOn;
        try { localStorage.setItem(SKEY, soundOn ? 'on' : 'off'); } catch {}
        paint();
        if (soundOn) G.sfx.good();
      });
    },
    load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } },
    saveBest(id, rec) {
      const all = G.load();
      const prev = all[id];
      const better = !prev || rec.score > prev.score;
      if (better) { all[id] = { ...rec, date: new Date().toISOString().slice(0, 10) }; try { localStorage.setItem(KEY, JSON.stringify(all)); } catch {} }
      return { better, first: !prev, prev };
    },
    paintBest(root = document) {
      const all = G.load();
      root.querySelectorAll('[data-best]').forEach((el) => {
        const b = all[el.dataset.best];
        el.textContent = b ? ` · ${'★'.repeat(b.stars || 0)}${'☆'.repeat(3 - (b.stars || 0))} best ${b.score}` : '';
      });
    },
    norm(s) {
      return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[–—\-_.,()']/g, ' ').replace(/\b(musculus|muscle|muscles|mm?)\b/g, ' ')
        .replace(/\s+/g, ' ').trim();
    },
    dist(a, b) {
      const m = a.length, n = b.length;
      const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
      for (let j = 1; j <= n; j++) d[0][j] = j;
      for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      return d[m][n];
    },
    shuffle(a) { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; },
    stars(ratio) { return ratio >= 0.9 ? 3 : ratio >= 0.6 ? 2 : ratio > 0 ? 1 : 0; },
    paintStars(el, n) {
      el.innerHTML = [1, 2, 3].map((i) => `<span class="star${i <= n ? ' on' : ''}" style="--d:${i * 0.18}s">★</span>`).join('');
    },
    confetti() {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const box = document.createElement('div');
      box.className = 'confetti';
      const colors = ['#e0b100', '#b3261e', '#2f6f9f', '#2e8b57', '#f2c94c'];
      for (let i = 0; i < 70; i++) {
        const s = document.createElement('i');
        s.style.left = Math.random() * 100 + '%';
        s.style.background = colors[i % colors.length];
        s.style.animationDelay = Math.random() * 0.6 + 's';
        s.style.animationDuration = 1.6 + Math.random() * 1.4 + 's';
        s.style.transform = `rotate(${Math.random() * 360}deg)`;
        box.appendChild(s);
      }
      document.body.appendChild(box);
      setTimeout(() => box.remove(), 3600);
    },
    float(el, text, cls = '') {
      const f = document.createElement('span');
      f.className = 'floater ' + cls;
      f.textContent = text;
      el.appendChild(f);
      setTimeout(() => f.remove(), 1100);
    },
    esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); },
  };
  window.MAGame = G;
})();
