"""Cuts a heavy model (a picture-to-3D tool's GLB, tens of thousands of triangles, a 2048 picture) down to console size:
a few dozen faces and one small picture, then writes it the way the game loads models (as console-model.py does).

    <python with bpy> tools/crucible/console-prop.py <model.glb> <art dir> <name> <triangles> <picture size> <height m> [preview.png]

How: the model is stood on the floor and scaled to <height> metres; a copy is collapsed to about <triangles> triangles; the copy
gets a fresh layout and its picture is baked from the heavy model's own surface (colour only, no light), <picture size> square.
Flat neighbours are joined back into four-cornered faces. Writes <art dir>/models/<name>.json and <name>-skin.png; console-art.py
then cuts the picture to 15-bit colour. The model and its pictures are art: neither lives in the repository.
"""
import sys, os, json, math, bpy, bmesh
sys.stdout.reconfigure(line_buffering=True)
src, art, name, tris, px, height = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5]), float(sys.argv[6])
preview = sys.argv[7] if len(sys.argv) > 7 else None
out = os.path.join(art, 'models'); os.makedirs(out, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1: bpy.ops.object.join()
hi = bpy.context.view_layer.objects.active
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
# stand it on the floor, centred, <height> tall
xs, ys, zs = zip(*[v.co[:] for v in hi.data.vertices])
k, mx, my, z0 = height / (max(zs) - min(zs)), (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2, min(zs)
for v in hi.data.vertices:
    v.co.x = (v.co.x - mx) * k; v.co.y = (v.co.y - my) * k; v.co.z = (v.co.z - z0) * k
hi.data.update()
n0 = sum(len(p.vertices) - 2 for p in hi.data.polygons)

# the console copy
lo = hi.copy(); lo.data = hi.data.copy(); lo.name = 'lo'; bpy.context.scene.collection.objects.link(lo)
bpy.ops.object.select_all(action='DESELECT'); lo.select_set(True); bpy.context.view_layer.objects.active = lo
# the tool's mesh is torn at every seam of its picture: a voxel remesh closes it first, so it can be collapsed cleanly
r = lo.modifiers.new('r', 'REMESH'); r.mode = 'VOXEL'; r.voxel_size = height / 48; r.use_smooth_shade = False
bpy.ops.object.modifier_apply(modifier='r')
d = lo.modifiers.new('d', 'DECIMATE'); d.decimate_type = 'COLLAPSE'; d.ratio = min(1, tris / max(1, sum(len(p.vertices) - 2 for p in lo.data.polygons)))
bpy.ops.object.modifier_apply(modifier='d')
while lo.data.uv_layers: lo.data.uv_layers.remove(lo.data.uv_layers[0])
lo.data.uv_layers.new(name='uv')
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.03)
bpy.ops.object.mode_set(mode='OBJECT')
img = bpy.data.images.new(name + '-skin', px, px)
mat = bpy.data.materials.new('skin'); mat.use_nodes = True
tn = mat.node_tree.nodes.new('ShaderNodeTexImage'); tn.image = img
mat.node_tree.nodes.active = tn
lo.data.materials.clear(); lo.data.materials.append(mat)

# bake the heavy model's colour onto the copy's picture
scn = bpy.context.scene; scn.render.engine = 'CYCLES'; scn.cycles.device = 'CPU'; scn.cycles.samples = 4
scn.render.bake.use_selected_to_active = True; scn.render.bake.cage_extrusion = height * .06; scn.render.bake.max_ray_distance = height * .12
scn.render.bake.use_pass_direct = False; scn.render.bake.use_pass_indirect = False; scn.render.bake.use_pass_color = True; scn.render.bake.margin = 2
bpy.ops.object.select_all(action='DESELECT'); hi.select_set(True); lo.select_set(True); bpy.context.view_layer.objects.active = lo
bpy.ops.object.bake(type='DIFFUSE')
img.filepath_raw = os.path.join(out, f'{name}-skin.png'); img.file_format = 'PNG'; img.save()

# write it as the game loads it: flat faces, four corners where two triangles lie flat together and share their picture
bm = bmesh.new(); bm.from_mesh(lo.data)
bmesh.ops.join_triangles(bm, faces=bm.faces[:], angle_face_threshold=math.radians(12), angle_shape_threshold=math.radians(60), cmp_uvs=True)  # never across a seam of the picture: the face would smear it
uvl = bm.loops.layers.uv.active; faces = []
for f in bm.faces:
    if len(f.loops) > 4:
        continue
    faces.append({'p': [[round(c, 4) for c in l.vert.co] for l in f.loops], 'uv': [[round(l[uvl].uv.x, 4), round(1 - l[uvl].uv.y, 4)] for l in f.loops],
                  't': 'skin', 'n': [round(c, 3) for c in f.normal.normalized()]})
bm.free()
json.dump({'faces': faces, 'pics': {'skin': [px, px]}}, open(os.path.join(out, name + '.json'), 'w'))
print(name, 'from', n0, 'triangles to', sum(len(f['p']) - 2 for f in faces), 'in', len(faces), 'faces; corners', sorted(set(len(f['p']) for f in faces)), 'picture', px)

if preview:  # the console copy alone, its picture shown flat (no light), for a look
    import mathutils
    xs, ys, zs = zip(*[v.co[:] for v in lo.data.vertices]); size = max(max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs))
    c = mathutils.Vector(((max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2, (max(zs) + min(zs)) / 2))
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scn.collection.objects.link(cam)
    cam.location = c + mathutils.Vector((size * 1.2, -size * 2.0, size * 1.1)); cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler(); scn.camera = cam
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = size * 1.6
    hi.hide_render = True
    nt = mat.node_tree; em = nt.nodes.new('ShaderNodeEmission'); nt.links.new(tn.outputs['Color'], em.inputs['Color'])
    nt.links.new(em.outputs['Emission'], nt.nodes['Material Output'].inputs['Surface'])
    tn.interpolation = 'Closest'
    scn.world = bpy.data.worlds.new('w'); scn.world.color = (0.25, 0.25, 0.25)
    scn.render.resolution_x, scn.render.resolution_y = 320, 320; scn.cycles.samples = 4; scn.render.filepath = preview
    bpy.ops.render.render(write_still=True)
