"""Adds the scroll-story animation to the puppet rig and exports a web GLB.

Timeline (24 fps, frames 1-241, ~10 s):
  1-60    walk in (in place), turning from 35deg to face camera
  60-90   settle, little head tilt
  90-158  presents the biryani tray toward the viewer, leans and nods
  160-200 "perfect!" OK-hand flourish
  200-241 happy spin with a hop, back to rest pose
"""
import bpy, os, math, sys
from mathutils import Matrix, Euler, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE, "build_mascot.py")).read())
D = bpy.data
sc = bpy.context.scene
bpy.context.view_layer.update()

# 1) bake parent inverses so every node's local transform is relative to its parent
objs = [o for o in D.objects if o.users_collection and o.users_collection[0].name != "Stage"]
def depth(o):
    d = 0
    while o.parent:
        d += 1; o = o.parent
    return d
for o in sorted(objs, key=depth):
    if o.parent is not None:
        mw = o.matrix_world.copy()
        o.matrix_parent_inverse = Matrix()
        o.matrix_world = mw
bpy.context.view_layer.update()

# 2) flatten procedural colours that glTF cannot carry
def flat(name, hexcol):
    m = D.materials[name]
    nt = m.node_tree
    b = principled(m)
    for l in list(b.inputs["Base Color"].links):
        nt.links.remove(l)
    b.inputs["Base Color"].default_value = (*srgb(hexcol), 1)
flat("BiryaniBase", "#EFA42E")
flat("ChickenFry", "#A9561B")

# 3) keyframes
P = {n: D.objects[n] for n in ("Root", "Hips", "Chest", "Neck", "Shoulder.L", "Elbow.L", "Wrist.L",
                                "Shoulder.R", "Elbow.R", "Wrist.R", "Foot.L", "Foot.R")}
BASE = {}
for n, o in P.items():
    o.rotation_mode = "XYZ"
    BASE[n] = (o.location.copy(), o.rotation_euler.copy())
R = math.radians


def key(name, f, rot=(0, 0, 0), loc=(0, 0, 0)):
    o = P[name]
    bl, br = BASE[name]
    o.location = bl + Vector(loc)
    o.rotation_euler = Euler((br.x + R(rot[0]), br.y + R(rot[1]), br.z + R(rot[2])))
    o.keyframe_insert("location", frame=f)
    o.keyframe_insert("rotation_euler", frame=f)


def rest(name, *frames):
    for f in frames:
        key(name, f)


# --- walk in (two strides per foot)
for f, yaw in ((1, 35), (30, 22), (60, 0)):
    key("Root", f, rot=(0, 0, yaw))
for cyc in (0, 30):
    a = 1 + cyc
    key("Foot.L", a, loc=(0, 0.04, 0))
    key("Foot.L", a + 7, rot=(-18, 0, 0), loc=(0, -0.03, 0.10))
    key("Foot.L", a + 15, loc=(0, -0.05, 0))
    key("Foot.R", a, loc=(0, -0.05, 0))
    key("Foot.R", a + 15, loc=(0, 0.04, 0))
    key("Foot.R", a + 22, rot=(-18, 0, 0), loc=(0, -0.03, 0.10))
    for k, s in ((0, 1), (7, 1), (15, -1), (22, -1)):
        up = 0.035 if k in (7, 22) else 0.0
        key("Hips", a + k, rot=(0, 4 * s, 0), loc=(0, 0, up))
        key("Chest", a + k, rot=(0, 0, -3 * s))
        key("Neck", a + k, rot=(0, -3 * s, 0))
        key("Shoulder.R", a + k, rot=(4 * s, 0, 0))
        key("Shoulder.L", a + k, rot=(0, 3 * s, 0))
rest("Foot.L", 61, 90)
rest("Foot.R", 61, 90)

