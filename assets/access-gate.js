// Login box for the locked games: personal email + password (checked by the Google Sheet doorman),
// "Request access", remember-me with a re-check on every visit. Owner can still unlock with the master password (no email).
(function () {
  const URL_ = () => window.MUMEN_ACCESS_URL || '';
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const ub64 = (a) => btoa(String.fromCharCode(...new Uint8Array(a)));
  const dev = () => { const ua = navigator.userAgent; const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'other';
    const br = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : 'browser'; return os + ' · ' + br; };
  async function call(body) {
    const r = await fetch(URL_(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...body, device: dev() }) });
    return r.json();
  }
  const ls = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} }, del: (k) => { try { localStorage.removeItem(k); } catch (e) {} } };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  window.MumenGate = {
    mount({ el, game, title, storeKey, onKey, masterDerive }) {
      const S = { key: storeKey, mail: storeKey + 'Email' };
      el.innerHTML = `
        <div style="font-size:42px">🔒</div><h2 style="color:var(--gold);margin:6px 0">${esc(title)}</h2>
        <p class="m">Private study area of Mumen Anatomy. Log in with your email and your personal password.</p>
        <form id="g_f" style="display:grid;gap:8px;margin-top:10px">
          <input type="email" id="g_em" placeholder="Your email" autocomplete="email" class="g-in">
          <input type="password" id="g_pw" placeholder="Password" autocomplete="current-password" class="g-in">
          <label class="m" style="text-align:left"><input type="checkbox" id="g_rem" checked> Remember on this device</label>
          <button class="btn gold" id="g_go" style="width:100%">Unlock</button>
        </form>
        <div class="err" id="g_err" style="min-height:22px;margin-top:6px"></div>
        <p class="m"><a href="#" id="g_rq">No password yet? Request access</a></p>
        <form id="g_rf" class="hidden" style="display:grid;gap:8px;margin-top:6px;text-align:left">
          <input id="g_rn" placeholder="Full name" autocomplete="name" class="g-in">
          <input type="email" id="g_re" placeholder="Email" autocomplete="email" class="g-in">
          <input id="g_rnote" placeholder="Who are you? (e.g. MU Varna, 2nd year)" class="g-in">
          <button class="btn" id="g_rs">Send request</button>
          <div class="m" id="g_rmsg"></div>
        </form>
        <p class="m" style="margin-top:12px;font-size:13px">Logins are recorded (email, time, device).</p>`;
      const $ = (id) => el.querySelector('#' + id);
      if (!document.getElementById('g_css')) { const st = document.createElement('style'); st.id = 'g_css'; st.textContent = '.g-in{width:100%;padding:12px;border-radius:12px;border:1px solid var(--line);background:var(--card2,#2a2420);color:inherit;font:inherit}.hidden{display:none!important}'; document.head.appendChild(st); }
      const saved = ls.get(S.mail); if (saved) $('g_em').value = saved;
      $('g_f').onsubmit = async (e) => {
        e.preventDefault(); const em = $('g_em').value.trim().toLowerCase(), pw = $('g_pw').value;
        $('g_err').textContent = 'Checking…'; $('g_go').disabled = true;
        try {
          let key;
          if (em && URL_()) {
            const r = await call({ action: 'login', game, email: em, password: pw });
            if (!r.ok) throw new Error(r.error || 'Login failed.');
            key = await crypto.subtle.importKey('raw', b64(r.key), { name: 'AES-GCM' }, true, ['decrypt']);
          } else if (!em) {
            key = await masterDerive(pw); // owner password
          } else throw new Error('Personal logins are not switched on yet.');
          await onKey(key);
          if ($('g_rem').checked) { ls.set(S.key, ub64(await crypto.subtle.exportKey('raw', key))); if (em) ls.set(S.mail, em); else ls.del(S.mail); }
          $('g_err').textContent = '';
        } catch (err) { $('g_err').textContent = err && err.message && err.message !== 'bad' && !/operation|decrypt/i.test(err.message) ? err.message : 'Wrong email or password.'; }
        $('g_go').disabled = false;
      };
      $('g_rq').onclick = (e) => { e.preventDefault(); $('g_rf').classList.toggle('hidden'); $('g_re').value = $('g_em').value; };
      $('g_rf').onsubmit = async (e) => {
        e.preventDefault(); if (!URL_()) { $('g_rmsg').textContent = 'Requests are not switched on yet – please contact Mumen.'; return; }
        $('g_rmsg').textContent = 'Sending…';
        try { const r = await call({ action: 'request', email: $('g_re').value.trim().toLowerCase(), name: $('g_rn').value.trim(), note: $('g_rnote').value.trim() });
          $('g_rmsg').textContent = r.ok ? r.message : r.error; } catch (_) { $('g_rmsg').textContent = 'Could not send – try again later.'; }
      };
      // remembered device: open, then re-check with the doorman
      (async () => {
        const s = ls.get(S.key); if (!s) return;
        try { await onKey(await crypto.subtle.importKey('raw', b64(s), { name: 'AES-GCM' }, true, ['decrypt'])); } catch (_) { ls.del(S.key); return; }
        const em = ls.get(S.mail);
        if (em && URL_()) { try { const r = await call({ action: 'open', game, email: em }); if (r && r.blocked) { ls.del(S.key); ls.del(S.mail); location.reload(); } } catch (_) {} }
      })();
      return { lock() { ls.del(S.key); location.reload(); } };
    },
  };
})();
