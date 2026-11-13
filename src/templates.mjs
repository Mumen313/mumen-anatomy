import { esc, formatDate, slugify } from './render.mjs';

export const FEELINGS = [
  ['bad', '😟', 'Bad'],
  ['unsure', '😕', 'Unsure'],
  ['ok', '😐', 'OK'],
  ['good', '🙂', 'Good'],
  ['strong', '💪', 'Strong'],
];

function feelWidget(key, name, href) {
  return `<div class="feel" data-key="${esc(key)}" data-name="${esc(name)}" data-href="${esc(href)}">
  <span class="feel-label">How well do you know this?</span>
  <div class="feel-btns" role="group" aria-label="How well do you know this topic?">
    ${FEELINGS.map(([v, e, l]) => `<button type="button" data-v="${v}" aria-pressed="false"><span aria-hidden="true">${e}</span> ${l}</button>`).join('')}
  </div>
  <span class="feel-note">Saved only in this browser · <a href="__BASE__progress/">My progress</a></span>
</div>`;
}

export function layout({ site, title, description, body, active = '', depthBase }) {
  const u = (p = '') => site.base + p;
  const pageTitle = title ? `${title} · ${site.name}` : site.name;
  const nav = [
    ['', 'Anatomy', 'home'],
    ['physiology/', 'Physiology', 'physiology'],
    ['games/', 'Games', 'games'],
    ['progress/', 'My progress', 'progress'],
    ['about/', 'About me', 'about'],
    ['membership/', 'Membership', 'membership'],
  ];
  const brandMark = site.logo
    ? `<img class="logo" src="${esc(site.logo)}" alt="">`
    : `<svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><circle cx="15" cy="15" r="13" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 9 L15 15 L22 9 M15 15 L15 24 M15 19 L10 23 M15 19 L20 23" fill="none" stroke="var(--nerve)" stroke-width="2.2" stroke-linecap="round"/></svg>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(pageTitle)}</title>
<meta name="description" content="${esc(description || site.tagline)}">
${site.googleVerification ? `<meta name="google-site-verification" content="${esc(site.googleVerification)}">\n` : ''}<meta property="og:title" content="${esc(pageTitle)}">
<meta property="og:description" content="${esc(description || site.tagline)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Source+Sans+3:wght@400;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${u('assets/style.css')}">
${site.logo ? `<link rel="icon" href="${esc(site.logo)}">` : ''}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site">
  <div class="wrap">
    <a class="brand" href="${u()}">${brandMark}${esc(site.name)}</a>
    <nav class="main" aria-label="Main">
      ${nav.map(([p, l, k]) => `<a href="${u(p)}"${k === active ? ' aria-current="page"' : ''}>${l}</a>`).join('\n      ')}
    </nav>
  </div>
</header>
<main id="main" class="wrap">
${body.replace(/__BASE__/g, site.base)}
</main>
<footer>
  <div class="wrap"><span>${esc(site.footer)}</span><span>Images are credited with source and license on every figure.</span></div>
</footer>
<script src="${u('assets/site.js')}" defer></script>
</body>
</html>`;
}

