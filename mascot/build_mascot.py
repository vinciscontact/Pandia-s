"""
Biryani Mascot - procedural 3D build for Blender (4.2+ / 5.x)

Run inside Blender: Scripting tab -> Open this file -> Run Script.
WARNING: it clears the current scene first.

The character is built as a "puppet rig": every body part hangs off a
pivot empty (Root > Hips > Chest > Neck / Shoulders > Elbows > Wrists),
so you can animate him by simply rotating the pivots.
"""
import bpy, bmesh, math, random
from mathutils import Vector, Matrix, Euler

random.seed(7)
C = bpy.context
D = bpy.data


# ------------------------------------------------------------------ reset
def reset_scene():
    for o in list(D.objects):
        D.objects.remove(o, do_unlink=True)
    for coll in (D.meshes, D.curves, D.materials, D.lights, D.cameras, D.textures):
        for d in list(coll):
            coll.remove(d)
    for c in list(D.collections):
        D.collections.remove(c)


reset_scene()
scene = C.scene


def new_coll(name, parent=None):
    c = D.collections.new(name)
    (parent.children if parent else scene.collection.children).link(c)
    return c


ROOTC = new_coll("Mascot")
RIG = new_coll("Rig", ROOTC)
BODY = new_coll("Body", ROOTC)
HEAD = new_coll("Head", ROOTC)
ARMS = new_coll("Arms", ROOTC)
FOOD = new_coll("Food", ROOTC)
STAGE = new_coll("Stage")


# ------------------------------------------------------------------ materials
def srgb(h):
    h = h.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


def principled(m):
    if m.node_tree is None:
        m.use_nodes = True
    for n in m.node_tree.nodes:
        if n.type == "BSDF_PRINCIPLED":
            return n
    return None


def mat(name, hexcol, rough=0.5, metal=0.0, coat=0.0, alpha=1.0, sss=0.0):
    m = D.materials.new(name)
    b = principled(m)
    b.inputs["Base Color"].default_value = (*srgb(hexcol), 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if coat:
        b.inputs["Coat Weight"].default_value = coat
    if sss:
        b.inputs["Subsurface Weight"].default_value = sss
        b.inputs["Subsurface Radius"].default_value = (1.0, 0.4, 0.25)
        b.inputs["Subsurface Scale"].default_value = 0.03
    if alpha < 1:
        b.inputs["Alpha"].default_value = alpha
    m.diffuse_color = (*srgb(hexcol), alpha)
    return m


def noise_mat(name, colors, scale=18.0, rough=0.6):
    """Base colour driven by a noise texture through a colour ramp."""
    m = mat(name, colors[0][1], rough)
    nt = m.node_tree
    b = principled(m)
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = scale
    noise.inputs["Detail"].default_value = 6
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = colors[0][0], (*srgb(colors[0][1]), 1)
    els[1].position, els[1].color = colors[-1][0], (*srgb(colors[-1][1]), 1)
    for pos, col in colors[1:-1]:
        e = els.new(pos)
        e.color = (*srgb(col), 1)
    nt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    return m


M = {
    "skin": mat("Skin", "#F8C69B", 0.45, sss=0.15),
    "skin_dark": mat("SkinShade", "#E9A877", 0.5),
    "turban": mat("TurbanRed", "#C8121B", 0.55),
    "gold": mat("Gold", "#F2B640", 0.22, metal=1.0),
    "white": mat("WhiteCloth", "#F6F2EA", 0.7),
    "shirt": mat("ShirtWhite", "#FFFFFF", 0.5),
    "jacket": mat("Jacket", "#C29B64", 0.6),
    "jacket_dk": mat("JacketDark", "#8E6A3E", 0.6),
    "black": mat("ShoeBlack", "#121212", 0.2, coat=0.6),
    "hair": mat("Hair", "#141414", 0.45),
    "button": mat("ButtonRed", "#D4141E", 0.15, coat=1.0),
    "bow": mat("BowRed", "#D3121C", 0.35),
    "mouth": mat("MouthDark", "#5C0D12", 0.6),
    "tongue": mat("Tongue", "#E2595E", 0.4),
    "towel": mat("TowelRed", "#C8121B", 0.7),
    "towel_w": mat("TowelWhite", "#F6F2EA", 0.7),
    "egg": mat("EggWhite", "#FBFAF4", 0.25, sss=0.2),
    "bone": mat("Bone", "#EFE1C2", 0.5),
    "mint": mat("Mint", "#3F9E3A", 0.45),
    "onion": mat("FriedOnion", "#7E3F17", 0.5),
    "chili": mat("Chili", "#C72A12", 0.35),
    "rice_y": mat("RiceYellow", "#F6C232", 0.4),
    "rice_w": mat("RiceWhite", "#FFF6E0", 0.4),
    "rice_o": mat("RiceOrange", "#E8862A", 0.4),
    "steam": mat("Steam", "#FFFFFF", 0.3, alpha=0.35),
}
M["mound"] = noise_mat("BiryaniBase", [(0.25, "#E07A1F"), (0.5, "#F5BE2E"), (0.75, "#FFF1CF")])
M["chicken"] = noise_mat("ChickenFry", [(0.3, "#7A3A12"), (0.55, "#B8661F"), (0.8, "#D99A3F")], 30, 0.35)


# ------------------------------------------------------------------ helpers
def smooth(me):
    for p in me.polygons:
        p.use_smooth = True


def new_obj(name, me, coll, material=None):
    o = D.objects.new(name, me)
    coll.objects.link(o)
    if material is not None:
        if isinstance(material, (list, tuple)):
            for mm in material:
                o.data.materials.append(mm)
        else:
            o.data.materials.append(material)
    return o


def place(o, loc, scale=(1, 1, 1), rot=(0, 0, 0), quat=None):
    o.location = loc
    o.scale = scale
    if quat is not None:
        o.rotation_mode = "QUATERNION"
        o.rotation_quaternion = quat
    else:
        o.rotation_euler = rot
    return o


def sphere(name, coll, material, loc, scale=(1, 1, 1), rot=(0, 0, 0), seg=40, rings=20, quat=None):
    me = D.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0)
    bm.to_mesh(me)
    bm.free()
    smooth(me)
    return place(new_obj(name, me, coll, material), loc, scale, rot, quat)


