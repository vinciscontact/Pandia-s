/**
 * Scroll-driven 3D mascot stage.
 *
 * The GLB carries one ~10 s "story" timeline (walk-in, present tray, OK flourish, spin).
 * Scroll progress through [data-story] scrubs that timeline; the mascot also slides
 * between screen sides so each chapter's text has room. Three.js is loaded lazily.
 */
import type * as THREE_NS from "three";

type Opts = { story: HTMLElement; canvas: HTMLCanvasElement; poster?: HTMLElement | null; model: string };

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (t: number) => t * t * (3 - 2 * t);
/** piecewise-linear lookup in sorted [x, y] pairs, with smoothstep inside each segment */
function curve(pts: [number, number][], x: number, ease = true) {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x0, y0] = pts[i - 1];
    if (x <= x1) {
      const t = (x - x0) / (x1 - x0 || 1);
      return y0 + (y1 - y0) * (ease ? smooth(t) : t);
    }
  }
  return pts[pts.length - 1][1];
}

// scroll progress (0..1 across the story) -> animation time in seconds
const TIME: [number, number][] = [
  [0, 2.55],
  [0.1, 3.4],
  [0.3, 5.3],
  [0.4, 5.6],
  [0.5, 6.6],
  [0.66, 7.7],
  [0.78, 8.3],
  [1, 10],
];
// progress -> horizontal side (-1 left, +1 right)
const SIDE: [number, number][] = [
  [0, 1],
  [0.08, 1],
  [0.3, -1],
  [0.4, -1],
  [0.6, 1],
  [0.72, 1],
  [0.95, -1],
  [1, -1],
];

/** hand the main thread back (taps, scrolling) between heavy setup steps */
/**
 * Room lighting (what makes the gold shine). Generating it in the browser (PMREM of three's
 * RoomEnvironment) froze the page for ~0.8 s on desktop and ~3 s on a mid phone, in one block.
 * So it is baked once into /env/room-128.webp (a PMREM "cube UV" sheet, each channel stored as
 * sqrt(v / (1 + v)) so the bright panels fit 8 bits) and expanded back here with a lookup table.
 * Re-bake: render PMREMGenerator.fromScene(new RoomEnvironment(), 0.04, 0.1, 100, { size: 128 }),
 * read it back, encode as above, flip rows to top-down, save as lossless WebP.
 */