export function homePage({ site, regions, topics, phys = [] }) {
  const u = (p = '') => site.base + p;
  const latest = [...topics].sort((a, b) => (b.lastReviewed || '').localeCompare(a.lastReviewed || '')).slice(0, 4);
  const live = topics.length;
  return `
<div class="hero">
  <div>
    <div class="eyebrow">Anatomy from the dissection hall</div>
    <h1>${esc(site.tagline)}</h1>
    <p class="lede">${esc(site.intro)}</p>
    <div class="btns">
      ${latest[0] ? `<a class="btn primary" href="${u(`topics/${latest[0].slug}/`)}">Read: ${esc(latest[0].name)}</a>` : ''}
      <a class="btn" href="${u('about/')}">About me</a>
    </div>
  </div>
  <div class="hero-plate" aria-hidden="true">
    <svg viewBox="0 0 300 170" width="100%"><g fill="none" stroke-linecap="round">
      <path d="M20 30 C80 30 90 60 140 70 C190 80 230 60 280 40" stroke="var(--nerve)" stroke-width="4"/>
      <path d="M20 60 C80 60 100 75 140 80 C190 86 230 90 280 85" stroke="var(--nerve)" stroke-width="4"/>
      <path d="M20 90 C80 90 100 92 140 92 C190 92 230 120 280 130" stroke="var(--nerve)" stroke-width="4"/>
      <path d="M20 120 C70 118 110 100 140 100" stroke="var(--nerve)" stroke-width="4"/>
      <path d="M20 145 C70 140 110 110 140 108 C180 105 230 150 280 160" stroke="var(--nerve)" stroke-width="4"/>
      <path d="M30 160 C110 130 180 110 290 110" stroke="var(--artery)" stroke-width="7" opacity=".85"/>
    </g></svg>
    <p>Nerves in yellow, arteries in red, as in the atlas.</p>
  </div>
</div>

<section class="block" aria-labelledby="h-regions">
  <div class="section-head"><h2 id="h-regions">Anatomy regions</h2><span class="eyebrow">${regions.length} regions · ${live} topic${live === 1 ? '' : 's'} live</span></div>
  <div class="regions">
    ${regions
      .map((r) => {
        const n = topics.filter((t) => t.region === r.name).length;
        return `<a class="region${n ? ' live' : ''}" href="${u(`regions/${r.slug}/`)}">${r.image ? `<span class="region-thumb"><img src="${esc(r.image)}" alt="" width="104" height="120"></span>` : ''}<span class="region-text"><span class="t">${esc(r.name)}</span><span class="d">${esc(r.intro || '')}</span><span class="c">${n ? `${n} topic${n === 1 ? '' : 's'}` : 'Coming soon'}</span></span></a>`;
      })
      .join('\n    ')}
  </div>
</section>

<section class="block" aria-labelledby="h-phys">
  <div class="section-head"><h2 id="h-phys">Physiology</h2><span class="eyebrow">${phys.length} lecture${phys.length === 1 ? '' : 's'} live</span></div>
  <div class="topic-list">${
    phys.length
      ? phys.slice(0, 6).map((l) => `<a class="topic-row" href="${u(`physiology/${l.slug}/`)}"><span><span class="t">${esc(l.name)}</span><span class="s">${esc(l.block)}</span></span><span class="m">Lecture ${l.no ?? ''}</span></a>`).join('')
      : '<p class="empty">Coming soon.</p>'
  }</div>
  ${phys.length ? `<div class="btns"><a class="btn" href="${u('physiology/')}">All physiology lectures</a></div>` : ''}
</section>

<section class="block" aria-labelledby="h-plan">
  <div class="section-head"><h2 id="h-plan">How every topic is built</h2></div>
  <ol class="steps">
    <li><b>Explanation</b><span>Short and clear, in my own words.</span></li>
    <li><b>My video</b><span>I explain the topic myself, step by step.</span></li>
    <li><b>Sources</b><span>TeachMeAnatomy, Kenhub and others, always named.</span></li>
    <li><b>Images</b><span>Diagrams with source and license on every one.</span></li>
    <li><b>Cadaver</b><span>My own dissection photos and what to look for.</span></li>
    <li><b>3D</b><span>Models you can turn in your browser.</span></li>
    <li><b>Clinic</b><span>The injuries and syndromes that make it matter.</span></li>
    <li><b>Exam questions</b><span>The five most important, with answers to reveal.</span></li>
    <li><b>Histology</b><span>The essentials, with at least one image.</span></li>
    <li><b>Takeaways</b><span>Five points for the last two minutes before the exam.</span></li>
  </ol>
</section>`;
}

