// Offline test: builds the site from a fake Notion workspace (shaped like real API answers).
// Run: node test/run.mjs   -> output in test/out
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from '../build.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const rt = (text, ann = {}, href = null) => ({ type: 'text', plain_text: text, href, text: { content: text, link: href ? { url: href } : null }, annotations: ann });
let n = 0;
const reg = new Map();
const blk = (type, data, children) => { const b = { id: `b${++n}`, type, [type]: data, has_children: !!children }; reg.set(b.id, children || []); return b; };
const p = (...r) => blk('paragraph', { rich_text: r });
const h2 = (t) => blk('heading_2', { rich_text: [rt(t)], is_toggleable: false });
const tq = (q, a) => blk('heading_3', { rich_text: [rt(q)], is_toggleable: true }, [p(rt('Answer: ', { bold: true }), rt(a))]);
const callout = (emoji, t) => blk('callout', { rich_text: [rt(t)], icon: { type: 'emoji', emoji } });
const li = (t) => blk('bulleted_list_item', { rich_text: [rt(t)] });
const oli = (t) => blk('numbered_list_item', { rich_text: [rt(t)] });
const img = (url, cap) => blk('image', { type: 'external', external: { url }, caption: [rt(cap)] });
const table = (rows) => blk('table', { table_width: rows[0].length, has_column_header: true }, rows.map((r) => blk('table_row', { cells: r.map((c) => [rt(c)]) })));

const tree = {
  root: [
    blk('child_database', { title: 'Topics' }),
    blk('child_page', { title: 'About Me' }),
    blk('child_page', { title: 'Website settings' }),
    blk('child_page', { title: 'Upper Limb' }),
  ],
};
tree.root[0].id = 'db'; tree.root[1].id = 'about'; tree.root[2].id = 'settings'; tree.root[3].id = 'ul';
tree.ul = [callout('✍️', 'private'), p(rt('Shoulder to hand – my test intro.'))];
tree.settings = [callout('✍️', 'private'), table([['Setting', 'Value'], ['Site name', 'Mumen Anatomy'], ['Tagline', 'Test tagline from Notion.']])];
tree.about = [
  callout('✍️', 'private'),
  p(rt("Hi, I'm Mumen.")),
  h2('Why I started'),
  callout('✍️', 'write here'),
  h2('Contact'),
  p(rt('Instagram: @example')),
];
tree.bp = [
  callout('🌐', 'website link'),
  blk('table_of_contents', {}),
  h2('1. 🧠 Explanation (in my own words)'),
  p(rt('In one sentence: ', { bold: true }), rt('The brachial plexus supplies the upper limb.')),
  blk('heading_3', { rich_text: [rt('💬 Memory trick')], is_toggleable: true }, [p(rt('Randy Travis Drinks Cold Beer'))]),
  h2('2. 🎬 My video explanation'),
  callout('✍️', 'add video'),
  h2('3. 📚 Reliable sources'),
  table([['Source', 'Use', 'Link'], ['Kenhub', 'Branches', 'Open']]),
  h2('4. 🖼️ Reference images'),
  img('https://example.invalid/gray808.png', 'Fig. 2 – Gray 808 · Public domain'),
  h2('5. 🧴 My cadaver photos'),
  callout('🔒', 'rules'),
  p(rt('What to look for: ', { bold: true }), rt('the M shape.')),
  h2('6. 🧊 3D models & extra videos'),
  li('3D model'),
  h2('7. 🏥 Key clinical correlations'),
  table([['Condition', 'What happens', 'Clue'], ["Erb's palsy", 'C5–C6 stretched', "Waiter's tip"]]),
  h2('8. ❓ Top 5 exam questions'),
  callout('🎯', 'Try to answer first, then open the toggle.'),
  tq('Q1. Which spinal nerves?', 'C5–T1.'),
  tq('Q2. Cords?', 'Lateral, posterior, medial.'),
  h2('9. 🔬 Histology essentials'),
  li('Tissue: peripheral nerve'),
  h2('10. ✅ Key takeaways'),
  oli('One'), oli('Two'),
  blk('divider', {}),
  blk('heading_3', { rich_text: [rt('🚀 Publishing checklist')], is_toggleable: true }, [blk('to_do', { rich_text: [rt('x')], checked: true })]),
];
tree.video = [
  h2('1. Explanation'), p(rt('Short.')),
  h2('2. 🎬 My video explanation'),
  blk('video', { type: 'external', external: { url: 'https://youtu.be/dQw4w9WgXcQ' }, caption: [rt('My explanation')] }),
];

const pages = [
  { id: 'bp', properties: { Name: { title: [rt('Brachial Plexus')] }, Region: { select: { name: 'Upper Limb' } }, Slug: { rich_text: [rt('brachial-plexus')] }, 'Exam priority': { select: { name: '★★★' } }, Summary: { rich_text: [rt('Nerve network C5–T1.')] }, Order: { number: 1 }, 'Last reviewed': { date: { start: '2026-11-10' } } } },
  { id: 'video', properties: { Name: { title: [rt('Video Test Topic')] }, Region: { select: { name: 'Upper Limb' } }, Slug: { rich_text: [] }, 'Exam priority': { select: null }, Summary: { rich_text: [] }, Order: { number: 2 }, 'Last reviewed': { date: null } } },
];

const fake = {
  children: async (id) => (id === '413d43edb34f81189afaf9d67fa30215' ? tree.root : tree[id] || reg.get(id) || []),
  queryDatabase: async (id, body) => {
    if (body.filter.select.equals !== 'Published') throw new Error('filter wrong');
    return pages;
  },
};

const res = await build({ client: fake, outDir: path.join(here, 'out'), base: '/mumen-anatomy/' });
if (res.topics.length !== 2) throw new Error('expected 2 topics');
console.log('TEST OK');
