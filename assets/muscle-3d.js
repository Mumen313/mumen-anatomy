// Mumen Anatomy – 3D muscle trainer. Models: Z-Anatomy / BodyParts3D (CC BY-SA 4.0).
import * as THREE from './vendor/three.module.min.js';
import { OrbitControls } from './vendor/OrbitControls.js';

const root = document.getElementById('m3d');
const BASE = root.dataset.base;
const REGIONS = JSON.parse(document.getElementById('m3dRegions').textContent);
const $ = (s) => root.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const S = { good: () => window.MAGame?.sfx.good(), bad: () => window.MAGame?.sfx.bad() };

// ---------- answer checking ----------
const ABBR = [[/\bmusculi\b/g, 'mm'], [/\bmusculus\b/g, 'm'], [/\bmm\.?\s*/g, ''], [/\bm\.?\s+/g, '']];
function norm(s) {
  let t = String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  t = t.replace(/[–—-]/g, ' ').replace(/[^a-z\s.]/g, ' ');
  for (const [re, r] of ABBR) t = t.replace(re, r);
  return t.replace(/\./g, ' ').replace(/\s+/g, ' ').trim().replace(/^m /, '');
}
function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
function dist(x, st) { return Math.min(...[st.la, ...(st.also || [])].map((f) => lev(x, norm(f)))); }
function check(input, st) {
  const x = norm(input);
  if (!x) return 0;
  const d = dist(x, st);
  if (d === 0) return 2;
  const tol = (n) => (n > 14 ? 2 : n > 6 ? 1 : 0);
  if (d > tol(norm(st.la).length)) return 0;
  // a spelling slip only counts if no other muscle of this region is as close (externi ≠ interni)
  return R.structs.some((o) => o !== st && dist(x, o) <= d) ? 0 : 1;
}
const short = (la) => la.replace(/^Musculus /, 'M. ').replace(/^Musculi /, 'Mm. ');

// ---------- three.js scene ----------
const canvas = $('#m3dCanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08; controls.screenSpacePanning = true;
scene.add(new THREE.HemisphereLight(0xffffff, 0x3a2a24, 1.6));
const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(1, 1.5, 2); camera.add(key); scene.add(camera);
const fill = new THREE.DirectionalLight(0xffeedd, 0.5); fill.position.set(-2, -1, -1); camera.add(fill);

const MAT = {
  bone: new THREE.MeshStandardMaterial({ color: 0xe9dfc9, roughness: 0.75 }),
  muscle: new THREE.MeshStandardMaterial({ color: 0xa8473f, roughness: 0.55 }),
  done: new THREE.MeshStandardMaterial({ color: 0x8a6a5e, roughness: 0.6 }),
  target: new THREE.MeshStandardMaterial({ color: 0xf2c94c, emissive: 0x6b4d00, roughness: 0.45 }),
  hover: new THREE.MeshStandardMaterial({ color: 0xd9784e, emissive: 0x3a1500, roughness: 0.5 }),
  ok: new THREE.MeshStandardMaterial({ color: 0x4caf6e, emissive: 0x0d3a1b, roughness: 0.5 }),
  o: new THREE.MeshStandardMaterial({ color: 0xe0413a, emissive: 0x5a0d0a, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }),
  e: new THREE.MeshStandardMaterial({ color: 0x3f8ee0, emissive: 0x0a2a5a, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }),
  ghost: new THREE.MeshStandardMaterial({ color: 0xa8473f, roughness: 0.6, transparent: true, opacity: 0.12, depthWrite: false }),
};

function resize() {
  const r = canvas.parentElement.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / r.height; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas.parentElement);

let fly = null; // camera animation
function frame(box, dir, done) {
  const c = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3()).length();
  const dist = Math.max(size * 1.35, 0.12) / Math.tan((camera.fov * Math.PI) / 360) / 2 + size * 0.2;
  const d = (dir || camera.position.clone().sub(controls.target)).clone().normalize();
  fly = { t: 0, p0: camera.position.clone(), p1: c.clone().add(d.multiplyScalar(dist)), c0: controls.target.clone(), c1: c, done };
}
function tick() {
  requestAnimationFrame(tick);
  if (fly) {
    fly.t = Math.min(1, fly.t + 0.05);
    const e = 1 - Math.pow(1 - fly.t, 3);
    camera.position.lerpVectors(fly.p0, fly.p1, e); controls.target.lerpVectors(fly.c0, fly.c1, e);
    if (fly.t >= 1) { const cb = fly.done; fly = null; cb && cb(); }
  }
  controls.update(); renderer.render(scene, camera);
}