export function regionPage({ site, region, topics, sectionIntro = {} }) {
  const u = (p = '') => site.base + p;
  const order = [...(region.sections || []), ...[...new Set(topics.map((t) => t.section))].filter((x) => !(region.sections || []).includes(x))];
  const nav = order
    .map((sec) => {
      const n = topics.filter((t) => t.section === sec).length;
      return `<a href="#${slugify(sec)}" class="secnav-item${n ? '' : ' empty'}">${esc(sec)} <span>${n}</span></a>`;
    })
    .join('');
  const groups = order
    .map((sec) => {
      const list = topics.filter((t) => t.section === sec);
      const rows = list.length
        ? list
            .map((t) => `<a class="topic-row" href="${u(`topics/${t.slug}/`)}" data-key="anatomy/${t.slug}"><span><span class="t">${esc(t.name)}</span>${t.summary ? `<span class="s">${esc(t.summary)}</span>` : ''}</span><span class="m"><span class="feel-badge"></span> ${t.priority ? `${esc(t.priority)} exam priority` : ''}</span></a>`)
            .join('\n')
        : `<p class="empty sec-empty">Coming soon.</p>`;
      return `<section class="region-section" id="${slugify(sec)}">
  <div class="section-head"><h2>${esc(sec)}</h2><span class="eyebrow">${list.length} topic${list.length === 1 ? '' : 's'}</span></div>
  ${sectionIntro[sec] ? `<p class="sec-intro">${esc(sectionIntro[sec])}</p>` : ''}
  <div class="topic-list">${rows}</div>
</section>`;
    })
    .join('\n');
  return `
<div class="crumbs"><a href="${u()}">Anatomy</a> / ${esc(region.name)}</div>
<div class="region-hero">
  ${region.image ? `<figure class="region-img"><img src="${esc(region.imageLarge || region.image)}" alt="${esc(region.name)} – anatomical illustration"><figcaption>${esc(region.imageCredit || '')}</figcaption></figure>` : ''}
  <div>
    <h1>${esc(region.name)}</h1>
    ${region.intro ? `<p class="lede">${esc(region.intro)}</p>` : ''}
    <nav class="secnav" aria-label="Sections of ${esc(region.name)}">${nav}</nav>
  </div>
</div>
${groups}`;
}

export function topicPage({ site, topic, crumbs, chips, sections, intro = '', feelKey }) {
  const u = (p = '') => site.base + p;
  const toc = sections.map((s, i) => `<li><a href="#${s.id}">${i + 1} · ${esc(s.title)}</a></li>`).join('');
  const body = sections
    .map(
      (s, i) => `
      <section id="${s.id}">
        <span class="num">${String(i + 1).padStart(2, '0')}</span>
        <h2>${esc(s.title)}</h2>
        ${s.html}
      </section>`
    )
    .join('');
  const href = feelKey.startsWith('physiology/') ? `physiology/${topic.slug}/` : `topics/${topic.slug}/`;
  return `
<div class="crumbs">${crumbs.map((c) => `<a href="${u(c.href)}">${esc(c.label)}</a>`).join(' / ')} / ${esc(topic.name)}</div>
<h1>${esc(topic.name)}</h1>
<div class="chips">
  ${chips.filter(Boolean).map((c, i) => `<span class="chip${i === 0 && /★/.test(c) ? ' prio' : ''}">${esc(c)}</span>`).join('\n  ')}
</div>
${intro ? `<div class="topic-intro">${intro}</div>` : ''}
${feelWidget(feelKey, topic.name, href)}
<div class="topic">
  <nav class="toc" aria-label="On this page"><span class="eyebrow">On this page</span><ol>${toc}</ol></nav>
  <article>${body}
  </article>
</div>
${feelWidget(feelKey, topic.name, href).replace('class="feel"', 'class="feel feel-end"')}`;
}

export function physiologyIndexPage({ site, lectures }) {
  const u = (p = '') => site.base + p;
  const blocks = [...new Set(lectures.map((l) => l.block))];
  const groups = blocks
    .map(
      (b) => `<section class="block" id="${slugify(b)}">
  <div class="section-head"><h2>${esc(b)}</h2><span class="eyebrow">${lectures.filter((l) => l.block === b).length} lecture(s)</span></div>
  <div class="topic-list">${lectures
    .filter((l) => l.block === b)
    .map((l) => `<a class="topic-row" href="${u(`physiology/${l.slug}/`)}" data-key="physiology/${l.slug}"><span><span class="t">${esc(l.name)}</span><span class="s">Lecture ${l.no ?? ''}</span></span><span class="m feel-badge"></span></a>`)
    .join('\n')}</div>
</section>`
    )
    .join('\n');
  return `
<div class="eyebrow">Physiology</div>
<h1>Physiology, one mechanism at a time.</h1>
<p class="lede">Every lecture is told as a cause-and-effect story, with an everyday comparison, takeaways, the questions examiners ask and flashcards to test yourself.</p>
${groups || '<p class="empty">The first lectures are being prepared.</p>'}`;
}