def cone(name, coll, material, loc, r1, r2, depth, scale=(1, 1, 1), rot=(0, 0, 0), seg=48):
    me = D.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg,
                          radius1=r1, radius2=r2, depth=depth)
    bm.to_mesh(me)
    bm.free()
    smooth(me)
    o = place(new_obj(name, me, coll, material), loc, scale, rot)
    # flat caps should not be smooth-shaded
    for p in o.data.polygons:
        if abs(p.normal.z) > 0.99:
            p.use_smooth = False
    return o


def box(name, coll, material, loc, size, rot=(0, 0, 0), quat=None, bevel=0.0):
    me = D.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bm.to_mesh(me)
    bm.free()
    o = place(new_obj(name, me, coll, material), loc, size, rot, quat)
    if bevel:
        md = o.modifiers.new("Bevel", "BEVEL")
        md.width = bevel
        md.segments = 3
    return o


def torus(name, coll, material, loc, R, r, rot=(0, 0, 0), scale=(1, 1, 1), quat=None, seg=64, rseg=16):
    me = D.meshes.new(name)
    verts, faces = [], []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        for j in range(rseg):
            b = 2 * math.pi * j / rseg
            verts.append(((R + r * math.cos(b)) * math.cos(a),
                          (R + r * math.cos(b)) * math.sin(a),
                          r * math.sin(b)))
    for i in range(seg):
        for j in range(rseg):
            i2, j2 = (i + 1) % seg, (j + 1) % rseg
            faces.append((i * rseg + j, i2 * rseg + j, i2 * rseg + j2, i * rseg + j2))
    me.from_pydata(verts, [], faces)
    smooth(me)
    return place(new_obj(name, me, coll, material), loc, scale, rot, quat)


def tube(name, coll, material, pts, radii, r, res=16, caps=True, end_balls=False):
    """Smooth tube through points (bezier, auto handles), converted to a mesh."""
    cu = D.curves.new(name + "_cu", "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = r
    cu.bevel_resolution = 5
    cu.use_fill_caps = caps
    cu.resolution_u = res
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(pts) - 1)
    for bp, p, rad in zip(sp.bezier_points, pts, radii):
        bp.co = Vector(p)
        bp.handle_left_type = bp.handle_right_type = "AUTO"
        bp.radius = rad
    tmp = D.objects.new(name + "_tmp", cu)
    coll.objects.link(tmp)
    dg = C.evaluated_depsgraph_get()
    me = D.meshes.new_from_object(tmp.evaluated_get(dg))
    D.objects.remove(tmp, do_unlink=True)
    D.curves.remove(cu)
    me.name = name
    smooth(me)
    o = new_obj(name, me, coll, material)
    if end_balls:
        bm = bmesh.new()
        bm.from_mesh(me)
        for idx in (0, -1):
            rr = r * radii[idx]
            g = bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=8, radius=rr)
            bmesh.ops.translate(bm, vec=Vector(pts[idx]), verts=g["verts"])
            for f in {f for v in g["verts"] for f in v.link_faces}:
                f.smooth = True
        bm.to_mesh(me)
        bm.free()
    return o


def catmull(pts, n_per=10):
    P = [Vector(p) for p in pts]
    P = [P[0] + (P[0] - P[1])] + P + [P[-1] + (P[-1] - P[-2])]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(n_per):
            t = k / n_per
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(P[-2])
    return out


