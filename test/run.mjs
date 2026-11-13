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
  { id: 'bp', properties: { Name: { title: [rt('Brachial Plexus')] }, Region: { select: { name: 'Upper Limb' } }, Section: { select: { name: 'Nerves' } }, Slug: { rich_text: [rt('brachial-plexus')] }, 'Exam priority': { select: { name: '★★★' } }, Summary: { rich_text: [rt('Nerve network C5–T1.')] }, Order: { number: 1 }, 'Last reviewed': { date: { start: '2026-11-10' } } } },
  { id: 'video', properties: { Name: { title: [rt('Video Test Topic')] }, Region: { select: { name: 'Upper Limb' } }, Slug: { rich_text: [] }, 'Exam priority': { select: null }, Summary: { rich_text: [] }, Order: { number: 2 }, 'Last reviewed': { date: null } } },
];

const h1 = (t) => blk('heading_1', { rich_text: [rt(t)], is_toggleable: false });
const todo = (t) => blk('to_do', { rich_text: [rt(t)], checked: false });
const toggle = (q, a) => blk('toggle', { rich_text: [rt(q)] }, [p(rt(a))]);
const fileImg = (name) => blk('image', { type: 'file', file: { url: `https://example.invalid/secure/${name}?X-Amz=1` }, caption: [] });
tree.l1 = [
  callout('❓', 'The big question of this lecture: how does the body stay stable?'),
  callout('🧭', 'Roadmap'),
  callout('📚', 'Sources'),
  blk('table_of_contents', {}),
  h1('Part A — The idea of physiology'),
  h2('1 · What physiology is  ⏱ 5 min'),
  p(rt('Physiology is how the body works.')),
  callout('📌', 'TAKEAWAYS'),
  callout('❗', 'THEY ASK'),
  callout('🗣️', 'THE TELLER'),
  todo('I can explain section 1 without looking'),
  h2('5 · Negative feedback  ⏱ 10 min'),
  fileImg('L1_fox_fig1_4.svg'),
  p(rt('Fox Fig. 1.4 — body temperature oscillates around 37 °C.', { italic: true })),
  callout('📘', 'Fox Fig. 1.6 (p. 9) shows this'),
  p(rt('Fox calls this dynamic constancy.')),
  h2('🔬 In the practical — P1 Homeostasis (Lab Manual p. 7)'),
  p(rt('MODEL ANSWERS FROM LAB MANUAL')),
  h2('13 · Practical 2 — Membrane physiology (Lab Manual p. 8–11)'),
  p(rt('PRACTICAL TWO ANSWERS')),
  h2('The experiment for this lecture — frog nerve–muscle preparation'),
  p(rt('FROG EXPERIMENT')),
  h2('📝 Open exam questions  ⏱ 15 min'),
  toggle('Q1. Define physiology.', 'How the body works.'),
  toggle('Q2. Define homeostasis.', 'Nearly constant internal environment.'),
  h2('🖨️ 2-page class sheet'),
  p(rt('CLASS SHEET PDF')),
  h2('✅ Close the session'),
  todo('All sections ticked'),
];
const physPages = [{ id: 'l1', properties: { Lecture: { title: [rt('L1 · Homeostasis & control systems')] }, 'No.': { number: 1 }, 'Topic block': { select: { name: 'Foundations' } } } }];

const fake = {
  children: async (id) => (id === '413d43edb34f81189afaf9d67fa30215' ? tree.root : tree[id] || reg.get(id) || []),
  queryDatabase: async (id, body) => {
    if (body.filter.select.equals !== 'Published') throw new Error('filter wrong');
    if (body.filter.property === 'Website') return physPages;
    return pages;
  },
};

const res = await build({ client: fake, outDir: path.join(here, 'out'), base: '/mumen-anatomy/' });
if (res.topics.length !== 2) throw new Error('expected 2 topics');
if (res.phys.length !== 1) throw new Error('expected 1 physiology lecture');
const { readFile } = await import('node:fs/promises');
const html = await readFile(path.join(here, 'out', 'physiology', 'homeostasis-and-control-systems', 'index.html'), 'utf8');
const must = ['What physiology is', 'Negative feedback', 'Fox calls this dynamic constancy', 'Open exam questions', 'note-takeaway', 'note-ask', 'note-teller', 'The big question', 'class="feel"', 'Lecture 1'];
const mustNot = ['PRACTICAL TWO', 'FROG EXPERIMENT', 'MODEL ANSWERS', 'CLASS SHEET', 'Close the session', 'fox_fig', 'Fox Fig.', 'without looking', 'Roadmap', '⏱', '__BASE__', 'Part A'];
for (const m of must) if (!html.includes(m)) throw new Error('missing: ' + m);
for (const m of mustNot) if (html.includes(m)) throw new Error('leaked: ' + m);
const prog = await readFile(path.join(here, 'out', 'progress', 'index.html'), 'utf8');
if (!prog.includes('physiology/homeostasis-and-control-systems')) throw new Error('progress list incomplete');
const home = await readFile(path.join(here, 'out', 'index.html'), 'utf8');
if (!home.includes('Homeostasis &amp; control systems')) throw new Error('home missing physiology');
const ul = await readFile(path.join(here, 'out', 'regions', 'upper-limb', 'index.html'), 'utf8');
for (const m of ['id="nerves"', 'id="osteology"', 'Brachial Plexus', 'Other topics', 'secnav']) if (!ul.includes(m)) throw new Error('region page missing ' + m);
const bp = await readFile(path.join(here, 'out', 'topics', 'brachial-plexus', 'index.html'), 'utf8');
if (!bp.includes('Upper Limb · Nerves')) throw new Error('topic chip missing section');
for (const [f, ms] of [['games/index.html', ['g-card', 'pin-test/', 'name-it/']], ['games/name-it/index.html', ['id="gameDecks"', 'skull-foramina', 'name-it.js']], ['games/pin-test/index.html', ['id="ptPlates"', 'head-face-superficial', 'pin-test.js', 'buccinator']], ['games/plates/head-face-deep.jpg', []]]) {
  const t = await readFile(path.join(here, 'out', f), 'utf8');
  for (const m of ms) if (!t.includes(m)) throw new Error(f + ' missing ' + m);
  if (t.includes('__BASE__')) throw new Error(f + ' base not replaced');
}
console.log('TEST OK');