export function progressPage({ site, allTopics }) {
  return `
<div class="eyebrow">My progress</div>
<h1>How well do you know each topic?</h1>
<p class="lede">Rate any topic with the buttons on its page. Your ratings are saved only in this browser, so nobody else sees them.</p>
<div class="progress-summary" id="progressSummary" aria-live="polite"></div>
<div id="progressList" class="progress-list"></div>
<p class="empty" id="progressEmpty">You have not rated any topic yet. Open a topic and choose how well you know it.</p>
<div class="btns"><button type="button" class="btn" id="progressReset">Clear my ratings</button></div>
<script type="application/json" id="allTopics">${JSON.stringify(allTopics.map((t) => ({ ...t, href: site.base + t.href }))).replace(/</g, '\\u003c')}</script>`;
}

export function aboutPage({ site, html }) {
  return `
<div class="eyebrow">About</div>
<h1>About me</h1>
<div class="prose">${html || '<p class="empty">This page is being written.</p>'}</div>`;
}

export function membershipPage({ site }) {
  return `
<div class="eyebrow">Membership</div>
<h1>Free to learn, more for members.</h1>
<p class="lede">Membership is in preparation. Here is the plan for what will be free and what members will get.</p>
<div class="plans">
  <div class="plan">
    <h3>Free</h3>
    <ul><li>Explanation and diagrams for every topic</li><li>Sources and 3D model links</li><li>Key takeaways</li></ul>
  </div>
  <div class="plan member">
    <h3>Member <span class="tag">Coming soon</span></h3>
    <ul><li>All my video explanations</li><li>Full cadaver photo gallery with labels</li><li>All five exam questions with answers</li><li>Printable one-page summaries</li></ul>
  </div>
</div>`;
}

export function notFoundPage({ site }) {
  return `<h1>Page not found</h1><p class="lede">This page does not exist (yet). <a href="${site.base}">Go to all regions</a>.</p>`;
}


const GAME_ICONS = {
  'name-it': `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="6" y="22" width="12" height="16" rx="3"/><rect x="21" y="22" width="12" height="16" rx="3"/><rect x="36" y="22" width="12" height="16" rx="3" class="hl"/><rect x="51" y="22" width="8" height="16" rx="3" class="dim"/><path d="M10 46h44" class="ln"/></svg>`,
  'pin-test': `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M14 52c-4-14 2-34 18-38 14-3 22 8 20 20-1 9-8 12-8 18" class="ln"/><circle cx="26" cy="28" r="5" class="hl"/><circle cx="40" cy="38" r="4"/><circle cx="22" cy="44" r="4"/></svg>`,
};

function gameShellTop(title, eyebrow, lede) {
  return `<div class="g-head"><a class="g-back" href="__BASE__games/">‹ All games</a><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p class="lede">${lede}</p></div>`;
}

export function gamesHubPage({ site, decks, plates }) {
  const terms = decks.reduce((n, d) => n + d.items.length, 0);
  const pins = plates.reduce((n, p) => n + p.pins.length, 0);
  const card = (id, title, text, meta, tag, ids) => `
  <a class="g-card" href="__BASE__games/${id}/">
    <span class="g-icon">${GAME_ICONS[id]}</span>
    <span class="g-tag">${tag}</span>
    <span class="g-title">${title}</span>
    <span class="g-text">${text}</span>
    <span class="g-meta">${meta}<span class="g-best" data-hub-ids="${esc(ids.join(','))}"></span></span>
    <span class="g-play">Play ›</span>
  </a>`;
  return `
<div class="eyebrow">Games</div>
<h1>Learn anatomy by playing.</h1>
<p class="lede">Short rounds, instant feedback, best scores saved in your browser. Pick a game.</p>
<div class="g-cards">
  ${card('name-it', 'Name it!', 'Read the clue and spell the term letter by letter. Keep your hearts, build a streak, collect stars.', `${decks.length} decks · ${terms} terms`, 'Spelling & recall', decks.map((d) => d.id))}
  ${card('pin-test', 'Pin test', 'A pin points at a muscle – you name it, just like in the clip test. Or find the muscle yourself on the plate.', `${plates.length} plates · ${pins} pins`, 'Clip-test practice', plates.map((p) => p.id))}
</div>
<p class="empty game-note">More games are coming with every region.</p>
<script src="__BASE__assets/games-hub.js" defer></script>`;
}