def ribbon(name, coll, mats, pts, normals, width, cols=12, stripe_cols=(), thickness=0.015, widths=None):
    """Flat cloth strip following a path. normals = outward direction per control point."""
    path = catmull(pts, 10)
    nrm = catmull(normals, 10)
    wid = catmull([(w, 0, 0) for w in widths], 10) if widths else None
    verts, faces, fmat = [], [], []
    for i, p in enumerate(path):
        t = (path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]).normalized()
        side = t.cross(nrm[i].normalized()).normalized()
        w = wid[i].x if wid else width
        for c in range(cols + 1):
            verts.append(p + side * (c / cols - 0.5) * w)
    for i in range(len(path) - 1):
        for c in range(cols):
            a = i * (cols + 1) + c
            faces.append((a, a + 1, a + cols + 2, a + cols + 1))
            fmat.append(1 if c in stripe_cols else 0)
    me = D.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    smooth(me)
    o = new_obj(name, me, coll, list(mats))
    for poly, mi in zip(o.data.polygons, fmat):
        poly.material_index = mi
    sol = o.modifiers.new("Thickness", "SOLIDIFY")
    sol.thickness = thickness
    sol.offset = 0
    return o


def empty(name, loc, parent=None, size=0.06):
    e = D.objects.new(name, None)
    e.empty_display_type = "SPHERE"
    e.empty_display_size = size
    RIG.objects.link(e)
    e.location = loc
    if parent:
        set_parent(e, parent)
    return e


def set_parent(child, par):
    C.view_layer.update()
    mw = child.matrix_world.copy()
    child.parent = par
    child.matrix_parent_inverse = par.matrix_world.inverted()
    child.matrix_world = mw


def parent_all(objs, par):
    for o in objs:
        set_parent(o, par)


def front_hit(objs, x, z):
    """Ray from the front (-Y) toward +Y; returns (location, normal) of the nearest hit."""
    C.view_layer.update()
    dg = C.evaluated_depsgraph_get()
    best = None
    for o in objs:
        oe = o.evaluated_get(dg)
        mw = oe.matrix_world
        inv = mw.inverted()
        org = inv @ Vector((x, -5.0, z))
        d = (inv.to_3x3() @ Vector((0, 1, 0))).normalized()
        ok, loc, nor, _ = oe.ray_cast(org, d)
        if ok:
            wl = mw @ loc
            wn = (mw.inverted().transposed().to_3x3() @ nor).normalized()
            if best is None or wl.y < best[0].y:
                best = (wl, wn)
    return best


def on_surface(objs, x, z, out=0.0):
    loc, n = front_hit(objs, x, z)
    return loc + n * out, n


def face_quat(n):
    """Rotation turning local -Y (front) to face along normal n."""
    return Vector((0, -1, 0)).rotation_difference(n)


# ------------------------------------------------------------------ rig pivots
root = empty("Root", (0, 0, 0), size=0.3)
hips = empty("Hips", (0, 0, 0.62), root)
chest = empty("Chest", (0, 0, 1.05), hips)
neck = empty("Neck", (0, -0.02, 1.45), chest)
sh_l = empty("Shoulder.L", (0.40, 0.0, 1.30), chest)
el_l = empty("Elbow.L", (0.72, 0.0, 1.36), sh_l)
wr_l = empty("Wrist.L", (0.86, -0.06, 1.72), el_l)
sh_r = empty("Shoulder.R", (-0.40, 0.0, 1.28), chest)
el_r = empty("Elbow.R", (-0.52, -0.12, 0.98), sh_r)
wr_r = empty("Wrist.R", (-0.64, -0.42, 1.04), el_r)
foot_l = empty("Foot.L", (0.18, -0.02, 0.0), root)
foot_r = empty("Foot.R", (-0.19, -0.04, 0.0), root)

# ------------------------------------------------------------------ feet (mojari shoes)
for side, piv, sx in (("L", foot_l, 0.18), ("R", foot_r, -0.19)):
    yaw = math.radians(14 if side == "L" else -14)
    parts = []
    shoe = sphere(f"Shoe.{side}", BODY, M["black"], (sx, -0.08, 0.075), (0.115, 0.21, 0.075))
    toe_pts = [(sx, -0.22, 0.06), (sx, -0.30, 0.085), (sx, -0.335, 0.135), (sx, -0.31, 0.175), (sx, -0.275, 0.165)]
    toe = tube(f"ShoeToe.{side}", BODY, M["black"], toe_pts, [1.0, 0.75, 0.5, 0.32, 0.2], 0.05, end_balls=True)
    trim = torus(f"ShoeTrim.{side}", BODY, M["gold"], (sx, -0.06, 0.128), 0.085, 0.012, scale=(1, 1.45, 1))
    stripe = torus(f"ShoeStripe.{side}", BODY, M["gold"], (sx, -0.08, 0.05), 0.112, 0.01, scale=(1, 1.86, 1))
    heel = sphere(f"Heel.{side}", BODY, M["gold"], (sx, 0.10, 0.06), (0.05, 0.03, 0.04))
    ankle = cone(f"Ankle.{side}", BODY, M["skin"], (sx, -0.04, 0.17), 0.06, 0.065, 0.12)
    parts = [shoe, toe, trim, stripe, heel, ankle]
    parent_all(parts, piv)
    piv.rotation_euler = (0, 0, yaw)