const sel = $('#m3dRegion');
// ---------- data ----------
let R = null; // current region: { meta, meshes: Map id->Mesh, structs }
async function loadRegion(slug) {
  $('#m3dLoading').hidden = false;
  if (R) { scene.remove(R.group); R.group.traverse((o) => o.geometry?.dispose()); }
  const meta = await (await fetch(`${BASE}games/3d/${slug}.json`)).json();
  const buf = await (await fetch(`${BASE}games/3d/${slug}.bin`)).arrayBuffer();
  const [x0, y0, z0, x1, y1, z1] = meta.bbox;
  const sc = 1 / Math.max(x1 - x0, y1 - y0, z1 - z0);
  const group = new THREE.Group();
  const meshes = new Map();
  for (const m of meta.meshes) {
    const dv = new DataView(buf, m.off);
    const nv = dv.getUint32(0, true), ni = dv.getUint32(4, true), big = dv.getUint32(8, true);
    const q = new Int16Array(buf, m.off + 12, nv * 3);
    const pos = new Float32Array(nv * 3);
    const G = meta.gbox, span = [G[3] - G[0], G[4] - G[1], G[5] - G[2]];
    for (let i = 0; i < nv; i++) {
      const x = G[0] + ((q[i * 3] + 32767) / 65534) * span[0];
      const y = G[1] + ((q[i * 3 + 1] + 32767) / 65534) * span[1];
      const z = G[2] + ((q[i * 3 + 2] + 32767) / 65534) * span[2];
      pos[i * 3] = (x - (x0 + x1) / 2) * sc; pos[i * 3 + 1] = (z - (z0 + z1) / 2) * sc; pos[i * 3 + 2] = -(y - (y0 + y1) / 2) * sc; // z-up -> y-up
    }
    const ioff = m.off + 12 + nv * 6;
    const idx = big ? new Uint32Array(buf.slice(ioff, ioff + ni * 4)) : new Uint16Array(buf.slice(ioff, ioff + ni * 2));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, m.kind === 'bone' ? MAT.bone : m.kind === 'o' ? MAT.o : m.kind === 'e' ? MAT.e : MAT.muscle);
    if (m.kind === 'o' || m.kind === 'e') mesh.visible = false;
    mesh.userData = { id: m.id, kind: m.kind };
    group.add(mesh); meshes.set(m.id, mesh);
  }
  scene.add(group);
  const structs = meta.structures.map((s) => ({ ...s, objs: s.ids.map((i) => meshes.get(i)).filter(Boolean) })).filter((s) => s.objs.length);
  for (const s of structs) for (const o of s.objs) o.userData.st = s;
  R = { meta, group, meshes, structs, slug };
  sel.value = slug;
  try { history.replaceState(null, '', `?region=${slug}`); } catch {}
  const box = new THREE.Box3().setFromObject(group);
  camera.position.set(0, 0, 3); controls.target.set(0, 0, 0);
  frame(box, new THREE.Vector3(...(meta.view || [0, 0.15, 1])));
  $('#m3dLoading').hidden = true;
  $('#m3dCount').textContent = `${structs.length} muscles`;
  newRound();
}