# --- settle
key("Hips", 61); key("Hips", 66, loc=(0, 0, -0.03)); key("Hips", 74)
key("Chest", 61); key("Chest", 74, rot=(-3, 0, 0)); key("Chest", 90)
key("Neck", 61); key("Neck", 76, rot=(0, 6, 0)); key("Neck", 90)
key("Shoulder.R", 61); key("Shoulder.L", 61)
key("Root", 90)

# --- present the biryani (tray toward viewer)
key("Root", 110, rot=(0, 0, -14)); key("Root", 140, rot=(0, 0, -14)); key("Root", 158)
key("Chest", 112, rot=(9, 0, 3)); key("Chest", 138, rot=(9, 0, 3)); key("Chest", 158)
key("Shoulder.R", 90); key("Shoulder.R", 112, rot=(-22, 0, -8)); key("Shoulder.R", 138, rot=(-22, 0, -8)); key("Shoulder.R", 158)
key("Elbow.R", 90); key("Elbow.R", 112, rot=(-18, 0, 0)); key("Elbow.R", 138, rot=(-18, 0, 0)); key("Elbow.R", 158)
key("Neck", 112, rot=(4, 0, 0)); key("Neck", 120, rot=(14, 0, 0)); key("Neck", 128, rot=(2, 0, 0))
key("Neck", 136, rot=(12, 0, 0)); key("Neck", 158)
key("Hips", 90); key("Hips", 112, loc=(0, -0.02, -0.02)); key("Hips", 138, loc=(0, -0.02, -0.02)); key("Hips", 158)
key("Shoulder.L", 90); key("Shoulder.L", 158)

# --- OK flourish
key("Shoulder.L", 168, rot=(0, 10, 6)); key("Shoulder.L", 192, rot=(0, 10, 6)); key("Shoulder.L", 200)
for i, f in enumerate(range(164, 194, 6)):
    key("Wrist.L", f, rot=(0, 16 if i % 2 else -10, 0))
key("Wrist.L", 1); key("Wrist.L", 158); key("Wrist.L", 200)
key("Neck", 170, rot=(-6, 10, 0)); key("Neck", 192, rot=(-6, 10, 0)); key("Neck", 200)
key("Chest", 170, rot=(0, -3, -6)); key("Chest", 192, rot=(0, -3, -6)); key("Chest", 200)
key("Root", 200)

# --- happy spin + hop
key("Root", 241, rot=(0, 0, 360))
key("Hips", 200); key("Hips", 212, loc=(0, 0, -0.04)); key("Hips", 222, loc=(0, 0, 0.09)); key("Hips", 234, loc=(0, 0, -0.03)); key("Hips", 241)
key("Foot.L", 200); key("Foot.L", 222, rot=(10, 0, 0), loc=(0, 0, 0.12)); key("Foot.L", 234); key("Foot.L", 241)
key("Foot.R", 200); key("Foot.R", 222, rot=(10, 0, 0), loc=(0, 0, 0.12)); key("Foot.R", 234); key("Foot.R", 241)
key("Shoulder.R", 200); key("Shoulder.R", 222, rot=(-6, 0, 0)); key("Shoulder.R", 241)
for n in ("Neck", "Chest", "Shoulder.L", "Wrist.L", "Elbow.R", "Elbow.L", "Wrist.R"):
    key(n, 241)
for n in ("Elbow.L", "Wrist.R"):
    key(n, 1)

sc.frame_start, sc.frame_end = 1, 241
sc.render.fps = 24
sc.frame_set(1)

out = os.environ.get("GLB_OUT", os.path.join(HERE, "final", "pandia_mascot_anim.glb"))
for o in D.objects:
    o.select_set(False)
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", export_apply=True, export_cameras=False,
                          export_lights=False, use_visible=True, export_animations=True,
                          export_animation_mode="SCENE", export_force_sampling=True,
                          export_frame_range=True, export_optimize_animation_size=True)
if os.environ.get("SAVE"):
    bpy.ops.wm.save_as_mainfile(filepath=os.environ["SAVE"])
print("ANIM GLB OK", out)
