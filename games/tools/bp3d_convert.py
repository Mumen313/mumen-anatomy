"""Convert BodyParts3D OBJ meshes into small binary files for the 3D game.
Usage: python3 bp3d_convert.py <obj_dir> <parts_list.txt> <out_dir> [name-regex]
Writes out_dir/catalog.json and out_dir/m/<FJ id>.bin (int16 xyz quantised + uint16/uint32 indices)."""
import sys, os, re, json, glob, struct
obj_dir, plist, out = sys.argv[1], sys.argv[2], sys.argv[3]
rx = re.compile(sys.argv[4] if len(sys.argv) > 4 else r'muscle|bone|skull|mandible|vertebra|cartilage|rib|sternum|clavicle|scapula|hyoid|tendon|aponeurosis|ligament', re.I)
names = {}
for line in open(plist, encoding='utf-8', errors='replace'):
    p = line.rstrip('\n').split('\t')
    if len(p) >= 3 and p[0].startswith('FMA'):
        names.setdefault(p[0], p[2])
want = set()
ep = os.path.join(os.path.dirname(plist), 'isa_element_parts.txt')
groups = {}
if os.path.exists(ep):
    for line in open(ep, encoding='utf-8', errors='replace'):
        p = line.rstrip('\n').split('\t')
        if len(p) == 3:
            groups.setdefault(p[2], []).append(p[1])
            if p[0] in ('FMA5022', 'FMA5018', 'FMA25624', 'FMA55107', 'FMA7538'):
                want.add(p[2])
os.makedirs(os.path.join(out, 'm'), exist_ok=True)
objs = glob.glob(os.path.join(obj_dir, '**', '*.obj'), recursive=True)
print(len(objs), 'obj files')
meshes = []
G = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9]
for f in objs:
    fid = os.path.splitext(os.path.basename(f))[0]
    fma = None; v = []; idx = []; title = None
    for line in open(f, encoding='utf-8', errors='replace'):
        if line.startswith('v '):
            x, y, z = map(float, line.split()[1:4]); v.append((x, y, z))
        elif line.startswith('f '):
            t = [int(a.split('/')[0]) - 1 for a in line.split()[1:]]
            for k in range(1, len(t) - 1): idx += [t[0], t[k], t[k + 1]]
        elif line.startswith('#') and 'FMA' in line and fma is None:
            m = re.search(r'FMA\d+', line); fma = m.group(0) if m else None
            m2 = re.search(r'FMA\d+\s*[:\t ]\s*(.+)$', line.strip()); title = m2.group(1).strip() if m2 else None
    name = names.get(fma) or title or ''
    meshes.append({'id': fid, 'fma': fma, 'name': name, 'v': v, 'f': idx})
for m in meshes:
    for x, y, z in m['v']:
        G[0] = min(G[0], x); G[1] = min(G[1], y); G[2] = min(G[2], z); G[3] = max(G[3], x); G[4] = max(G[4], y); G[5] = max(G[5], z)
cat = {'bbox': G, 'meshes': []}
span = [G[3] - G[0], G[4] - G[1], G[5] - G[2]]
for m in meshes:
    if not m['v']: continue
    xs = [a[0] for a in m['v']]; ys = [a[1] for a in m['v']]; zs = [a[2] for a in m['v']]
    entry = {'id': m['id'], 'fma': m['fma'], 'name': m['name'], 'nv': len(m['v']), 'nf': len(m['f']) // 3,
             'bbox': [round(min(xs), 1), round(min(ys), 1), round(min(zs), 1), round(max(xs), 1), round(max(ys), 1), round(max(zs), 1)]}
    entry['groups'] = sorted(set(groups.get(m['id'], [])))
    if m['id'] in want or rx.search(m['name']):
        q = b''.join(struct.pack('<hhh', *[int(round((c - G[i]) / span[i] * 65534 - 32767)) for i, c in enumerate(p)]) for p in m['v'])
        big = len(m['v']) > 65535
        ib = struct.pack('<%d%s' % (len(m['f']), 'I' if big else 'H'), *m['f'])
        with open(os.path.join(out, 'm', m['id'] + '.bin'), 'wb') as fh:
            fh.write(struct.pack('<III', len(m['v']), len(m['f']), 1 if big else 0) + q + ib)
        entry['bin'] = True
    cat['meshes'].append(entry)
json.dump(cat, open(os.path.join(out, 'catalog.json'), 'w'), indent=0)
print('catalog', len(cat['meshes']), 'converted', sum(1 for e in cat['meshes'] if e.get('bin')))