export function nameItPage({ site, decks }) {
  const cards = decks.map((d) => `
    <button type="button" class="deck" data-deck="${esc(d.id)}">
      <span class="deck-region">${esc(d.region || '')}</span>
      <span class="deck-title">${esc(d.title)}</span>
      <span class="deck-meta">${d.items.length} terms <span class="deck-best" data-best="${esc(d.id)}"></span></span>
    </button>`).join('');
  return `
${gameShellTop('Name it!', 'Games', 'Read the clue, type the term. Perfect answers build your streak – mistakes cost points, giving up costs a heart.')}
<div class="ni" id="ni">
  <section class="ni-pick" id="niPick">
    <div class="seg" role="radiogroup" aria-label="Mode">
      <label><input type="radio" name="nimode" value="learn" checked><span><b>Practise</b><small>letters shown</small></span></label>
      <label><input type="radio" name="nimode" value="test"><span><b>Challenge</b><small>letters hidden</small></span></label>
    </div>
    <div class="decks">${cards}</div>
  </section>

  <section class="ni-play" id="niPlay" hidden>
    <div class="hud">
      <button type="button" class="hud-btn" id="niQuit" aria-label="Back to decks">✕</button>
      <span class="hearts" id="niHearts" aria-label="Lives"></span>
      <span class="dots" id="niDots" aria-hidden="true"></span>
      <span class="streak" id="niStreak" aria-live="polite"></span>
      <span class="score" id="niScore">0</span>
      <button type="button" class="hud-btn" id="niSound" aria-label="Sound on/off">🔊</button>
    </div>
    <div class="ni-card" id="niCard">
      <div class="ni-deck" id="niDeckName"></div>
      <p class="ni-clue" id="niClue"></p>
      <div class="tiles" id="niTiles" aria-hidden="true"></div>
      <input class="ni-input" id="niInput" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Type here…" aria-label="Your answer">
      <div class="ni-float" id="niFloat" aria-hidden="true"></div>
      <div class="ni-actions">
        <button type="button" class="chip" id="niHint">💡 Hint <kbd>Tab</kbd></button>
        <button type="button" class="chip" id="niGive">🏳 Show answer <kbd>Esc</kbd></button>
      </div>
      <p class="ni-msg" id="niMsg" aria-live="polite"></p>
    </div>
  </section>

  <section class="ni-end" id="niEnd" hidden>
    <div class="stars" id="niStars"></div>
    <h2 id="niEndTitle"></h2>
    <div class="end-stats" id="niEndStats"></div>
    <div id="niReview"></div>
    <div class="btns"><button type="button" class="btn primary" id="niAgain">Play again</button> <button type="button" class="btn" id="niBack">Other deck</button></div>
  </section>
</div>
<p class="empty game-note">Scores are saved only in this browser. Clues are written by me; terms follow standard anatomical nomenclature.</p>
<script type="application/json" id="gameDecks">${JSON.stringify(decks).replace(/</g, '\\u003c')}</script>
<script src="__BASE__assets/game-sound.js" defer></script>
<script src="__BASE__assets/name-it.js" defer></script>`;
}

export const PT_CATEGORIES = [['muscles', 'Muscles'], ['vessels', 'Arteries & veins'], ['nerves', 'Nerves']];
export const PT_REGIONS = ['Head', 'Neck', 'Back', 'Thorax', 'Abdomen'];

