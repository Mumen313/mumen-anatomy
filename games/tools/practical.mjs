// Practical Cadaver – encrypt / decrypt the private data bundle.
//   node games/tools/practical.mjs encrypt <password> <source.json>   → games/practical/{manifest.json,check.bin,data.bin}
//   node games/tools/practical.mjs decrypt <password> <out.json>      → readable copy (never commit it)
//   node games/tools/practical.mjs merge   <password> <labels-export.json>  → adds exported pins as checked labels
import { webcrypto as C } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const DIR = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'practical');
const [cmd, pw, file] = process.argv.slice(2);
const enc = new TextEncoder(), decd = new TextDecoder();
async function key(salt, iter) {
  const base = await C.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveKey']);
  return C.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function seal(k, bytes) { const iv = C.getRandomValues(new Uint8Array(12)); const ct = new Uint8Array(await C.subtle.encrypt({ name: 'AES-GCM', iv }, k, bytes)); const o = new Uint8Array(12 + ct.length); o.set(iv); o.set(ct, 12); return o; }
async function open(k, buf) { return new Uint8Array(await C.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, k, buf.slice(12))); }
async function load() {
  const m = JSON.parse(await readFile(path.join(DIR, 'manifest.json'), 'utf8'));
  const k = await key(Buffer.from(m.salt, 'base64'), m.iter);
  return { k, data: JSON.parse(decd.decode(await open(k, await readFile(path.join(DIR, 'data.bin'))))) };
}
async function save(data, k) { await writeFile(path.join(DIR, 'data.bin'), await seal(k, enc.encode(JSON.stringify(data)))); }
if (!pw) { console.log('usage: see top of file'); process.exit(1); }
if (cmd === 'encrypt') {
  const salt = C.getRandomValues(new Uint8Array(16)), iter = 600000; const k = await key(salt, iter);
  await writeFile(path.join(DIR, 'manifest.json'), JSON.stringify({ v: 1, kdf: 'PBKDF2-SHA256', iter, salt: Buffer.from(salt).toString('base64') }));
  await writeFile(path.join(DIR, 'check.bin'), await seal(k, enc.encode('ok')));
  await save(JSON.parse(await readFile(file, 'utf8')), k); console.log('encrypted →', DIR);
} else if (cmd === 'decrypt') {
  const { data } = await load(); await writeFile(file, JSON.stringify(data, null, 1)); console.log('decrypted →', file);
} else if (cmd === 'merge') {
  const { k, data } = await load(); const add = JSON.parse(await readFile(file, 'utf8')).labels || [];
  const id = (l) => [l.vid, l.t, l.x, l.y].join('|'); const have = new Set((data.labels ||= []).map(id));
  let n = 0; for (const l of add) if (!have.has(id(l))) { const { mine, ...rest } = l; data.labels.push(rest); n++; }
  await save(data, k); console.log('merged', n, 'labels; total', data.labels.length);
}