# ------------------------------------------------------------------ dhoti
dhoti = []
for side, sx in (("L", 0.17), ("R", -0.17)):
    leg = cone(f"DhotiLeg.{side}", BODY, M["white"], (sx, 0, 0.40), 0.165, 0.22, 0.50, scale=(1, 0.92, 1))
    hem = torus(f"DhotiHem.{side}", BODY, M["gold"], (sx, 0, 0.165), 0.168, 0.013, scale=(1, 0.92, 1))
    dhoti += [leg, hem]
pleat = cone("DhotiPleat", BODY, M["white"], (0.03, -0.16, 0.36), 0.12, 0.14, 0.46, scale=(1, 0.45, 1))
pleat_edge = tube("DhotiPleatEdge", BODY, M["gold"],
                  [(0.15, -0.205, 0.59), (0.155, -0.215, 0.40), (0.15, -0.215, 0.14)], [1, 1, 1], 0.012)
dhoti += [pleat, pleat_edge]
parent_all(dhoti, hips)

# ------------------------------------------------------------------ jacket / torso
torso = sphere("Torso", BODY, M["jacket"], (0, 0, 1.02), (0.47, 0.40, 0.50))
skirt = cone("JacketSkirt", BODY, M["jacket"], (0, 0, 0.72), 0.47, 0.44, 0.32, scale=(1, 0.86, 1))
hem = torus("JacketHem", BODY, M["jacket_dk"], (0, 0, 0.565), 0.465, 0.014, scale=(1, 0.86, 1))
shoulders = [sphere(f"ShoulderPad.{s}", BODY, M["jacket"], (x, 0, 1.28), (0.16, 0.15, 0.14))
             for s, x in (("L", 0.34), ("R", -0.34))]
jacket_parts = [torso, skirt, hem] + shoulders
surf = [torso, skirt]

# buttons
for i, z in enumerate((1.17, 0.98, 0.79)):
    p, n = on_surface(surf, 0.05, z, 0.008)
    jacket_parts.append(sphere(f"Button.{i}", BODY, M["button"], p, (0.03, 0.03, 0.03)))
# placket line (front opening)
pl = [on_surface(surf, -0.015, z, 0.004)[0] for z in (1.30, 1.15, 1.0, 0.85, 0.70, 0.58)]
jacket_parts.append(tube("Placket", BODY, M["jacket_dk"], pl, [1] * len(pl), 0.007))
# chest pocket (character's left = +X)
p, n = on_surface(surf, 0.24, 1.10, 0.004)
jacket_parts.append(box("Pocket", BODY, M["jacket_dk"], p, (0.15, 0.012, 0.11), quat=face_quat(n), bevel=0.004))
p2, _ = on_surface(surf, 0.24, 1.16, 0.012)
jacket_parts.append(box("PocketSquare", BODY, M["button"], p2, (0.10, 0.012, 0.012), quat=face_quat(n)))
# lapels (V opening) + white shirt
shirt_p, shirt_n = on_surface(surf, 0.0, 1.33, -0.01)
jacket_parts.append(sphere("ShirtFront", BODY, M["shirt"], shirt_p, (0.11, 0.035, 0.10), quat=face_quat(shirt_n)))
for s in (1, -1):
    lp = [on_surface(surf, s * x, z, 0.006)[0] for x, z in ((0.13, 1.42), (0.08, 1.32), (0.02, 1.22))]
    jacket_parts.append(tube(f"Lapel.{'L' if s > 0 else 'R'}", BODY, M["jacket_dk"], lp, [1, 1, 0.8], 0.012))
collar = torus("Collar", BODY, M["shirt"], (0, -0.02, 1.44), 0.17, 0.045, scale=(1, 0.95, 1))
jacket_parts.append(collar)
# bow tie
bt = Vector((0, -0.385, 1.405))
jacket_parts += [
    sphere("BowKnot", BODY, M["bow"], bt + Vector((0, -0.02, 0)), (0.035, 0.03, 0.035)),
    sphere("BowWing.L", BODY, M["bow"], bt + Vector((0.085, 0.0, 0.0)), (0.08, 0.03, 0.06), rot=(0, math.radians(-8), 0)),
    sphere("BowWing.R", BODY, M["bow"], bt + Vector((-0.085, 0.0, 0.0)), (0.08, 0.03, 0.06), rot=(0, math.radians(8), 0)),
]

# towel draped over left shoulder (+X)
towel_pts = [(0.47, -0.30, 0.86), (0.47, -0.30, 1.05), (0.45, -0.24, 1.30), (0.42, -0.06, 1.44),
             (0.42, 0.14, 1.40), (0.46, 0.27, 1.20), (0.48, 0.28, 0.95)]
