// Mumen Anatomy – static site generator. Reads Notion, writes the website to ./dist
// Usage:  NOTION_TOKEN=secret_xxx node build.mjs
// No npm packages needed (Node 20+).
import { mkdir, writeFile, readFile, copyFile, rm, cp, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createNotionClient, loadBlocks, prop } from './src/notion.mjs';
import { renderBlocks, splitSections, contains, plain, isPrivateCallout, slugify } from './src/render.mjs';
import { layout, homePage, regionPage, topicPage, aboutPage, membershipPage, notFoundPage } from './src/templates.mjs';

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

  // ---- discover pages under the main Notion page ----
  const rootId = process.env.NOTION_ROOT_PAGE_ID || config.notionRootPageId;
  const rootChildren = await client.children(rootId);
  const find = (type, title) =>
    rootChildren.find((b) => b.type === type && b[type].title.trim().toLowerCase() === title.toLowerCase());
  const topicsDb = find('child_database', config.pages.topics);
  if (!topicsDb) throw new Error(`No database called "${config.pages.topics}" found on the main Notion page.`);

  // ---- settings ----
  const site = { base, name: 'Mumen Anatomy', tagline: '', intro: '', footer: '', logo: '' , ...config.defaults };
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
    regions.push({ ...r, slug: slugify(r.name), intro });
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
        html = `<div class="placeholder">Video coming soon. I am recording my explanation of ${topic.name}.</div>` + html;
      }
      if (/cadaver/.test(t) && !contains(s.blocks, ['image'])) {
        html = `<div class="placeholder">Cadaver photos coming soon, straight from the dissection hall.</div>` + html;
      }
      if (/reference image|diagram/.test(t)) {
        try {
          const comp = await readFile(path.join(ROOT, 'components', `${topic.slug}.html`), 'utf8');
          html = comp + html;
        } catch {}
      }
      if (!html.trim()) continue; // section still empty in Notion: leave it out
      sections.push({ ...s, html });
    }
    await write(`topics/${topic.slug}/index.html`, layout({ site, title: topic.name, description: topic.summary, body: topicPage({ site, topic, region, sections }) }));
    log(`  ✓ ${topic.name}  (${sections.length} sections)`);
  }

  for (const region of regions) {
    const list = topics.filter((t) => t.region === region.name);
    await write(`regions/${region.slug}/index.html`, layout({ site, title: region.name, description: region.intro, body: regionPage({ site, region, topics: list }) }));
  }

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
  await write('about/index.html', layout({ site, title: 'About me', active: 'about', body: aboutPage({ site, html: aboutHtml }) }));
  await write('membership/index.html', layout({ site, title: 'Membership', active: 'membership', body: membershipPage({ site }) }));
  await write('index.html', layout({ site, active: 'home', body: homePage({ site, regions, topics }) }));
  await write('404.html', layout({ site, title: 'Not found', body: notFoundPage({ site }) }));
  await writeFile(path.join(outDir, '.nojekyll'), '');

  log(`Done: ${stats.pages} pages, ${topics.length} topics, ${stats.images} images, ${stats.videos} videos.`);
  for (const w of stats.warnings) log('  ! ' + w);
  return { stats, topics, regions, site };
}

// Run from the command line
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build({ client: createNotionClient(process.env.NOTION_TOKEN) }).catch((e) => {
    console.error('Build failed:', e.message);
    process.exit(1);
  });
}