// muscles between the camera and the asked muscle become see-through
function occluders(st) {
  const occ = new Set(), cam = camera.position, v = new THREE.Vector3(), rc = new THREE.Raycaster();
  const cand = R.group.children.filter((o) => o.userData.kind === 'muscle' && o.userData.st && o.userData.st !== st);
  for (const o of st.objs) {
    const pos = o.geometry.attributes.position, step = Math.max(1, Math.floor(pos.count / 60));
    for (let i = 0; i < pos.count; i += step) {
      v.fromBufferAttribute(pos, i);
      const dir = v.clone().sub(cam), len = dir.length();
      rc.set(cam, dir.normalize()); rc.far = len - 0.002;
      for (const h of rc.intersectObjects(cand, false)) occ.add(h.object.userData.st);
    }
  }
  return occ;
}
let occ = new Set();
function side(st) { // the copy of a paired muscle that faces the camera best
  const c = (o) => new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
  const objs = st.objs.filter((o) => o.userData.kind === 'muscle');
  if (objs.length < 2) return objs;
  const right = objs.filter((o) => c(o).x < -0.002), left = objs.filter((o) => c(o).x > 0.002);
  return right.length ? right : left.length ? left : objs;
}

// ---------- game state ----------
let mode = 'type', queue = [], cur = null, score = 0, done = 0, tries = 0, hovered = null;
const card = $('#m3dCard');
function paint() {
  if (!R) return;
  const iso = $('#m3dIso').checked, bones = $('#m3dBones').checked;
  for (const o of R.meshes.values()) {
    if (o.userData.kind === 'bone') { o.visible = bones; continue; }
    if (o.userData.kind === 'o' || o.userData.kind === 'e') { o.visible = !!(cur && (cur.solved || mode === 'explore') && cur.marks.includes(o.userData.id)); continue; }
    const st = o.userData.st;
    o.visible = true;
    if (st && cur && st !== cur && mode === 'type' && !cur.solved && occ.has(st)) { o.material = MAT.ghost; continue; }
    if (st && cur && st === cur && mode !== 'explore') o.material = mode === 'find' ? (cur.solved ? MAT.ok : MAT.muscle) : cur.solved ? MAT.ok : MAT.target;
    else if (st && st === hovered) o.material = MAT.hover;
    else if (iso && cur && mode === 'type') o.material = MAT.ghost;
    else o.material = st?.solved ? MAT.done : MAT.muscle;
  }
}
function info(st, full = true) {
  if (!st) { card.hidden = true; return; }
  const i = st.info || {};
  const row = (k, v) => (v ? `<div><b>${k}</b> ${esc(v)}</div>` : '');
  const legend = st.marks?.length ? '<div class="m3-legend"><span class="o"></span>Origo <span class="e"></span>Insertio on the bone</div>' : '';
  card.innerHTML = legend + `<div class="m3-la">${esc(short(st.la))}</div><div class="m3-en">${esc(st.en || '')}</div>${full ? row('Origo', i.o) + row('Insertio', i.i) + row('Innervatio', i.n) + row('Functio', i.f) : ''}`;
  card.hidden = false;
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
function newRound() {
  for (const s of R.structs) s.solved = false;
  queue = shuffle([...R.structs]); score = 0; done = 0;
  next();
}
function next() {
  occ = new Set(); tries = 0; cur = queue.shift() || null; card.hidden = true;
  $('#m3dInput').value = ''; $('#m3dMsg').textContent = '';
  if (!cur) { $('#m3dPrompt').innerHTML = `<b>Done!</b> ${score} of ${done} right first time. <button class="btn" id="m3dAgain" type="button">Play again</button>`; $('#m3dAgain').onclick = newRound; paint(); return; }
  if (mode === 'type') {
    $('#m3dPrompt').textContent = 'Name the yellow muscle (Latin):';
    const box = new THREE.Box3(); side(cur).forEach((o) => box.expandByObject(o));
    const rc = new THREE.Box3().setFromObject(R.group).getCenter(new THREE.Vector3()), mc = box.getCenter(new THREE.Vector3());
    const out = mc.clone().sub(rc); out.y = 0;
    const view = new THREE.Vector3(...(R.meta.view || [0, 0.1, 1])).normalize();
    const dir = out.length() > 0.03 ? out.normalize().multiplyScalar(0.8).add(view.multiplyScalar(0.6)).setY(0.15) : view;
    occ = new Set(); const me = cur;
    frame(box.expandByScalar(0.05), dir, () => { if (cur === me && mode === 'type') { occ = occluders(me); paint(); } });
    $('#m3dInput').focus({ preventScroll: true });
  } else if (mode === 'find') {
    $('#m3dPrompt').innerHTML = `Click on: <b>${esc(short(cur.la))}</b>`;
  }
  $('#m3dProg').textContent = `${done} / ${R.structs.length} · ${score} ✓`;
  paint();
}
function solve(good, note = '') {
  done++; if (good && tries === 0) score++;
  cur.solved = true; paint(); info(cur);
  $('#m3dMsg').innerHTML = good ? `<span class="ok">✓ ${esc(short(cur.la))}</span> ${note}` : `<span class="bad">Answer: ${esc(short(cur.la))}</span>`;
  good ? S.good() : S.bad();
  $('#m3dProg').textContent = `${done} / ${R.structs.length} · ${score} ✓`;
  $('#m3dNext').hidden = false; $('#m3dNext').focus({ preventScroll: true });
}
$('#m3dForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!cur || cur.solved) { $('#m3dNext').hidden = true; next(); return; }
  const r = check($('#m3dInput').value, cur);
  if (r) solve(true, r === 1 ? '<span class="muted">(check the spelling)</span>' : '');
  else { tries++; S.bad(); $('#m3dMsg').innerHTML = `<span class="bad">Not quite${tries > 1 ? ' – try the hint' : ''}.</span>`; $('#m3dInput').select(); }
});
$('#m3dHint').onclick = () => { if (!cur || cur.solved) return; tries++; const la = short(cur.la); const n = Math.min(la.length, 3 + tries * 2); $('#m3dMsg').textContent = `Starts with: ${la.slice(0, n)}…`; };
$('#m3dSkip').onclick = () => { if (cur && !cur.solved) { tries = 9; solve(false); } };
$('#m3dNext').onclick = () => { $('#m3dNext').hidden = true; next(); };