towel_n = [(0.3, -1, 0), (0.3, -1, 0), (0.3, -0.8, 0.5), (0.2, 0, 1), (0.2, 0.6, 0.8), (0.3, 1, 0), (0.3, 1, 0)]
towel = ribbon("Towel", BODY, (M["towel"], M["towel_w"]), towel_pts, towel_n, 0.20, cols=14,
               stripe_cols=(1, 12), thickness=0.02, widths=[0.24, 0.22, 0.20, 0.20, 0.20, 0.22, 0.24])
jacket_parts.append(towel)
parent_all(jacket_parts, chest)

# ------------------------------------------------------------------ head
head = sphere("Head", HEAD, M["skin"], (0, -0.02, 1.80), (0.40, 0.37, 0.40))
cheeks = [sphere(f"Cheek.{s}", HEAD, M["skin"], (x * 0.92, -0.17, 1.68), (0.165, 0.15, 0.15))
          for s, x in (("L", 0.20), ("R", -0.20))]
chin = sphere("Chin", HEAD, M["skin"], (0, -0.17, 1.57), (0.19, 0.15, 0.11))
ears = [sphere(f"Ear.{s}", HEAD, M["skin"], (x, 0.0, 1.80), (0.05, 0.08, 0.10)) for s, x in (("L", 0.39), ("R", -0.39))]
face_surf = [head] + cheeks + [chin]
hair_back = sphere("HairBack", HEAD, M["hair"], (0, 0.05, 1.90), (0.405, 0.36, 0.27))
head_parts = [head, chin, hair_back] + cheeks + ears

# nose
np_, nn = on_surface(face_surf, 0.0, 1.83, 0.02)
head_parts.append(sphere("Nose", HEAD, M["skin"], np_, (0.078, 0.07, 0.068)))
# closed happy eyes  (‿ shape) + eyebrows (⌒)
for s, x0 in (("L", 0.14), ("R", -0.14)):
    eye = [on_surface(face_surf, x0 + dx, 1.915 + dz, 0.004)[0] for dx, dz in ((-0.07, 0.02), (-0.035, -0.008), (0.0, -0.016), (0.035, -0.008), (0.07, 0.02))]
    head_parts.append(tube(f"Eye.{s}", HEAD, M["hair"], eye, [0.7, 0.95, 1, 0.95, 0.7], 0.013, end_balls=True))
    lash_base = eye[-1] if x0 > 0 else eye[0]
    lash_dir = Vector((0.03 if x0 > 0 else -0.03, -0.005, 0.012))
    head_parts.append(tube(f"Lash.{s}", HEAD, M["hair"], [lash_base, lash_base + lash_dir], [1, 0.4], 0.008))
    brow = [on_surface(face_surf, x0 + dx, 1.995 + dz, 0.006)[0] for dx, dz in ((-0.085, -0.012), (0.0, 0.018), (0.085, -0.004))]
    head_parts.append(tube(f"Brow.{s}", HEAD, M["hair"], brow, [0.55, 1, 0.5], 0.024, end_balls=True))
    # sideburn
    head_parts.append(sphere(f"Sideburn.{s}", HEAD, M["hair"], (x0 * 2.62, -0.07, 1.93), (0.035, 0.06, 0.07)))

# mouth (open smile)
mp, mn = on_surface(face_surf, 0.02, 1.655, -0.006)
head_parts.append(sphere("Mouth", HEAD, M["mouth"], mp, (0.10, 0.04, 0.058), quat=face_quat(mn)))
tp, tn = on_surface(face_surf, 0.025, 1.625, 0.004)
head_parts.append(sphere("Tongue", HEAD, M["tongue"], tp, (0.06, 0.03, 0.026), quat=face_quat(tn)))
lip = [on_surface(face_surf, x, z, 0.0)[0] for x, z in ((-0.06, 1.66), (0.02, 1.585), (0.10, 1.66))]
head_parts.append(tube("LowerLip", HEAD, M["skin_dark"], lip, [0.6, 1, 0.6], 0.012))

# handlebar mustache
for s in (1, -1):
    prof = [(0.0, 1.755, 1.0), (0.10, 1.735, 1.0), (0.20, 1.745, 0.85), (0.27, 1.79, 0.6),
            (0.29, 1.855, 0.38), (0.25, 1.885, 0.24), (0.215, 1.86, 0.14)]
    pts = []
    for i, (x, z, rad) in enumerate(prof):
        if i < 4:
            p, _ = on_surface(face_surf, s * x, z, 0.055 * rad * 0.7)
        else:   # the curl lifts off the cheek
            p0, _ = on_surface(face_surf, s * x, z, 0.0)
            p = p0 + Vector((0, -0.05, 0))
        pts.append(p)
    head_parts.append(tube(f"Mustache.{'L' if s > 0 else 'R'}", HEAD, M["hair"], pts,
                           [p[2] for p in prof], 0.058, end_balls=True))

