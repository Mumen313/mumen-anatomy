// Packs Z-Anatomy meshes (games/za-src) into one .bin + .json per region for the 3D muscle game.
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';

export async function buildMuscle3d(root, outDir, warn = () => {}) {
  const src = path.join(root, 'games', 'za-src');
  try { await access(path.join(src, 'catalog.json')); } catch { return []; }
  const cat = JSON.parse(await readFile(path.join(src, 'catalog.json'), 'utf8'));
  const data = JSON.parse(await readFile(path.join(root, 'games', 'muscles3d.json'), 'utf8'));
  const byName = new Map(cat.meshes.map((m) => [m.name, m]));
  const isBone = (m) => m.colls.some((p) => p[0] === '1: Skeletal system');
  const bones = cat.meshes.filter(isBone);
  await mkdir(path.join(outDir, 'games', '3d'), { recursive: true });
  const out = [];
  for (const r of data.regions) {
    const used = new Map(); // id -> {m, kind}
    const structures = [];
    for (const mu of r.muscles) {
      const ids = [], marks = [];
      for (const part of mu.parts) {
        for (const side of r.side ? ['.' + r.side, ''] : ['.l', '.r', '']) {
          const m = byName.get(part + side);
          if (m) { ids.push(m.id); used.set(m.id, { m, kind: 'muscle' }); }
        }
        // origin (.o, .o1 …) and insertion (.e, .e1 …) areas painted on the bones.
        // Z-Anatomy is not consistent with the textbook here, so muscles carry a "fix" rule.
        const base = part.replace(/ muscle$/, '');
        const fx = mu.fix || {};
        if (fx.drop) continue;
        for (const m of cat.meshes) {
          const mm = m.name.match(/^(.*)\.([oe])\d*([lr]?)$/);
          if (!mm) continue;
          if (r.side && mm[3] && mm[3] !== r.side) continue;
          const whole = mm[1] === mu.en || mm[1] === mu.en + ' muscle' || (mu.parts.length === 1 && (mm[1] === part || mm[1] === base));
          if (!whole && mm[1] !== part && mm[1] !== base) continue;
          let kind = mm[2];
          if (fx.swap) kind = kind === 'o' ? 'e' : 'o';
          if (fx.partsAs && !whole) kind = fx.partsAs;
          if (fx.allAs === 'o' && kind === 'e') { const zc = (m.bbox[2] + m.bbox[5]) / 2; if (zc > 1.2) kind = 'o'; }
          if (fx.zBelow && (m.bbox[2] + m.bbox[5]) / 2 < fx.zBelow) kind = fx.kind;
          if (r.proximalOrigin && !fx.swap) {
            const own = ids.map((id) => used.get(id)?.m).filter(Boolean);
            const lo = Math.min(...own.map((x) => x.bbox[2])), hi = Math.max(...own.map((x) => x.bbox[5]));
            kind = (m.bbox[2] + m.bbox[5]) / 2 > (lo + hi) / 2 ? 'o' : 'e';
          }
          marks.push(m.id); used.set(m.id, { m, kind });
        }
      }
      if (!ids.length) { warn(`3D: no mesh for ${mu.la} (${mu.parts.join(', ')})`); continue; }
      structures.push({ la: mu.la, en: mu.en, also: mu.also, info: mu.info, ids, marks: [...new Set(marks)] });
    }
    // region box from its muscles → bones whose centre lies inside
    const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (const { m, kind } of used.values()) if (kind === 'muscle') for (let i = 0; i < 3; i++) { box[i] = Math.min(box[i], m.bbox[i]); box[i + 3] = Math.max(box[i + 3], m.bbox[i + 3]); }
    const pad = 0.02;
    for (const b of bones) {
      if (r.bones) {
        const inDiv = b.colls.some((p) => r.bones.divisions.includes(p[p.length - 1]) || r.bones.divisions.some((d) => p.includes(d)));
        const byName = new RegExp(r.bones.names).test(b.name) && (!/\.[lr]$/.test(b.name) || b.name.endsWith('.' + (r.side || 'r')));
        const sideOk = !/\.[lr]$/.test(b.name) || b.name.endsWith('.' + (r.side || 'r'));
        if ((inDiv || byName) && sideOk) used.set(b.id, { m: b, kind: 'bone' });
        continue;
      }
      const c = [0, 1, 2].map((i) => (b.bbox[i] + b.bbox[i + 3]) / 2);
      if (c.every((v, i) => v > box[i] - pad && v < box[i + 3] + pad)) used.set(b.id, { m: b, kind: 'bone' });
    }
    const parts = [], meshes = [];
    let off = 0;
    for (const [id, { kind }] of used) {
      const buf = await readFile(path.join(src, 'm', id + '.bin'));
      const padN = (4 - (buf.length % 4)) % 4;
      meshes.push({ id, off, kind });
      parts.push(buf, Buffer.alloc(padN)); off += buf.length + padN;
    }
    await writeFile(path.join(outDir, 'games', '3d', `${r.slug}.bin`), Buffer.concat(parts));
    await writeFile(path.join(outDir, 'games', '3d', `${r.slug}.json`), JSON.stringify({ slug: r.slug, title: r.title, view: r.view, gbox: cat.bbox, bbox: box, meshes, structures }));
    out.push({ slug: r.slug, title: r.title, n: structures.length, bytes: off });
  }
  return out;
}
