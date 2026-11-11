import { esc, formatDate } from './render.mjs';

export function layout({ site, title, description, body, active = '', depthBase }) {
  const u = (p = '') => site.base + p;
  const pageTitle = title ? `${title} · ${site.name}` : site.name;
  const nav = [
    ['', 'Regions', 'home'],
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
<meta property="og:title" content="${esc(pageTitle)}">
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
${body}
</main>
<footer>
  <div class="wrap"><span>${esc(site.footer)}</span><span>Images are credited with source and license on every figure.</span></div>
</footer>
<script src="${u('assets/site.js')}" defer></script>
</body>
</html>`;
}

export function homePage({ site, regions, topics }) {
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
  <div class="section-head"><h2 id="h-regions">Regions</h2><span class="eyebrow">${regions.length} regions · ${live} topic${live === 1 ? '' : 's'} live</span></div>
  <div class="regions">
    ${regions
      .map((r, i) => {
        const n = topics.filter((t) => t.region === r.name).length;
        return `<a class="region${n ? ' live' : ''}" href="${u(`regions/${r.slug}/`)}"><span class="n">${String(i + 1).padStart(2, '0')}</span><span class="t">${esc(r.name)}</span><span class="c">${n ? `${n} topic${n === 1 ? '' : 's'}` : 'Coming soon'}</span></a>`;
      })
      .join('\n    ')}
  </div>
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

export function regionPage({ site, region, topics }) {
  const u = (p = '') => site.base + p;
  const rows = topics.length
    ? topics
        .map((t) => `<a class="topic-row" href="${u(`topics/${t.slug}/`)}"><span><span class="t">${esc(t.name)}</span>${t.summary ? `<span class="s">${esc(t.summary)}</span>` : ''}</span><span class="m">${t.priority ? `${esc(t.priority)} exam priority` : ''}</span></a>`)
        .join('\n')
    : `<p class="empty">Topics for this region are being written. Check back soon.</p>`;
  return `
<div class="crumbs"><a href="${u()}">Regions</a> / ${esc(region.name)}</div>
<h1>${esc(region.name)}</h1>
${region.intro ? `<p class="lede">${esc(region.intro)}</p>` : ''}
<div class="topic-list">${rows}</div>`;
}

export function topicPage({ site, topic, region, sections }) {
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
  return `
<div class="crumbs"><a href="${u()}">Regions</a> / <a href="${u(`regions/${region.slug}/`)}">${esc(region.name)}</a> / ${esc(topic.name)}</div>
<h1>${esc(topic.name)}</h1>
<div class="chips">
  ${topic.priority ? `<span class="chip prio">${esc(topic.priority)} Exam priority</span>` : ''}
  <span class="chip">${esc(region.name)}</span>
  ${topic.lastReviewed ? `<span class="chip">Reviewed ${esc(formatDate(topic.lastReviewed))}</span>` : ''}
</div>
<div class="topic">
  <nav class="toc" aria-label="On this page"><span class="eyebrow">On this page</span><ol>${toc}</ol></nav>
  <article>${body}
  </article>
</div>`;
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