# turban
tz = 2.10
turban = [
    cone("TurbanBase", HEAD, M["turban"], (0, 0.0, tz + 0.10), 0.415, 0.43, 0.22, scale=(1, 0.97, 1)),
    sphere("TurbanDome", HEAD, M["turban"], (0, 0.01, tz + 0.21), (0.42, 0.41, 0.17)),
    sphere("TurbanCrest", HEAD, M["turban"], (0.0, 0.0, tz + 0.30), (0.13, 0.36, 0.12)),
]
for i, (z, rx, ry) in enumerate(((tz + 0.02, 6, -4), (tz + 0.10, -5, 5), (tz + 0.18, 7, -3))):
    turban.append(torus(f"TurbanWrap.{i}", HEAD, M["turban"], (0, 0, z), 0.415, 0.06,
                        rot=(math.radians(rx), math.radians(ry), 0), scale=(1, 0.97, 1)))
turban.append(torus("TurbanGold", HEAD, M["gold"], (0, 0, tz + 0.07), 0.47, 0.016,
                    rot=(math.radians(-10), math.radians(4), 0), scale=(1, 0.95, 1)))
turban.append(torus("TurbanWhite", HEAD, M["towel_w"], (0, 0, tz + 0.15), 0.468, 0.02,
                    rot=(math.radians(9), math.radians(-6), 0), scale=(1, 0.95, 1)))
turban.append(tube("CrestStripe", HEAD, M["towel_w"],
                   [(0.0, -0.36, tz + 0.27), (0.0, -0.18, tz + 0.40), (0.0, 0.1, tz + 0.41), (0.0, 0.34, tz + 0.28)],
                   [1, 1, 1, 1], 0.02))
turban.append(sphere("TurbanJewel", HEAD, M["gold"], (0.0, -0.395, tz + 0.27), (0.04, 0.03, 0.04)))
turban.append(torus("JewelRing", HEAD, M["gold"], (0.0, -0.40, tz + 0.27), 0.04, 0.008,
                    rot=(math.radians(90), 0, 0)))
# turban tail hanging at the back (screen-left side)
tail_pts = [(-0.22, 0.30, 2.05), (-0.34, 0.30, 1.85), (-0.40, 0.24, 1.62), (-0.42, 0.20, 1.40)]
tail_n = [(-0.4, 1, 0), (-0.6, 1, 0), (-0.8, 0.6, 0), (-0.8, 0.6, 0)]
turban.append(ribbon("TurbanTail", HEAD, (M["turban"], M["towel_w"]), tail_pts, tail_n, 0.16, cols=10,
                     stripe_cols=(1, 8), thickness=0.02, widths=[0.14, 0.16, 0.18, 0.18]))
head_parts += turban
parent_all(head_parts, neck)


# ------------------------------------------------------------------ arms
def arm(side, sh, el, wr):
    s = sh.location.copy() if sh.parent is None else sh.matrix_world.translation.copy()
    C.view_layer.update()
    s, e, w = sh.matrix_world.translation.copy(), el.matrix_world.translation.copy(), wr.matrix_world.translation.copy()
    upper = tube(f"UpperArm.{side}", ARMS, M["jacket"], [s, s.lerp(e, 0.5), e], [1.0, 0.95, 0.9], 0.125)
    set_parent(upper, sh)
    elbow = sphere(f"ElbowBall.{side}", ARMS, M["jacket"], e, (0.112, 0.112, 0.112))
    fore = tube(f"Forearm.{side}", ARMS, M["jacket"], [e, e.lerp(w, 0.5), w], [1.0, 0.95, 0.9], 0.112)
    parent_all([elbow, fore], el)
    d = (w - e).normalized()
    q = Vector((0, 0, 1)).rotation_difference(d)
    cuff = torus(f"Cuff.{side}", ARMS, M["button"], w - d * 0.03, 0.098, 0.032, quat=q)
    cuff_g = torus(f"CuffGold.{side}", ARMS, M["gold"], w - d * 0.065, 0.104, 0.012, quat=q)
    sleeve_w = torus(f"CuffShirt.{side}", ARMS, M["shirt"], w + d * 0.005, 0.08, 0.02, quat=q)
    parent_all([cuff, cuff_g, sleeve_w], wr)


arm("L", sh_l, el_l, wr_l)
arm("R", sh_r, el_r, wr_r)

