// Mumen Anatomy – static site generator. Reads Notion, writes the website to ./dist
// Usage:  NOTION_TOKEN=secret_xxx node build.mjs
// No npm packages needed (Node 20+).
import { mkdir, writeFile, readFile, copyFile, rm, cp, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMuscle3d } from './src/m3d.mjs';
import { createNotionClient, loadBlocks, prop } from './src/notion.mjs';
import { renderBlocks, splitSections, contains, plain, isPrivateCallout, slugify, formatDate } from './src/render.mjs';
import { layout, homePage, regionPage, topicPage, aboutPage, membershipPage, donatePage, notFoundPage, physiologyIndexPage, physLecturePage, physSectionPage, progressPage, gamesHubPage, nameItPage, pinTestPage, muscle3dPage } from './src/templates.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(await readFile(path.join(ROOT, 'site.config.json'), 'utf8'));

export async function build({ client, outDir = path.join(ROOT, 'dist'), base = process.env.BASE_PATH || '/', log = console.log }) {
  base = base.endsWith('/') ? base : base + '/';
  const cacheDir = path.join(ROOT, '.cache', 'media');
  await rm(outDir, { recursive: true, force: true });
  await mkdir(path.join(outDir, 'media'), { recursive: true });
  await mkdir(cacheDir, { recursive: true });
  await cp(path.join(ROOT, 'assets'), path.join(outDir, 'assets'), { recursive: true });

  const stats = { images: 0, videos: 0, pages: 0, warnings: [] };

  // ---- media: download once, keep in .cache, copy into dist ----
  async function saveMedia(url, { notionFile }) {
    const u = new URL(url);
    const key = createHash('sha1').update(notionFile ? u.origin + u.pathname : url).digest('hex').slice(0, 12);
    const ext = (path.extname(decodeURIComponent(u.pathname)) || '.bin').toLowerCase().slice(0, 6);
    const name = key + ext;
    const cached = path.join(cacheDir, name);
    try {
      await access(cached);
    } catch {
      try {
        const res = await fetch(url, { headers: { 'User-Agent': 'MumenAnatomySiteBuilder/1.0 (educational website)' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await writeFile(cached, Buffer.from(await res.arrayBuffer()));
      } catch (e) {
        stats.warnings.push(`Could not download ${url.slice(0, 90)}… (${e.message})`);
        return notionFile ? '' : url; // external images can still load from their original address
      }
    }
    await copyFile(cached, path.join(outDir, 'media', name));
    return `${base}media/${name}`;
  }
  const ctx = { saveMedia, stats };

  // ---- videos stored in the repository: videos/<slug>.mp4 (+ optional videos/<slug>.txt caption) ----
  async function localVideo(slug) {
    for (const ext of ['.mp4', '.webm', '.mov']) {
      const src = path.join(ROOT, 'videos', slug + ext);
      try { await access(src); } catch { continue; }
      await mkdir(path.join(outDir, 'videos'), { recursive: true });
      await copyFile(src, path.join(outDir, 'videos', slug + ext));
      let cap = '';
      try { cap = (await readFile(path.join(ROOT, 'videos', slug + '.txt'), 'utf8')).trim(); } catch {}
      stats.videos++;
      return `<figure class="video"><video controls preload="metadata" playsinline src="${base}videos/${slug}${ext}"></video>${cap ? `<figcaption>${cap.replace(/</g, '&lt;')}</figcaption>` : ''}</figure>`;
    }
    return '';
  }

  // ---- interactive quiz stored in the repository: quizzes/<slug>.json ----
  // [{ "q": "question", "options": ["A", "B", ...], "answer": 0, "why": "explanation" }, ...]
  async function localQuiz(slug) {
    let items;
    try { items = JSON.parse(await readFile(path.join(ROOT, 'quizzes', slug + '.json'), 'utf8')); } catch { return ''; }
    if (!Array.isArray(items) || !items.length) return '';
    const e = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const qs = items.map((it, i) => `<li class="quiz-q" data-answer="${Number(it.answer)}">
  <p class="quiz-stem"><b>Q${i + 1}.</b> ${e(it.q)}</p>
  <div class="quiz-opts">${it.options.map((o, j) => `<button type="button" class="quiz-opt" data-i="${j}"><span class="quiz-letter">${'ABCDEF'[j]}</span>${e(o)}</button>`).join('')}</div>
  <div class="quiz-why" hidden><p class="quiz-verdict"></p><p>${e(it.why || '')}</p></div>
</li>`).join('\n');
    return `<div class="quiz" data-total="${items.length}">
<p class="quiz-intro">Pick an answer – you will see straight away if it is right, and why.</p>
<ol class="quiz-list">
${qs}
</ol>
<div class="quiz-score" hidden><p></p><button type="button" class="btn quiz-reset">Try again</button></div>
</div>`;
  }

  // ---- discover pages under the main Notion page ----
  const rootId = process.env.NOTION_ROOT_PAGE_ID || config.notionRootPageId;
  const rootChildren = await client.children(rootId);
  const find = (type, title) =>
    rootChildren.find((b) => b.type === type && b[type].title.trim().toLowerCase() === title.toLowerCase());
  const topicsDb = find('child_database', config.pages.topics);
  if (!topicsDb) throw new Error(`No database called "${config.pages.topics}" found on the main Notion page.`);

  // ---- settings ----
  const site = { base, name: 'Mumen Anatomy', tagline: '', intro: '', footer: '', logo: '', ...config.defaults, googleVerification: config.googleVerification || '' };
  site.v = createHash('md5').update(await readFile(path.join(ROOT, 'assets/style.css')) + await readFile(path.join(ROOT, 'assets/site.js'))).digest('hex').slice(0, 8);
  const settingsPage = find('child_page', config.pages.settings);
  if (settingsPage) {
    const blocks = await loadBlocks(client, settingsPage.id);
    for (const b of blocks) {
      if (b.type === 'table') {
        for (const row of b.children || []) {
          const [k, v] = row.table_row.cells.map((c) => plain(c).trim());
          const map = { 'site name': 'name', tagline: 'tagline', intro: 'intro', footer: 'footer' };
          if (map[k?.toLowerCase()] && v) site[map[k.toLowerCase()]] = v;
        }
      }
      if (b.type === 'image' && !site.logo) {
        const src = b.image.type === 'file' ? b.image.file.url : b.image.external.url;
        site.logo = await saveMedia(src, { notionFile: b.image.type === 'file' });
      }
    }
  }

  // ---- regions ----
  const regions = [];
  for (const r of config.regions) {
    const page = find('child_page', r.name);
    let intro = r.intro;
    if (page) {
      const blocks = await client.children(page.id);
      const p = blocks.find((b) => b.type === 'paragraph' && plain(b.paragraph.rich_text).trim() && !plain(b.paragraph.rich_text).trim().startsWith('/'));
      if (p) intro = plain(p.paragraph.rich_text).trim();
    }
    const image = r.image ? await saveMedia(r.image, { notionFile: false }) : '';
    const imageLarge = r.imageLarge ? await saveMedia(r.imageLarge, { notionFile: false }) : image;
    regions.push({ ...r, slug: slugify(r.name), intro, image, imageLarge });
  }

  // ---- topics ----
  const rows = await client.queryDatabase(topicsDb.id, {
    filter: { property: 'Status', select: { equals: 'Published' } },
    sorts: [{ property: 'Order', direction: 'ascending' }],
  });
  const topics = rows.map((p) => {
    const P = p.properties;
    const name = prop.text(P.Name);
    return {
      id: p.id,
      name,
      region: prop.select(P.Region),
      section: prop.select(P.Section) || 'Other topics',
      slug: slugify(prop.text(P.Slug) || name),
      priority: prop.select(P['Exam priority']),
      summary: prop.text(P.Summary),
      order: prop.number(P.Order) ?? 999,
      lastReviewed: prop.date(P['Last reviewed']),
    };
  });

  const write = async (rel, html) => {
    const file = path.join(outDir, rel);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, html);
    stats.pages++;
  };

  for (const topic of topics) {
    const region = regions.find((r) => r.name === topic.region) || { name: topic.region || 'Other', slug: slugify(topic.region || 'other') };
    const blocks = await loadBlocks(client, topic.id);
    const sections = [];
    for (const s of splitSections(blocks)) {
      let html = await renderBlocks(s.blocks, ctx);
      const t = s.title.toLowerCase();
      if (/video/.test(t) && !/3d|extra/.test(t) && !contains(s.blocks, ['video'])) {
        const vid = await localVideo(topic.slug);
        html = (vid || `<div class="placeholder">Video coming soon. I am recording my explanation of ${topic.name}.</div>`) + html;
      }
      if (/question|quiz/.test(t)) html = (await localQuiz(topic.slug)) + html;
      if (/cadaver/.test(t) && !contains(s.blocks, ['image'])) {
        html = `<div class="placeholder">Cadaver photos coming soon, straight from the dissection hall.</div>` + html;
      }
      if (/reference image|diagram/.test(t)) {
        try {
          const comp = await readFile(path.join(ROOT, 'components', `${topic.slug}.html`), 'utf8');
          html = comp.replaceAll('__BASE__', base) + html;
        } catch {}
      }
      if (!html.trim()) continue; // section still empty in Notion: leave it out
      sections.push({ ...s, html });
    }
    const crumbs = [{ label: 'Anatomy', href: '' }, { label: region.name, href: `regions/${region.slug}/` }, { label: topic.section, href: `regions/${region.slug}/#${slugify(topic.section)}` }];
    const chips = [topic.priority && `${topic.priority} Exam priority`, `${region.name} · ${topic.section}`, topic.lastReviewed && `Reviewed ${formatDate(topic.lastReviewed)}`];
    await write(`topics/${topic.slug}/index.html`, layout({ site, title: topic.name, description: topic.summary, body: topicPage({ site, topic, crumbs, chips, sections, feelKey: `anatomy/${topic.slug}` }) }));
    log(`  ✓ ${topic.name}  (${sections.length} sections)`);
  }

  for (const region of regions) {
    const list = topics.filter((t) => t.region === region.name);
    await write(`regions/${region.slug}/index.html`, layout({ site, title: region.name, description: region.intro, body: regionPage({ site, region, topics: list, sectionIntro: config.sectionIntro || {} }) }));
  }

  // ---- physiology (separate Notion database: the lecture tracker) ----
  const phys = [];
  const P_CFG = config.physiology;
  if (P_CFG?.databaseId) {
    try {
      const prow = await client.queryDatabase(P_CFG.databaseId, {
        filter: { property: 'Website', select: { equals: 'Published' } },
        sorts: [{ property: 'No.', direction: 'ascending' }],
      });
      for (const p of prow) {
        const P = p.properties;
        const full = prop.text(P.Lecture);
        const no = prop.number(P['No.']);
        const name = full.replace(/^\s*L\d+\s*[·:.\-–]\s*/, '').trim() || full;
        phys.push({ id: p.id, name, no, block: prop.select(P['Topic block']) || 'Other', slug: slugify(name), files: prop.files(P['Summary PDF']) });
      }
    } catch (e) {
      stats.warnings.push(`Physiology skipped – share the Physiology lecture tracker with the Notion connection (${e.message.slice(0, 120)})`);
    }
  }
  const PRIVATE_SECTION = /practical|lab manual|the experiment for this lecture|colloquium|class sheet|close the session/i;
  const SPECIAL = { summary: /^\s*📄|^\s*(summary|kurzfassung)\b/iu, wrap: /wrap-up/i, exam: /exam questions/i, cards: /flashcards/i };
  for (const lec of phys) {
    const blocks = await loadBlocks(client, lec.id);
    const all = splitSections(blocks);
    const parts = []; // every public section with its full html
    let own = null, wrap = null;
    for (const s of all) {
      if (/^\s*(🔬|🖨|✅)/u.test(s.raw) || PRIVATE_SECTION.test(s.raw)) continue;
      const html = await renderBlocks(s.blocks, { ...ctx, skipTextbookFigures: true });
      if (!html.trim()) continue;
      if (SPECIAL.summary.test(s.raw)) { own = html; continue; }
      if (SPECIAL.wrap.test(s.raw)) { wrap = html; continue; }
      const kind = SPECIAL.exam.test(s.raw) ? 'exam' : SPECIAL.cards.test(s.raw) ? 'cards' : 'topic';
      let lead = '', keys = '';
      if (kind === 'topic') {
        const para = s.blocks.find((b) => b.type === 'paragraph' && plain(b.paragraph.rich_text).trim().length > 40 && !/^\s*(fox\b|fig)/i.test(plain(b.paragraph.rich_text)) && !b.paragraph.rich_text.every((r) => r.annotations?.italic));
        if (para) { const t = plain(para.paragraph.rich_text).trim(); const m = t.match(/^.{40,}?[.!?](?=\s|$)/s); lead = (m ? m[0] : t).slice(0, 400); }
        const tk = s.blocks.find((b) => b.type === 'callout' && /📌/u.test(b.callout.icon?.emoji || ''));
        if (tk) keys = await renderBlocks(tk.children?.length ? tk.children : [tk], ctx);
      }
      parts.push({ ...s, html, kind, lead, keys });
    }
    lec.sub = parts.map((x) => x.id);
    // his own 1–2 page summary sheet(s) from the "Summary PDF" property → copied into the site
    lec.pdfs = [];
    for (const f of lec.files || []) {
      const href = await saveMedia(f.url, { notionFile: f.notionFile });
      if (!href || !/\.pdf$/i.test(href)) continue;
      const nice = `Mumen-Uthman_L${String(lec.no ?? '').padStart(2, '0')}_${lec.slug}${lec.pdfs.length ? '-' + (lec.pdfs.length + 1) : ''}.pdf`;
      lec.pdfs.push({ href, download: nice, name: f.name });
    }
    const intro = await renderBlocks((all.intro || []).filter((b) => b.type === 'callout' && /^(❓|🌍)/u.test(b.callout.icon?.emoji || '')), ctx);
    const base = `physiology/${lec.slug}/`;
    const crumbs = [{ label: 'Physiology', href: 'physiology/' }, { label: lec.block, href: `physiology/#${slugify(lec.block)}` }];
    const chips = [lec.no != null && `Lecture ${lec.no}`, lec.block];
    await write(`${base}index.html`, layout({ site, title: lec.name, active: 'physiology', description: `${lec.name} – short summary, physiology explained simply.`, body: physLecturePage({ site, lec, crumbs, chips, intro, own, wrap, parts, base, feelKey: `physiology/${lec.slug}` }) }));
    for (let i = 0; i < parts.length; i++) {
      const s = parts[i];
      await write(`${base}${s.id}/index.html`, layout({ site, title: `${s.title} – ${lec.name}`, active: 'physiology', description: `${s.title} – in depth (${lec.name}).`, body: physSectionPage({ site, lec, crumbs: [...crumbs, { label: lec.name, href: base }], s, prev: parts[i - 1], next: parts[i + 1], base }) }));
    }
    log(`  ✓ Physiology: ${lec.name}  (summary + ${parts.length} read-more pages${own ? ', own summary' : ''}${lec.pdfs.length ? `, ${lec.pdfs.length} PDF` : ''})`);
  }
  await write('physiology/index.html', layout({ site, title: 'Physiology', active: 'physiology', body: physiologyIndexPage({ site, lectures: phys }) }));

  // ---- visitor progress page ----
  const allTopics = [
    ...topics.map((t) => ({ key: `anatomy/${t.slug}`, name: t.name, group: `Anatomy · ${t.region}`, href: `topics/${t.slug}/` })),
    ...phys.map((l) => ({ key: `physiology/${l.slug}`, name: l.name, group: `Physiology · ${l.block}`, href: `physiology/${l.slug}/` })),
  ];
  await write('progress/index.html', layout({ site, title: 'My progress', active: 'progress', body: progressPage({ site, allTopics }) }));

  // ---- about ----
  let aboutHtml = '';
  const aboutNotion = find('child_page', config.pages.about);
  if (aboutNotion) {
    const blocks = await loadBlocks(client, aboutNotion.id);
    const secs = splitSections(blocks);
    aboutHtml = await renderBlocks((secs.intro || []).filter((b) => !isPrivateCallout(b)), ctx);
    for (const s of secs) {
      const h = await renderBlocks(s.blocks, ctx);
      if (h.trim()) aboutHtml += `<h2>${s.title}</h2>${h}`;
    }
  }
  // ---- games (decks in games/decks.json, pin plates in games/pins.json + games/plates/) ----
  try {
    const readJson = async (f) => JSON.parse(await readFile(path.join(ROOT, 'games', f), 'utf8'));
    const decks = ((await readJson('decks.json')).decks || []).filter((d) => d.id && d.title && Array.isArray(d.items) && d.items.length);
    const okPlate = (p) => p.id && p.image && Array.isArray(p.pins) && p.pins.length;
    const hy = ((await readJson('high-yield.json').catch(() => ({}))).structures || []).map((h) => h.toLowerCase());
    const facts = await readJson('facts.json').catch(() => ({}));
    const markHy = (list, dir) => list.filter(okPlate).map((p) => ({ ...p, dir, pins: p.pins.map((q) => ({ ...q, hy: hy.some((h) => q.answer.toLowerCase().includes(h)), ...(facts[q.answer] ? { fact: facts[q.answer] } : {}) })) }));
    const plates = markHy((await readJson('pins.json')).plates || [], 'plates');
    let cadaver = [];
    try { cadaver = markHy((await readJson('cadaver.json')).plates || [], 'cadaver'); } catch {}
    await cp(path.join(ROOT, 'games', 'plates'), path.join(outDir, 'games', 'plates'), { recursive: true });
    if (cadaver.length) await cp(path.join(ROOT, 'games', 'cadaver'), path.join(outDir, 'games', 'cadaver'), { recursive: true });
    const gdesc = 'Anatomy games – spelling challenge and clip-test pin practice.';
    const m3d = await buildMuscle3d(ROOT, outDir, (w) => stats.warnings.push(w));
    if (m3d.length) await write('games/muscle-3d/index.html', layout({ site, title: '3D muscles – name it in Latin', active: 'games', description: 'Turn a 3D model, name the muscle in Latin and learn origin, insertion and innervation.', body: muscle3dPage({ site, regions: m3d }) }));
    for (const r of m3d) log(`  ✓ 3D ${r.title}: ${r.n} muscles, ${(r.bytes / 1e6).toFixed(1)} MB`);
    await write('games/index.html', layout({ site, title: 'Games', active: 'games', description: gdesc, body: gamesHubPage({ site, decks, plates, cadaver, m3d }) }));
    await write('games/name-it/index.html', layout({ site, title: 'Name it! – anatomy spelling game', active: 'games', description: 'Read the clue, type the anatomical term.', body: nameItPage({ site, decks }) }));
    await write('games/pin-test/index.html', layout({ site, title: 'Pin test – clip-test practice', active: 'games', description: 'Name the pinned muscle – practise for the anatomy clip test.', body: pinTestPage({ site, plates }) }));
    if (cadaver.length) await write('games/cadaver-clip-test/index.html', layout({ site, title: 'Real cadaver clip test', active: 'games', description: 'Clip-test practice on real dissection-hall photos.', body: pinTestPage({ site, plates: cadaver, cadaver: true }) }));
  } catch (e) {
    stats.warnings.push('games skipped: ' + e.message);
  }
  await write('about/index.html', layout({ site, title: 'About me', active: 'about', body: aboutPage({ site, html: aboutHtml }) }));
  await write('donate/index.html', layout({ site, title: 'Donate', active: 'donate', description: 'Support Mumen Anatomy with a coffee, help women and children in Sbeineh camp, or support my studies.', body: donatePage({ site }) }));
  await write('membership/index.html', layout({ site, title: 'Donate', active: 'donate', body: membershipPage({ site }) }));
  await write('index.html', layout({ site, active: 'home', body: homePage({ site, regions, topics, phys }) }));
  await write('404.html', layout({ site, title: 'Not found', body: notFoundPage({ site }) }));
  await writeFile(path.join(outDir, '.nojekyll'), '');

  // ---- sitemap + robots (helps Google find every page) ----
  const origin = (process.env.SITE_ORIGIN || config.siteOrigin || '').replace(/\/$/, '');
  if (origin) {
    const urls = ['', 'games/', 'games/name-it/', 'games/pin-test/', 'games/cadaver-clip-test/', 'games/muscle-3d/', 'about/', 'donate/', 'physiology/', ...regions.map((r) => `regions/${r.slug}/`), ...topics.map((t) => `topics/${t.slug}/`), ...phys.flatMap((l) => [`physiology/${l.slug}/`, ...(l.sub || []).map((x) => `physiology/${l.slug}/${x}/`)])];
    const today = new Date().toISOString().slice(0, 10);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((p) => `  <url><loc>${origin}${base}${p}</loc><lastmod>${today}</lastmod></url>`)
      .join('\n')}\n</urlset>\n`;
    await writeFile(path.join(outDir, 'sitemap.xml'), xml);
    await writeFile(path.join(outDir, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${origin}${base}sitemap.xml\n`);
  }

  log(`Done: ${stats.pages} pages, ${topics.length} topics, ${stats.images} images, ${stats.videos} videos.`);
  for (const w of stats.warnings) log((process.env.GITHUB_ACTIONS ? '::warning::' : '  ! ') + w);
  return { stats, topics, regions, site, phys };
}

// Run from the command line
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build({ client: createNotionClient(process.env.NOTION_TOKEN) }).catch((e) => {
    console.error('Build failed:', e.message);
    if (process.env.GITHUB_ACTIONS) console.log(`::error title=Build failed::${String(e.message).replace(/\n/g, ' ')}`);
    process.exit(1);
  });
}
