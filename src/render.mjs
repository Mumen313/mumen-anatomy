// Turns Notion blocks into HTML.
export const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Callouts with these icons are private notes for Mumen and never appear on the website.
const PRIVATE_ICONS = ['✍', '⚖', '🔒', '🌐', '🧩', '📘'];
const norm = (s = '') => s.replace(/️/g, '');
export const isPrivateCallout = (b) =>
  b.type === 'callout' && b.callout.icon?.type === 'emoji' && PRIVATE_ICONS.includes(norm(b.callout.icon.emoji));

export const plain = (rt = []) => rt.map((t) => t.plain_text).join('');

// Removes "2. " numbering and a leading emoji from headings ("2. 🎬 My video" -> "My video").
export const cleanTitle = (s) =>
  s.replace(/\s*⏱.*$/u, '').replace(/^\s*\d+\s*[.)·:]\s*/u, '').replace(/^[\p{Extended_Pictographic}️‍\s]+/u, '').trim();

export const slugify = (s) =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export function richText(rt = []) {
  return rt
    .map((t) => {
      let s;
      if (t.type === 'mention' && t.mention?.type === 'date') {
        s = esc(formatDate(t.mention.date.start));
      } else {
        s = esc(t.plain_text).replace(/\n/g, '<br>');
      }
      const a = t.annotations || {};
      if (a.code) s = `<code>${s}</code>`;
      if (a.bold) s = `<strong>${s}</strong>`;
      if (a.italic) s = `<em>${s}</em>`;
      if (a.strikethrough) s = `<s>${s}</s>`;
      if (a.underline) s = `<u>${s}</u>`;
      const href = t.href || t.text?.link?.url;
      if (href && /^https?:/.test(href)) s = `<a href="${esc(href)}" target="_blank" rel="noopener">${s}</a>`;
      return s;
    })
    .join('');
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00Z' : iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function videoEmbed(url) {
  let m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if (m) return `https://www.youtube-nocookie.com/embed/${m[1]}`;
  m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) return `https://player.vimeo.com/video/${m[1]}`;
  return null;
}

const fileUrl = (obj) => (obj.type === 'file' ? obj.file.url : obj.external?.url);

// ctx: { saveMedia(url, {notionFile, kind}) -> Promise<string>, stats }
export async function renderBlocks(blocks = [], ctx) {
  let html = '';
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.type === 'bulleted_list_item' || b.type === 'numbered_list_item') {
      const tag = b.type === 'bulleted_list_item' ? 'ul' : 'ol';
      let items = '';
      while (i < blocks.length && blocks[i].type === b.type) {
        const it = blocks[i];
        items += `<li>${richText(it[it.type].rich_text)}${it.children ? await renderBlocks(it.children, ctx) : ''}</li>`;
        i++;
      }
      i--;
      html += `<${tag}>${items}</${tag}>`;
      continue;
    }
    html += await renderBlock(b, ctx);
  }
  return html;
}