# ---- left hand: "OK / perfect!" gesture, palm toward viewer
C.view_layer.update()
W = wr_l.matrix_world.translation.copy()
hand_l = []
hand_l.append(sphere("Palm.L", ARMS, M["skin"], W + Vector((0.0, -0.01, 0.10)), (0.085, 0.045, 0.095)))
for name, bx, length, fan in (("Middle", 0.0, 0.15, -4), ("Ring", 0.045, 0.14, 8), ("Pinky", 0.082, 0.10, 20)):
    a = math.radians(fan)
    base = W + Vector((bx, -0.01, 0.17))
    mid = base + Vector((math.sin(a) * length * 0.55, 0.005, math.cos(a) * length * 0.55))
    tip = base + Vector((math.sin(a) * length, 0.03, math.cos(a) * length * 0.95))
    rr = 0.026 if name != "Pinky" else 0.022
    hand_l.append(tube(f"{name}.L", ARMS, M["skin"], [base, mid, tip], [1, 0.95, 0.9], rr, end_balls=True))
ring_c = W + Vector((-0.095, -0.03, 0.175))
hand_l.append(torus("OKRing.L", ARMS, M["skin"], ring_c, 0.042, 0.024, rot=(math.radians(90), math.radians(25), 0)))
hand_l.append(tube("Thumb.L", ARMS, M["skin"], [W + Vector((-0.05, -0.02, 0.06)), W + Vector((-0.09, -0.035, 0.10)),
                                                ring_c + Vector((0.0, 0, -0.04))], [1.1, 1.0, 0.9], 0.03, end_balls=True))
hand_l.append(tube("IndexBase.L", ARMS, M["skin"], [W + Vector((-0.045, -0.015, 0.18)), ring_c + Vector((0.035, 0, 0.03))],
                   [1, 0.95], 0.026, end_balls=True))
hnd_l = empty("Hand.L", W, wr_l)
parent_all(hand_l, hnd_l)
hnd_l.scale = (1.35, 1.35, 1.35)
wr_l.rotation_euler = (0, math.radians(-10), 0)

# ---- right hand: palm up under the tray
C.view_layer.update()
W = wr_r.matrix_world.translation.copy()
hand_r = [sphere("Palm.R", ARMS, M["skin"], W + Vector((-0.02, -0.10, 0.02)), (0.095, 0.11, 0.042), rot=(math.radians(-10), 0, 0))]
for i, fx in enumerate((-0.07, -0.025, 0.02, 0.06)):
    b = W + Vector((fx - 0.02, -0.19, 0.03))
    hand_r.append(tube(f"FingerR.{i}", ARMS, M["skin"], [b, b + Vector((0, -0.05, 0.015)), b + Vector((0, -0.07, 0.05))],
                       [1, 0.95, 0.9], 0.024, end_balls=True))
hand_r.append(tube("Thumb.R", ARMS, M["skin"], [W + Vector((0.06, -0.08, 0.03)), W + Vector((0.10, -0.13, 0.06)),
                                                W + Vector((0.11, -0.17, 0.09))], [1, 0.95, 0.9], 0.028, end_balls=True))
hnd_r = empty("Hand.R", W, wr_r)
parent_all(hand_r, hnd_r)
hnd_r.scale = (1.25, 1.25, 1.25)

# ------------------------------------------------------------------ biryani tray
tray = empty("Tray", (-0.70, -0.66, 1.14), size=0.15)
tray.rotation_euler = (math.radians(16), 0, math.radians(8))
food = []


def local(o):
    o.parent = tray
    o.matrix_parent_inverse = Matrix()
    food.append(o)
    return o


local(cone("TrayDish", FOOD, M["gold"], (0, 0, 0.0), 0.38, 0.48, 0.05, scale=(1, 0.68, 1)))
local(torus("TrayRim", FOOD, M["gold"], (0, 0, 0.025), 0.48, 0.022, scale=(1, 0.68, 1)))
mound = local(sphere("BiryaniMound", FOOD, M["mound"], (0, 0.02, 0.02), (0.38, 0.24, 0.15), seg=64, rings=32))
tex = D.textures.new("RiceBumps", "CLOUDS")
tex.noise_scale = 0.06
disp = mound.modifiers.new("Bumps", "DISPLACE")
disp.texture = tex
disp.strength = 0.025
disp.mid_level = 0.5


def scatter(name, mats, weights, n, size, a, b, c, center, zmin=0.18, lift=0.0, seg=(6, 4)):
    bm = bmesh.new()
    me = D.meshes.new(name)
    for _ in range(n):
        while True:
            v = Vector((random.gauss(0, 1), random.gauss(0, 1), abs(random.gauss(0, 1)))).normalized()
            if v.z > zmin:
                break
        k = random.uniform(0.97, 1.04)
        p = Vector((a * v.x * k, b * v.y * k, c * v.z * k)) + Vector(center)
        nrm = Vector((v.x / a, v.y / b, v.z / c)).normalized()
        t = nrm.cross(Vector((random.uniform(-1, 1), random.uniform(-1, 1), random.uniform(-1, 1)))).normalized()
        g = bmesh.ops.create_uvsphere(bm, u_segments=seg[0], v_segments=seg[1], radius=1.0)
        basis = Matrix((t, nrm.cross(t), nrm)).transposed().to_4x4()
        Mx = Matrix.Translation(p + nrm * lift) @ basis @ Matrix.Diagonal((*size, 1))
        bmesh.ops.transform(bm, matrix=Mx, verts=g["verts"])
        mi = random.choices(range(len(mats)), weights)[0]
        for f in {f for vv in g["verts"] for f in vv.link_faces}:
            f.material_index = mi
            f.smooth = True
    bm.to_mesh(me)
    bm.free()
    return local(new_obj(name, me, FOOD, list(mats)))


