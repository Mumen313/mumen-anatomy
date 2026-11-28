// Learn the Plexus – loads games/plexus/*.json and links each muscle to a picture.
// Pictures: the public-domain Sobotta plates of the Pin test (games/pins.json) – if a plate has a pin on that muscle,
// the info panel zooms to it. Muscles without a plate link to the 3D muscle game (games/muscles3d.json).
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

// Plexuses shown as "coming soon" until their JSON file exists.
export const PLEXUS_PLANNED = [
  { slug: 'brachialis', title: 'Plexus brachialis' },
  { slug: 'cervicalis', title: 'Plexus cervicalis' },
  { slug: 'lumbalis', title: 'Plexus lumbalis' },
  { slug: 'sacralis', title: 'Plexus sacralis' },
];

const LEVELS = new Set(['radix', 'truncus', 'divisio', 'fasciculus', 'ramus', 'terminalis']);

// "M. flexor digitorum profundus (radial part …)" -> "musculus flexor digitorum profundus"; "Mm. lumbricales I–II" -> "musculi lumbricales"
export function muscleKey(m) {
  return m.replace(/\(.*?\)/g, '').replace(/\b[IVX]+–[IVX]+\b/g, '')
    .replace(/^Mm\.\s*/, 'musculi ').replace(/^M\.\s*/, 'musculus ')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

export async function loadPlexuses(root, warn = () => {}) {
  const dir = path.join(root, 'games', 'plexus');
  let files = [];
  try { files = (await readdir(dir)).filter((f) => f.endsWith('.json')); } catch { return []; }
  const readJson = async (f) => JSON.parse(await readFile(f, 'utf8'));
  let plates = [];
  try { plates = (await readJson(path.join(root, 'games', 'pins.json'))).plates || []; } catch {}
  let m3d = [];
  try { m3d = (await readJson(path.join(root, 'games', 'muscles3d.json'))).regions || []; } catch {}
  const pinFor = (key) => {
    const alt = key.startsWith('musculi ') ? key.replace(/^musculi /, 'musculus ').replace(/i$/, 'us') : key;
    for (const p of plates) for (const q of p.pins || []) {
      const names = [q.answer, ...(q.also || [])].map((x) => x.toLowerCase());
      if (names.includes(key) || names.includes(alt)) return { image: p.image, title: p.title, credit: p.credit, x: q.x, y: q.y };
    }
    return null;
  };
  const regionFor = (key) => {
    for (const r of m3d) if ((r.muscles || []).some((m) => m.la.toLowerCase() === key)) return r.slug;
    return null;
  };
  const out = [];
  for (const f of files.sort()) {
    const P = await readJson(path.join(dir, f));
    const ids = new Set(P.structures.map((s) => s.id));
    for (const s of P.structures) {
      if (!LEVELS.has(s.level)) warn(`plexus ${f}: ${s.id} has unknown level ${s.level}`);
      for (const p of s.parents || []) if (!ids.has(p)) warn(`plexus ${f}: ${s.id} has unknown parent ${p}`);
      if (!s.answers || !s.answers.length) warn(`plexus ${f}: ${s.id} has no answers`);
      const figs = {};
      let region = null;
      for (const m of s.muscles || []) {
        const key = muscleKey(m);
        const fig = pinFor(key);
        if (fig) figs[m] = fig;
        region = region || regionFor(key);
      }
      if (Object.keys(figs).length) s.figs = figs;
      if (region) s.m3d = region;
    }
    out.push(P);
  }
  // brachialis first, then the planned order
  const rank = (p) => { const i = PLEXUS_PLANNED.findIndex((x) => x.slug === p.slug); return i < 0 ? 99 : i; };
  return out.sort((a, b) => rank(a) - rank(b));
}
