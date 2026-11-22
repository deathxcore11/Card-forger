"""Reads a model already built to console size (a few dozen faces, pictures of 64 or 128 pixels) and writes it the way
the game loads it, as a 1990s game kept its models: a list of flat faces with texture coordinates, and its pictures.

    <python with bpy> tools/crucible/console-model.py <model.glb> <art dir> <name>

Writes <art dir>/models/<name>.json and <art dir>/models/<name>-<picture>.png. tools/crucible/console-art.py then snaps the
pictures to 15-bit colour into art/c/ and lists the model in art/c/index.json ("models"). Triangles that share an edge
and lie flat are joined back into four-cornered faces; the model's units are kept (Blender's: Z up, metres).
The model and its pictures are art: neither lives in the repository.
"""
import sys, os, json, bpy, bmesh, re
sys.stdout.reconfigure(line_buffering=True)
src, art, name = sys.argv[1], sys.argv[2], sys.argv[3]
out = os.path.join(art, 'models'); os.makedirs(out, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
key = lambda s: re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')
pics, faces = {}, []
for o in bpy.context.scene.objects:
    if o.type != 'MESH':
        continue
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.join_triangles(bm, faces=bm.faces[:], angle_face_threshold=0.01, angle_shape_threshold=3.15, cmp_uvs=True)
    uvl = bm.loops.layers.uv.active
    for f in bm.faces:
        mat = o.material_slots[f.material_index].material if o.material_slots else None
        img = None
        if mat and mat.use_nodes:
            img = next((n.image for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image), None)
        t = key(img.name) if img else None
        if img and t not in pics:
            img.filepath_raw = os.path.join(out, f'{name}-{t}.png'); img.file_format = 'PNG'; img.save()
            pics[t] = list(img.size)
        n = o.matrix_world.to_3x3() @ f.normal
        faces.append({'p': [[round(c, 4) for c in (o.matrix_world @ l.vert.co)] for l in f.loops],
                      'uv': [[round(l[uvl].uv.x, 4), round(1 - l[uvl].uv.y, 4)] for l in f.loops] if uvl else None,
                      't': t, 'n': [round(c, 3) for c in n.normalized()]})
    bm.free()
json.dump({'faces': faces, 'pics': pics}, open(os.path.join(out, name + '.json'), 'w'))
print('model', name, len(faces), 'faces', sum(len(f['p']) - 2 for f in faces), 'triangles', pics)
print('corners per face', sorted(set(len(f['p']) for f in faces)), 'uv range', min(min(u for u, v in f['uv']) for f in faces if f['uv']), max(max(u for u, v in f['uv']) for f in faces if f['uv']))
