// Password box for the locked games (owner password; "remember on this device").
(function () {
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const ub64 = (a) => btoa(String.fromCharCode(...new Uint8Array(a)));
  const ls = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} }, del: (k) => { try { localStorage.removeItem(k); } catch (e) {} } };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  if (!document.getElementById('g_css')) { const st = document.createElement('style'); st.id = 'g_css';
    st.textContent = '.g-in{width:100%;padding:12px;border-radius:12px;border:1px solid var(--line);background:var(--card2,#2a2420);color:inherit;font:inherit;text-align:center}.hidden{display:none!important}';
    document.head.appendChild(st); }
  window.MumenGate = {
    mount({ el, title, storeKey, onKey, masterDerive }) {
      el.innerHTML = `
        <div style="font-size:42px">🔒</div><h2 style="color:var(--gold);margin:6px 0">${esc(title)}</h2>
        <p class="m">Private area of Mumen Anatomy.</p>
        <form id="g_f" style="display:grid;gap:8px;margin-top:10px">
          <input type="password" id="g_pw" placeholder="Password" autocomplete="current-password" class="g-in">
          <label class="m"><input type="checkbox" id="g_rem" checked> Remember on this device</label>
          <button class="btn gold" style="width:100%">Unlock</button>
        </form>
        <div class="err" id="g_err" style="min-height:22px;margin-top:6px"></div>`;
      const $ = (id) => el.querySelector('#' + id);
      $('g_f').onsubmit = async (e) => { e.preventDefault(); $('g_err').textContent = 'Checking…';
        try { const k = await masterDerive($('g_pw').value); await onKey(k);
          if ($('g_rem').checked) ls.set(storeKey, ub64(await crypto.subtle.exportKey('raw', k)));
          $('g_err').textContent = ''; } catch (_) { $('g_err').textContent = 'Wrong password.'; } };
      (async () => { const s = ls.get(storeKey); if (!s) return;
        try { await onKey(await crypto.subtle.importKey('raw', b64(s), { name: 'AES-GCM' }, true, ['decrypt'])); } catch (_) { ls.del(storeKey); } })();
      return { lock() { ls.del(storeKey); location.reload(); } };
    },
  };
})();