const ENV_URL = "/env/room-128.webp";
function roomLightFrom(THREE: typeof THREE_NS, img: HTMLImageElement) {
  const { naturalWidth: w, naturalHeight: h } = img;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const px = ctx.getImageData(0, 0, w, h).data;
  const lut = new Uint16Array(256);
  for (let i = 0; i < 256; i++) {
    const t = Math.min((i / 255) ** 2, 0.9999);
    lut[i] = THREE.DataUtils.toHalfFloat(t / (1 - t));
  }
  const one = THREE.DataUtils.toHalfFloat(1);
  const data = new Uint16Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const row = (h - 1 - y) * w * 4; // image rows are top-down, texture rows bottom-up
    for (let x = 0; x < w * 4; x += 4) {
      const s = y * w * 4 + x;
      data[row + x] = lut[px[s]];
      data[row + x + 1] = lut[px[s + 1]];
      data[row + x + 2] = lut[px[s + 2]];
      data[row + x + 3] = one;
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.mapping = THREE.CubeUVReflectionMapping;
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}
/** fallback if the baked file can't load: generate it live (the slow way) */
async function liveRoomLight(THREE: typeof THREE_NS, renderer: THREE_NS.WebGLRenderer) {
  const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
  return new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
}

/** named steps show up in DevTools / Lighthouse "User Timing", to see what setup costs */
const mark = (name: string) => performance.mark("mascot:" + name);
const breathe = () =>
  (globalThis as any).scheduler?.yield?.() ?? new Promise<void>((r) => setTimeout(r, 0));

export async function initMascotStage({ story, canvas, poster, model }: Opts) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const gl = canvas.getContext("webgl2", { antialias: true, alpha: true, powerPreference: "high-performance" });
  if (!gl) return; // poster stays
  mark("start");

  // the room lighting is pre-baked (see loadRoomLight); fetch it alongside the engine
  const envImg = new Image();
  envImg.src = ENV_URL;
  const envReady = envImg.decode().then(() => true, () => false);

  const [THREE, { GLTFLoader }, { MeshoptDecoder }, { mergeGeometries }] = await Promise.all([
    import("three"),
    import("three/examples/jsm/loaders/GLTFLoader.js"),
    import("three/examples/jsm/libs/meshopt_decoder.module.js"),
    import("three/examples/jsm/utils/BufferGeometryUtils.js"),
  ]);

  mark("imports");
  await breathe();
  const mobile = () => innerWidth < 760;
  const lowEnd = (navigator.hardwareConcurrency || 8) <= 4 || ((navigator as any).deviceMemory || 8) <= 4;

  const renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.environment = (await envReady) ? roomLightFrom(THREE, envImg) : await liveRoomLight(THREE, renderer);
  scene.environmentIntensity = 0.75;
  mark("environment");
  await breathe();
  const key = new THREE.DirectionalLight(0xfff1e0, 2.2);
  key.position.set(-3, 5, 6);
  const rim = new THREE.DirectionalLight(0xffd7a8, 1.6);
  rim.position.set(3, 4, -5);
  scene.add(key, rim, new THREE.HemisphereLight(0xfff6e8, 0x5a1a12, 0.6));

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);

  // ---- load model
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(model);
  mark("model");
  await breathe();
  const root = gltf.scene;
  // glTF is Y-up; character is ~2.45 units tall with feet at y=0
  const holder = new THREE.Group();
  holder.add(root);
  scene.add(holder);

  // cartoon outline (inverted hull, constant screen thickness)
  const hullMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uColor: { value: new THREE.Color("#3a1410") }, uThick: { value: 0.0022 } },
    vertexShader: `uniform float uThick;
      void main(){
        vec3 n = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        mv.xyz += n * uThick * (-mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 uColor; void main(){ gl_FragColor = vec4(uColor, 1.0); }`,
  });
  const SKIP_OUTLINE = /Rice|Onion|Mint|Steam|Eye|Lash|Brow|Placket|Lapel|Stripe|Knob|Grain|Jewel|Ring|Hem|Trim/i;
  const steam: THREE_NS.Mesh[] = [];
  // each strand's rest pose: the compressed model keeps parts at a node scale (~0.27), so the
  // animation must scale relative to it, and keep the strand's foot on the biryani while it grows
  const steamRest = new Map<THREE_NS.Mesh, { pos: THREE_NS.Vector3; scale: THREE_NS.Vector3; foot: number }>();
  const meshes: THREE_NS.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE_NS.Mesh;
    if (!m.isMesh) return;
    meshes.push(m);
  });
  // keep a marker where the head is, in case the Head mesh itself gets merged below
  const headSrc = root.getObjectByName("Head");
  const headAnchor = new THREE.Object3D();
  if (headSrc?.parent) {
    headAnchor.position.copy(headSrc.position);
    headSrc.parent.add(headAnchor);
  }

  // ---- merge parts that move together and share a material: ~190 draw calls -> far fewer.
  // Each glTF part is its own mesh; parts on the same bone with the same material are
  // baked into one geometry (in the bone's space), so the animation is unaffected.
  // quantized (normalized int) attributes -> plain floats, with typed-array copies (no per-value calls)
  const NORM: Record<string, number> = { Int8Array: 127, Uint8Array: 255, Int16Array: 32767, Uint16Array: 65535 };
  const toFloat = (g: THREE_NS.BufferGeometry, m: THREE_NS.Matrix4) => {
    const out = new THREE.BufferGeometry();
    for (const [name, a] of Object.entries(g.attributes) as [string, THREE_NS.BufferAttribute][]) {
      let arr: Float32Array;
      if ((a as any).isInterleavedBufferAttribute) {
        arr = new Float32Array(a.count * a.itemSize);
        for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) arr[i * a.itemSize + c] = a.getComponent(i, c);
      } else {
        arr = Float32Array.from(a.array as ArrayLike<number>);
        const div = a.normalized ? NORM[a.array.constructor.name] : 0;
        if (div) for (let i = 0; i < arr.length; i++) arr[i] = Math.max(arr[i] / div, -1);
      }
      out.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize));
    }
    if (g.index) out.setIndex(new THREE.BufferAttribute((g.index.array as Uint16Array | Uint32Array).slice(), 1));
    out.applyMatrix4(m);
    return out;
  };
  const isSteam = (m: THREE_NS.Mesh) => /Steam/i.test(m.name) || /Steam/i.test((m.material as THREE_NS.Material).name);
  const outlined = (name: string) => !SKIP_OUTLINE.test(name);
  const groups = new Map<string, THREE_NS.Mesh[]>();
  for (const m of meshes) {
    if (isSteam(m) || m.children.length || !m.parent || (m as any).isSkinnedMesh || Object.keys(m.geometry.morphAttributes).length) continue;
    const key = [m.parent.uuid, (m.material as THREE_NS.Material).uuid, outlined(m.name), Object.keys(m.geometry.attributes).sort().join(), !!m.geometry.index].join("|");
    groups.set(key, [...(groups.get(key) || []), m]);
  }
  let merged_n = 0;
  for (const parts of groups.values()) {
    if (parts.length < 2) continue;
    if (++merged_n % 6 === 0) await breathe();
    const parent = parts[0].parent!;
    const geoms = parts.map((m) => (m.updateMatrix(), toFloat(m.geometry, m.matrix)));
    const merged = mergeGeometries(geoms, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, parts[0].material);
    mesh.name = parts.map((m) => m.name).join("+");
    parent.add(mesh);
    for (const m of parts) {
      parent.remove(m);
      meshes.splice(meshes.indexOf(m), 1);
    }
    meshes.push(mesh);
  }

  for (const m of meshes) {
    const mat = m.material as THREE_NS.MeshStandardMaterial;
    if (isSteam(m)) {
      // own material per strand, so each can fade on its own rhythm
      const own = mat.clone();
      own.transparent = true;
      own.opacity = 0.4;
      own.depthWrite = false;
      m.material = own;
      m.geometry.computeBoundingBox();
      steamRest.set(m, { pos: m.position.clone(), scale: m.scale.clone(), foot: m.geometry.boundingBox!.min.y });
      steam.push(m);
      continue;
    }
    if (mat.name === "Gold") {
      mat.metalness = 1;
      mat.roughness = 0.28;
    }
    // merged meshes are named "A+B+C"; outline grouping already kept outlined/non-outlined apart
    if (outlined(m.name.split("+")[0]) && m.geometry.attributes.normal) {
      const hull = new THREE.Mesh(m.geometry, hullMat);
      hull.name = m.name + "_outline";
      hull.renderOrder = -1;
      m.add(hull);
    }
  }

  // soft contact shadow
  const sc = document.createElement("canvas");
  sc.width = sc.height = 128;
  const sctx = sc.getContext("2d")!;
  const grd = sctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grd.addColorStop(0, "rgba(40,6,8,0.42)");
  grd.addColorStop(1, "rgba(40,6,8,0)");
  sctx.fillStyle = grd;
  sctx.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 1.0),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.005;
  holder.add(shadow);

  // ---- animation: all clips share one timeline
  const mixer = new THREE.AnimationMixer(root);
  for (const clip of gltf.animations) {
    const a = mixer.clipAction(clip);
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.play();
  }
  const DURATION = Math.max(...gltf.animations.map((c) => c.duration), 10);
  const chest = root.getObjectByName("Chest");
  const neck = root.getObjectByName("Neck");
  const head = headSrc?.parent ? headAnchor : neck;
  // The mixer skips writing a bone whose animated value hasn't changed, so the neck's
  // pure animated pose is kept here and the look-at is layered on top each frame
  // (rotating neck in place would accumulate and spin the head).
  const neckPose = neck ? neck.quaternion.clone() : null;
  const headMeshes: THREE_NS.Object3D[] = [];
  neck?.traverse((o) => (o as THREE_NS.Mesh).isMesh && !o.name.endsWith("_outline") && headMeshes.push(o));
  const raycaster = new THREE.Raycaster();
  const headNdc = new THREE.Vector3();

  // ---- layout
  // Pixel ratio is the biggest GPU cost (it scales every pixel of a full-screen canvas).
  // Start capped, and step down further if the device can't hold its frame rate.
  let maxDpr = lowEnd ? 1 : 1.5;
  let halfW = 1;
  let storyTop = 0;
  let storyRange = 1;
  function resize() {
    const w = canvas.clientWidth || innerWidth;
    const h = canvas.clientHeight || innerHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, maxDpr));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // fit the character to a share of the viewport height
    const share = mobile() ? 0.5 : 0.74;
    const fovR = THREE.MathUtils.degToRad(camera.fov);
    const dist = 2.75 / share / (2 * Math.tan(fovR / 2));
    camera.position.set(0, mobile() ? 1.25 - 0.62 : 1.25, dist);
    camera.lookAt(0, mobile() ? 1.25 - 0.62 : 1.2, 0);
    camera.updateProjectionMatrix();
    halfW = Math.tan(fovR / 2) * dist * camera.aspect;
    storyTop = story.getBoundingClientRect().top + scrollY;
    storyRange = Math.max(1, story.offsetHeight - innerHeight);
  }

  // ---- state
  let progress = 0;
  let tShown = 0;
  let xShown = 0;
  let introT = reduce ? 1 : 0; // 0..1 walk-in on first load
  const introStart = performance.now();
  // pointer in NDC (-1..1, y up); look angles are eased toward targets
  const ptr = { x: 0, y: 0, seen: 0 };
  let yaw = 0;
  let pitch = 0;
  let nodAt = -10;
  let visible = true;
  let lastScroll = 0;
  let sinceRender = 1;
  let slowFrames = 0;

  // geometry is cached in resize(); scrolling only reads scrollY (no forced layout)
  const readProgress = () => (progress = clamp((scrollY - storyTop) / storyRange));

  const sideX = (side: number) => {
    const m = mobile();
    if (m) return side * halfW * 0.07;
    return side * clamp(halfW * 0.6, 0.9, 3.2);
  };

  const startedAtTop = progress < 0.02;

  let lastNow = performance.now();
  let firstFrame = true;
  function frame(now: number) {
    requestAnimationFrame(frame);
    if (firstFrame) requestAnimationFrame(() => mark("first-frame-done"));
    firstFrame = false;
    const dt = Math.min(0.1, Math.max(0, (now - lastNow) / 1000));
    lastNow = now;
    if (!visible || document.hidden) return;
    readProgress();
    // frame-rate independent easing (same feel at 30, 60 or 120 fps)
    const kT = 1 - Math.exp(-dt * 7.5);
    const kX = 1 - Math.exp(-dt * 6);

    if (introT < 1) introT = startedAtTop ? clamp((now - introStart) / 2600) : 1;

    const scrollT = curve(TIME, progress);
    const targetT = introT < 1 ? 2.55 * introT : scrollT;
    tShown += (targetT - tShown) * (introT < 1 ? 1 : kT);
    const side = curve(SIDE, progress);
    const homeX = sideX(side);
    const offX = -halfW - 1.4;
    const targetX = introT < 1 ? offX + (homeX - offX) * smooth(clamp(introT * 1.05)) : homeX;
    xShown += (targetX - xShown) * (introT < 1 ? 1 : kX);

    if (neck && neckPose) neck.quaternion.copy(neckPose);
    // When nothing is being driven (no scroll, pointer, walk-in or nod) only the idle
    // breathing/steam is moving, which looks the same at 30 fps for half the work.
    const settled =
      introT >= 1 && Math.abs(targetT - tShown) < 0.002 && Math.abs(targetX - xShown) < 0.002 &&
      now / 1000 - ptr.seen > 0.4 && now - lastScroll > 300 && now / 1000 - nodAt > 1;
    sinceRender += dt;
    if (settled && sinceRender < 1 / 31) return;
    // adaptive resolution: sustained dropped frames while animating -> render fewer pixels
    if (!settled && dt > 0.024) {
      if (++slowFrames > 45 && maxDpr > 1) {
        maxDpr = Math.max(1, maxDpr - 0.25);
        slowFrames = 0;
        resize();
      }
    } else slowFrames = Math.max(0, slowFrames - 1);
    sinceRender = 0;

    mixer.setTime(clamp(tShown, 0, DURATION - 0.001));
    if (neck && neckPose) neckPose.copy(neck.quaternion);
    holder.position.x = xShown;
    // turn his body toward the chapter text (he stands on one side, the text is on the other)
    const faceText = introT < 1 || mobile() ? 0 : -side * 0.42;
    holder.rotation.y += (faceText - holder.rotation.y) * kX;

    // idle life (breathing, head follows pointer, steam)
    const s = now / 1000;
    if (!reduce) {
      if (chest) chest.scale.setScalar(1 + Math.sin(s * 2.2) * 0.012);
      if (neck && introT >= 1) {
        // look at the pointer from where his head actually is on screen
        holder.updateMatrixWorld();
        head!.getWorldPosition(headNdc).project(camera);
        const active = s - ptr.seen < 2.5;
        // strongest in the hero, calmer once the story moves on
        const gain = 1 - 0.6 * clamp((progress - 0.04) / 0.1);
        let ty: number, tp: number;
        if (active) {
          ty = clamp((ptr.x - headNdc.x) * 0.9, -1, 1) * 0.75 * gain;
          tp = clamp((headNdc.y - ptr.y) * 0.8, -1, 1) * 0.32 * gain;
        } else {
          // idle: keep an eye on the text, with a slow glance now and then
          ty = -side * 0.22 + Math.sin(s * 0.45) * 0.16 + Math.sin(s * 1.1) * 0.04;
          tp = 0.05 + Math.sin(s * 0.7 + 1) * 0.05;
        }
        const k = 1 - Math.exp(-dt * (active ? 6 : 2));
        yaw += (ty - yaw) * k;
        pitch += (tp - pitch) * k;
        const nt = s - nodAt;
        const nod = nt < 0.9 ? Math.sin(nt * Math.PI * 2.2) * 0.32 * (1 - nt / 0.9) : 0;
        neck.rotateY(yaw);
        neck.rotateX(pitch + nod);
        neck.rotateZ(-yaw * 0.18);
      }
      // steam: each strand drifts up off the rice, stretches, fades, and starts again
      steam.forEach((m, i) => {
        const rest = steamRest.get(m)!;
        const p = (s / (2.8 + i * 0.5) + i * 0.5) % 1; // 0 → 1 over one puff
        const f = 0.85 + 0.3 * p;
        (m.material as THREE_NS.Material).opacity = 0.05 + 0.4 * Math.sin(Math.PI * p);
        m.scale.set(rest.scale.x, rest.scale.y * f, rest.scale.z);
        // grow from the foot (not the middle), then lift the whole wisp a little
        m.position.y = rest.pos.y + rest.scale.y * rest.foot * (1 - f) + 0.1 * p;
        m.position.x = rest.pos.x + 0.012 * Math.sin(s * 1.6 + i * 2);
      });
    }
    renderer.render(scene, camera);
  }

  resize();
  readProgress();
  tShown = startedAtTop && !reduce ? 0 : curve(TIME, progress);
  xShown = startedAtTop && !reduce ? -halfW - 1.4 : sideX(curve(SIDE, progress));

  addEventListener("resize", resize, { passive: true });
  addEventListener("scroll", () => (lastScroll = performance.now()), { passive: true });
  const toNdc = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ptr.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
    ptr.seen = performance.now() / 1000;
  };
  addEventListener("pointermove", toNdc, { passive: true });
  document.addEventListener("pointerleave", () => (ptr.seen = 0));
  // tap / click his head: he nods back
  addEventListener("pointerdown", (e) => {
    toNdc(e);
    if (!visible || (e.target as Element).closest?.("a, button, input, select, textarea")) return;
    raycaster.setFromCamera(new THREE.Vector2(ptr.x, ptr.y), camera);
    if (raycaster.intersectObjects(headMeshes, false).length) nodAt = performance.now() / 1000;
  });
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(story);

  mark("prepared");
  // compile every shader before the first frame, off the main thread where the browser
  // supports it (KHR_parallel_shader_compile), so the first frame doesn't freeze the page
  resize();
  await breathe();
  try {
    await (renderer as any).compileAsync?.(scene, camera);
  } catch {}
  mark("compiled");
  await breathe();

  requestAnimationFrame(frame);
  canvas.classList.add("is-ready");
  poster?.classList.add("is-hidden");
}