MC = (0, 0.02, 0.02)
scatter("RiceGrains", (M["rice_y"], M["rice_w"], M["rice_o"]), (0.5, 0.35, 0.15), 2600,
        (0.012, 0.0038, 0.0038), 0.385, 0.245, 0.155, MC)
scatter("FriedOnions", (M["onion"], M["chili"]), (0.8, 0.2), 70, (0.02, 0.008, 0.004), 0.39, 0.25, 0.16, MC, zmin=0.3)
scatter("MintLeaves", (M["mint"],), (1,), 12, (0.038, 0.02, 0.004), 0.39, 0.25, 0.165, MC, zmin=0.35, seg=(12, 6))

# chicken drumstick
leg = local(sphere("Drumstick", FOOD, M["chicken"], (-0.12, 0.04, 0.165), (0.14, 0.08, 0.08), rot=(0, math.radians(-12), math.radians(18))))
lt = D.textures.new("Crispy", "CLOUDS")
lt.noise_scale = 0.03
dd = leg.modifiers.new("Crispy", "DISPLACE")
dd.texture = lt
dd.strength = 0.012
local(tube("DrumBone", FOOD, M["bone"], [(-0.02, 0.07, 0.195), (0.04, 0.09, 0.22), (0.07, 0.10, 0.235)], [1, 0.9, 0.9], 0.018))
local(sphere("BoneKnob.0", FOOD, M["bone"], (0.08, 0.09, 0.245), (0.026, 0.026, 0.026)))
local(sphere("BoneKnob.1", FOOD, M["bone"], (0.075, 0.115, 0.23), (0.026, 0.026, 0.026)))
# boiled egg
local(sphere("Egg", FOOD, M["egg"], (0.15, -0.12, 0.105), (0.09, 0.07, 0.065), rot=(0, 0, math.radians(-15))))

# steam
for i, (x, y) in enumerate(((-0.20, 0.0), (-0.06, 0.06))):
    pts = [(x, y, 0.22), (x - 0.05, y, 0.36), (x + 0.03, y, 0.50), (x - 0.04, y, 0.64), (x + 0.02, y, 0.76)]
    s = local(tube(f"Steam.{i}", FOOD, M["steam"], pts, [1.0, 1.3, 1.1, 0.8, 0.3], 0.022 - i * 0.005))
    s.matrix_parent_inverse = Matrix()

set_parent(tray, wr_r)

# ------------------------------------------------------------------ pose tweaks
neck.rotation_euler = (math.radians(-8), math.radians(9), 0)
chest.rotation_euler = (0, math.radians(2), math.radians(-6))

# ------------------------------------------------------------------ stage
cam_data = D.cameras.new("Camera")
cam_data.lens = 82
cam = D.objects.new("Camera", cam_data)
STAGE.objects.link(cam)
cam.location = (-1.7, -6.3, 1.9)
target = D.objects.new("CamTarget", None)
STAGE.objects.link(target)
target.location = (0.0, -0.1, 1.22)
tc = cam.constraints.new("TRACK_TO")
tc.target = target
tc.track_axis = "TRACK_NEGATIVE_Z"
tc.up_axis = "UP_Y"
scene.camera = cam


def area(name, loc, energy, size, color=(1, 1, 1)):
    ld = D.lights.new(name, "AREA")
    ld.energy = energy
    ld.size = size
    ld.color = color
    lo = D.objects.new(name, ld)
    STAGE.objects.link(lo)
    lo.location = loc
    c = lo.constraints.new("TRACK_TO")
    c.target = target
    c.track_axis = "TRACK_NEGATIVE_Z"
    c.up_axis = "UP_Y"
    return lo


area("KeyLight", (-3.0, -4.5, 4.5), 520, 3.0, (1.0, 0.97, 0.92))
area("FillLight", (4.0, -3.5, 1.8), 160, 4.0, (0.92, 0.95, 1.0))
area("RimLight", (2.0, 4.0, 4.0), 600, 2.5)

world = D.worlds.get("World") or D.worlds.new("World")
scene.world = world
try:
    world.use_nodes = True
except Exception:
    pass
bg = world.node_tree.nodes.get("Background")
if bg:
    bg.inputs[0].default_value = (0.9, 0.9, 0.92, 1)
    bg.inputs[1].default_value = 0.35

scene.view_settings.view_transform = "Standard"
scene.frame_start, scene.frame_end = 1, 120

print("Biryani mascot built:", len([o for o in D.objects if o.type == 'MESH']), "mesh parts")
