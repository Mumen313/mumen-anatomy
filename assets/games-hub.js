// Games hub: show how many decks/plates the visitor has already played.
(function () {
  let all = {};
  try { all = JSON.parse(localStorage.getItem('mumen-anatomy-games')) || {}; } catch {}
  document.querySelectorAll('[data-hub-ids]').forEach((el) => {
    const ids = el.dataset.hubIds.split(',').filter(Boolean);
    const played = ids.filter((id) => all[id]);
    if (!played.length) return;
    const stars = played.reduce((n, id) => n + (all[id].stars || 0), 0);
    el.textContent = ` · ${played.length}/${ids.length} played · ${stars}★`;
  });
})();