// picking
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
function pick(ev) {
  const r = canvas.getBoundingClientRect();
  mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(mouse, camera);
  const hit = ray.intersectObjects(R ? R.group.children.filter((o) => o.visible && o.userData.st && o.material !== MAT.ghost) : [], false)[0];
  return hit?.object.userData.st || null;
}
let down = null;
canvas.addEventListener('pointerdown', (e) => (down = [e.clientX, e.clientY]));
canvas.addEventListener('pointermove', (e) => {
  if (mode === 'type' || e.buttons) return;
  const st = pick(e); if (st !== hovered) { hovered = st; paint(); canvas.style.cursor = st ? 'pointer' : ''; }
});
canvas.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
  const st = pick(e); if (!st) return;
  if (mode === 'explore') { cur = st; info(st); paint(); }
  else if (mode === 'find' && cur && !cur.solved) {
    if (st === cur) solve(true);
    else { tries++; S.bad(); $('#m3dMsg').innerHTML = `<span class="bad">That is ${esc(short(st.la))}.</span>`; if (tries >= 3) solve(false); }
  }
});

// controls
root.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
  mode = b.dataset.mode; root.querySelectorAll('[data-mode]').forEach((x) => x.classList.toggle('on', x === b));
  $('#m3dForm').hidden = mode !== 'type'; $('#m3dNext').hidden = true; hovered = null;
  if (mode === 'explore') { cur = null; card.hidden = true; $('#m3dPrompt').textContent = 'Turn the model and click any muscle to see its facts.'; $('#m3dMsg').textContent = ''; paint(); }
  else newRound();
}));
const VIEWS = { front: [0, 0.1, 1], back: [0, 0.1, -1], left: [-1, 0.1, 0], right: [1, 0.1, 0], top: [0, 1, 0.01] };
root.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => frame(new THREE.Box3().setFromObject(R.group), new THREE.Vector3(...VIEWS[b.dataset.view]))));
$('#m3dBones').onchange = paint; $('#m3dIso').onchange = paint;
sel.innerHTML = REGIONS.map((r) => `<option value="${r.slug}">${esc(r.title)}</option>`).join('');
sel.onchange = () => loadRegion(sel.value);
resize(); tick();
loadRegion(new URLSearchParams(location.search).get('region') || REGIONS[0].slug).catch((e) => { $('#m3dLoading').textContent = 'Could not load the model: ' + e.message; });
