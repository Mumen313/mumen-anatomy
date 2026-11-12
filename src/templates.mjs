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
        return `<a class="region${n ? ' live' : ''}" href="${u(`regions/${r.slug}/`)}">${r.image ? `<span class="region-thumb"><img src="${esc(r.image)}" alt="" loading="lazy"></span>` : ''}<span class="region-text"><span class="t">${esc(r.name)}</span><span class="d">${esc(r.intro || '')}</span><span class="c">${n ? `${n} topic${n === 1 ? '' : 's'}` : 'Coming soon'}</span></span></a>`;
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
  ${region.image ? `<figure class="region-img"><img src="${esc(region.image)}" alt="${esc(region.name)} – anatomical illustration"><figcaption>${esc(region.imageCredit || '')}</figcaption></figure>` : ''}
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