export function pinTestPage({ site, plates }) {
  const regions = [...PT_REGIONS, ...new Set(plates.map((p) => p.region).filter((r) => !PT_REGIONS.includes(r)))];
  const count = (f) => plates.filter(f).reduce((n, p) => n + p.pins.length, 0);
  const plateCard = (p) => `
      <button type="button" class="deck plate" data-plate="${esc(p.id)}" data-cat="${esc(p.category)}">
        <img src="__BASE__games/plates/${esc(p.image)}" alt="" loading="lazy">
        <span class="deck-title">${esc(p.title)}</span>
        <span class="deck-meta">${esc(p.layer || '')} · ${p.pins.length} pins <span class="deck-best" data-best="${esc(p.id)}"></span></span>
      </button>`;
  const tabs = PT_CATEGORIES.map(([k, l], n) => `<label><input type="radio" name="ptcat" value="${k}"${n ? '' : ' checked'}><span><b>${l}</b><small>${count((p) => p.category === k)} pins</small></span></label>`).join('');
  const sections = regions.filter((r) => plates.some((p) => p.region === r)).map((r) => {
    const rp = plates.filter((p) => p.region === r);
    return `
    <div class="pt-region" data-region="${esc(r)}">
      <div class="pt-region-head"><h3>${esc(r)}</h3>
        <button type="button" class="exam-btn" data-exam="${esc(r)}">🎯 Mixed clip test · ${esc(r)} <small>${Math.min(20, count((p) => p.region === r))} random pins from muscles, vessels & nerves</small><span class="deck-best" data-best="exam:${esc(r)}"></span></button>
      </div>
      ${PT_CATEGORIES.map(([k]) => `<div class="decks" data-cat-group="${k}">${rp.filter((p) => p.category === k).map(plateCard).join('') || '<p class="empty pt-none">Coming soon.</p>'}</div>`).join('')}
    </div>`;
  }).join('');
  return `
${gameShellTop('Pin test', 'Games · Clip-test practice', 'A pin points at a structure – name it. Muscles, vessels and nerves for every region of the clip test.')}
<div class="pt" id="pt">
  <section class="pt-pick" id="ptPick">
    <div class="pt-controls">
      <div class="seg seg-cat" role="radiogroup" aria-label="What to practise">${tabs}</div>
      <div class="seg seg4" role="radiogroup" aria-label="Mode">
        <label><input type="radio" name="ptmode" value="type" checked><span><b>Clip test</b><small>type the name</small></span></label>
        <label><input type="radio" name="ptmode" value="choose"><span><b>Choose</b><small>4 options</small></span></label>
        <label><input type="radio" name="ptmode" value="find"><span><b>Find it</b><small>click the pin</small></span></label>
        <label><input type="radio" name="ptmode" value="study"><span><b>Study</b><small>tap to reveal</small></span></label>
      </div>
    </div>
    ${sections}
  </section>

  <section class="pt-play" id="ptPlay" hidden>
    <div class="hud">
      <button type="button" class="hud-btn" id="ptQuit" aria-label="Back to plates">✕</button>
      <span class="pt-title" id="ptTitle"></span>
      <span class="dots" id="ptDots" aria-hidden="true"></span>
      <span class="streak" id="ptStreak"></span>
      <span class="score" id="ptScore">0</span>
      <button type="button" class="hud-btn" id="ptSound" aria-label="Sound on/off">🔊</button>
    </div>
    <div class="pt-grid">
      <figure class="pt-fig">
        <div class="pt-stage" id="ptStage"><img id="ptImg" alt=""><div class="pt-pins" id="ptPins"></div></div>
        <figcaption id="ptCredit"></figcaption>
      </figure>
      <div class="pt-panel" id="ptPanel">
        <div class="pt-q" id="ptQ"></div>
        <form class="pt-form" id="ptForm" autocomplete="off">
          <input class="ni-input" id="ptInput" type="text" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Name of the pinned structure…" aria-label="Your answer">
          <div class="pt-btns"><button class="btn primary" type="submit">Check <kbd>Enter</kbd></button><button class="btn" type="button" id="ptDunno">I don't know</button></div>
        </form>
        <div class="pt-options" id="ptOptions"></div>
        <div class="pt-feedback" id="ptFeedback" aria-live="polite"></div>
        <button class="btn primary pt-next" type="button" id="ptNext" hidden>Next ›</button>
      </div>
    </div>
  </section>

  <section class="ni-end" id="ptEnd" hidden>
    <div class="stars" id="ptStars"></div>
    <h2 id="ptEndTitle"></h2>
    <div class="end-stats" id="ptEndStats"></div>
    <div id="ptReview"></div>
    <div class="btns"><button type="button" class="btn primary" id="ptAgain">Play again</button> <button type="button" class="btn" id="ptBack">Other plate</button></div>
  </section>
</div>
<p class="empty game-note">Plates: Sobotta's Atlas and Text-book of Human Anatomy (1909), public domain via Wikimedia Commons – labels removed and pins added by Mumen Anatomy. Latin and English names are both accepted. Scores are saved only in this browser.</p>
<script type="application/json" id="ptPlates">${JSON.stringify(plates).replace(/</g, '\\u003c')}</script>
<script>window.PT_BASE = ${JSON.stringify(site.base)};</script>
<script src="__BASE__assets/game-sound.js" defer></script>
<script src="__BASE__assets/pin-test.js" defer></script>`;
}
