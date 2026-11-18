# Run inside Blender:  blender -b Startup.blend --python za_export.py -- <out_dir>
# Exports Z-Anatomy (CC BY-SA 4.0) muscles + bones as compact binaries for the 3D game.
import bpy, sys, os, json, struct, re
out = sys.argv[sys.argv.index('--') + 1]
os.makedirs(os.path.join(out, 'm'), exist_ok=True)
KEEP = re.compile(r'muscul|muscle|skelet|bone|osteo|joint|articul|ligament|cartilag', re.I)
MAXTRI = 6000
def chain(coll_name):
    path = []
    for c in bpy.data.collections:
        pass
    return path
parents = {}
for c in bpy.data.collections:
    for ch in c.children: parents[ch.name] = c.name
def path_of(c):
    p = [c.name]
    while p[-1] in parents: p.append(parents[p[-1]])
    return list(reversed(p))
cat = []
deps = bpy.context.evaluated_depsgraph_get()
allnames = []
for ob in bpy.data.objects:
    colls = [path_of(c) for c in ob.users_collection]
    allnames.append({'name': ob.name, 'type': ob.type, 'colls': colls})
    if ob.type != 'MESH' or not any(KEEP.search('/'.join(p)) for p in colls):
        continue
    if re.search(r'\.(j|t|g)$', ob.name):  # label lines / text helpers
        continue
    tri = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    if tri == 0: continue
    for m in list(ob.modifiers): 
        if m.type in ('DECIMATE',): ob.modifiers.remove(m)
    if tri > MAXTRI:
        d = ob.modifiers.new('dec', 'DECIMATE'); d.ratio = MAXTRI / tri
    ev = ob.evaluated_get(bpy.context.evaluated_depsgraph_get())
    me = ev.to_mesh(); me.calc_loop_triangles()
    mw = ob.matrix_world
    vs = [mw @ v.co for v in me.vertices]
    idx = [i for t in me.loop_triangles for i in t.vertices]
    if not vs or not idx: ev.to_mesh_clear(); continue
    bb = [min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs), max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)]
    cat.append({'name': ob.name, 'colls': colls, 'nv': len(vs), 'nf': len(idx) // 3, 'bbox': [round(x, 4) for x in bb], '_v': [(v.x, v.y, v.z) for v in vs], '_i': idx})
    ev.to_mesh_clear()
G = [min(e['bbox'][i] for e in cat) for i in range(3)] + [max(e['bbox'][i + 3] for e in cat) for i in range(3)]
span = [G[i + 3] - G[i] or 1 for i in range(3)]
for n, e in enumerate(cat):
    fid = 'z%04d' % n; e['id'] = fid
    big = e['nv'] > 65535
    q = b''.join(struct.pack('<hhh', *[max(-32767, min(32767, int(round((c - G[i]) / span[i] * 65534 - 32767)))) for i, c in enumerate(p)]) for p in e.pop('_v'))
    ix = e.pop('_i')
    with open(os.path.join(out, 'm', fid + '.bin'), 'wb') as fh:
        fh.write(struct.pack('<III', e['nv'], len(ix), 1 if big else 0) + q + struct.pack('<%d%s' % (len(ix), 'I' if big else 'H'), *ix))
json.dump({'bbox': G, 'meshes': cat}, open(os.path.join(out, 'catalog.json'), 'w'), indent=0)
json.dump(allnames, open(os.path.join(out, 'all-objects.json'), 'w'))
print('EXPORTED', len(cat), 'of', len(allnames))