async function renderBlock(b, ctx) {
  const v = b[b.type];
  const kids = async () => (b.children ? renderBlocks(b.children, ctx) : '');
  switch (b.type) {
    case 'paragraph': {
      const t = plain(v.rich_text).trim();
      if (!t || t.startsWith('/')) return ''; // empty lines and leftover "/image" hints
      if (ctx.skipTextbookFigures && /^(fox|guyton)\b.*fig/i.test(t)) return ''; // captions of textbook figures stay private
      return `<p>${richText(v.rich_text)}</p>`;
    }
    case 'heading_1':
    case 'heading_2':
    case 'heading_3': {
      const title = richText(v.rich_text);
      if (v.is_toggleable) {
        if (/publishing checklist/i.test(plain(v.rich_text))) return '';
        return `<details class="toggle"><summary>${title}</summary><div class="a">${await kids()}</div></details>`;
      }
      return `<h3>${title}</h3>`;
    }
    case 'toggle':
      if (/publishing checklist/i.test(plain(v.rich_text))) return '';
      return `<details class="toggle"><summary>${richText(v.rich_text)}</summary><div class="a">${await kids()}</div></details>`;
    case 'quote':
      return `<blockquote>${richText(v.rich_text)}${await kids()}</blockquote>`;
    case 'callout':
      if (isPrivateCallout(b)) return '';
      const icon = norm(v.icon?.emoji || '');
      const kind = { '📌': 'takeaway', '❗': 'ask', '🗣': 'teller', '❓': 'question', '🔑': 'answer', '🎯': 'goal', '🌍': 'words' }[icon] || '';
      return `<div class="note${kind ? ' note-' + kind : ''}">${richText(v.rich_text)}${await kids()}</div>`;
    case 'code':
      return `<pre><code>${esc(plain(v.rich_text))}</code></pre>`;
    case 'equation':
      return `<p class="equation">${esc(v.expression)}</p>`;
    case 'divider':
    case 'to_do':
    case 'table_of_contents':
    case 'child_page':
    case 'child_database':
    case 'breadcrumb':
      return '';
    case 'column_list': {
      let cols = '';
      for (const c of b.children || []) cols += `<div class="col">${c.children ? await renderBlocks(c.children, ctx) : ''}</div>`;
      return `<div class="columns">${cols}</div>`;
    }
    case 'table': {
      const rows = b.children || [];
      let out = '';
      rows.forEach((r, idx) => {
        const cells = r.table_row.cells;
        const isHead = v.has_column_header && idx === 0;
        const tag = isHead ? 'th' : 'td';
        out += `<tr>${cells.map((c) => `<${tag}>${richText(c)}</${tag}>`).join('')}</tr>`;
        if (isHead) out = `<thead>${out}</thead><tbody>`;
      });
      if (v.has_column_header) out += '</tbody>';
      return `<div class="tablewrap"><table>${out}</table></div>`;
    }
    case 'image': {
      const src = fileUrl(v);
      if (!src) return '';
      if (ctx.skipTextbookFigures && /fox|guyton/i.test(decodeURIComponent(src.split('?')[0]) + ' ' + plain(v.caption))) return ''; // redrawn textbook figures stay private
      const local = await ctx.saveMedia(src, { notionFile: v.type === 'file', kind: 'image' });
      const cap = richText(v.caption);
      ctx.stats.images++;
      return `<figure><img src="${esc(local)}" alt="${esc(plain(v.caption) || 'Anatomy image')}" loading="lazy">${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure>`;
    }
    case 'video': {
      const src = fileUrl(v);
      if (!src) return '';
      const cap = richText(v.caption);
      ctx.stats.videos++;
      const embed = videoEmbed(src);
      if (embed) {
        return `<figure class="video"><div class="ratio"><iframe src="${esc(embed)}" title="${esc(plain(v.caption) || 'Video')}" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe></div>${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure>`;
      }
      const local = await ctx.saveMedia(src, { notionFile: v.type === 'file', kind: 'video' });
      return `<figure class="video"><video controls preload="metadata" src="${esc(local)}"></video>${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure>`;
    }
    case 'file':
    case 'pdf': {
      const src = fileUrl(v);
      if (!src) return '';
      const local = await ctx.saveMedia(src, { notionFile: v.type === 'file', kind: 'file' });
      const name = plain(v.caption) || v.name || 'Download';
      return `<p><a class="filelink" href="${esc(local)}">${esc(name)}</a></p>`;
    }
    case 'bookmark':
    case 'embed':
    case 'link_preview': {
      const url = v.url;
      if (!url) return '';
      const embed = videoEmbed(url);
      if (embed) {
        ctx.stats.videos++;
        return `<figure class="video"><div class="ratio"><iframe src="${esc(embed)}" title="Video" allowfullscreen loading="lazy"></iframe></div></figure>`;
      }
      const cap = plain(v.caption || []) || url.replace(/^https?:\/\//, '');
      return `<p><a class="linkcard" href="${esc(url)}" target="_blank" rel="noopener">${esc(cap)}</a></p>`;
    }
    default:
      return '';
  }
}

// Split top-level page blocks into sections at each heading_1/heading_2.
export function splitSections(blocks) {
  const sections = [];
  let cur = null;
  for (const b of blocks) {
    if ((b.type === 'heading_2' || b.type === 'heading_1') && !b[b.type].is_toggleable) {
      const raw = plain(b[b.type].rich_text);
      cur = { raw, title: cleanTitle(raw), id: slugify(cleanTitle(raw)), blocks: [] };
      sections.push(cur);
    } else if (cur) {
      cur.blocks.push(b);
    } else {
      (sections.intro ||= []).push(b);
    }
  }
  return sections;
}

// Does a block tree contain a block of these types?
export function contains(blocks = [], types) {
  return blocks.some((b) => types.includes(b.type) || (b.type === 'embed' && videoEmbed(b.embed.url || '') && types.includes('video')) || contains(b.children, types));
}
