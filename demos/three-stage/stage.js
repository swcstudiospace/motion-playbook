import { createTimeline, createTimer, eases, onScroll, stagger, utils } from "animejs";
import "animejs/adapters/three";
import {
  BoxGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Object3D,
  OctahedronGeometry,
  TorusGeometry,
} from "three";
import { createViewport } from "./viewport.js";

const COUNT = 64;
const KEYS = ["x", "y", "z", "ry"];
const easeMove = eases.inOut(3);
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const seeded = (n) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

const formations = {
  ring: (n) => {
    const a = (n / COUNT) * Math.PI * 2;
    return { x: Math.cos(a) * 4.2, y: 1.6, z: Math.sin(a) * 4.2, ry: -(a * 180) / Math.PI };
  },
  helix: (n) => {
    const a = n * 0.52;
    return { x: Math.cos(a) * 2.6, y: 0.3 + n * 0.075, z: Math.sin(a) * 2.6, ry: -(a * 180) / Math.PI };
  },
  grid: (n) => ({ x: ((n % 8) - 3.5) * 0.62, y: 0.42, z: (Math.floor(n / 8) - 3.5) * 0.62, ry: 0 }),
  cloud: (n) => {
    const t = seeded(n) * Math.PI * 2;
    const p = Math.acos(2 * seeded(n + 50) - 1);
    const r = 4 + seeded(n + 9) * 1.6;
    return { x: Math.sin(p) * Math.cos(t) * r, y: 2 + Math.cos(p) * r * 0.6, z: Math.sin(p) * Math.sin(t) * r, ry: seeded(n + 3) * 360 };
  },
};

const cameras = {
  ring: { rot: 20, pitch: -16, dist: 19 },
  helix: { rot: 110, pitch: -8, dist: 16 },
  grid: { rot: 200, pitch: -40, dist: 20 },
  cloud: { rot: 300, pitch: -14, dist: 25 },
};

function sample(track, time, base, out) {
  let seg = null;
  for (let i = track.length - 1; i >= 0; i--) {
    if (track[i].t0 <= time) {
      seg = track[i];
      break;
    }
  }
  if (!seg) {
    for (const k of KEYS) out[k] = base[k];
    return;
  }
  const p = easeMove(clamp((time - seg.t0) / Math.max(1, seg.t1 - seg.t0), 0, 1));
  for (const k of KEYS) out[k] = seg.from[k] + (seg.to[k] - seg.from[k]) * p;
}

function buildSculpture(scene) {
  const body = new MeshStandardMaterial({ color: "#efe9ff", roughness: 0.55, metalness: 0.08, flatShading: true });
  const violet = new MeshStandardMaterial({ color: "#8b5cf6", roughness: 0.5, metalness: 0.1, flatShading: true });
  const crystalMat = new MeshStandardMaterial({ color: "#c3aefc", emissive: "#7137ea", emissiveIntensity: 0.6, flatShading: true });
  const edge = new LineBasicMaterial({ color: "#5b21b6", transparent: true, opacity: 0.55 });
  const beacon = new MeshLambertMaterial({ color: "#5b21b6" });
  const root = new Group();
  scene.add(root);

  const solid = (geometry, material, parent = root) => {
    const mesh = new Mesh(geometry, material);
    mesh.add(new LineSegments(new EdgesGeometry(geometry, 24), edge));
    parent.add(mesh);
    return mesh;
  };

  solid(new CylinderGeometry(3, 3.3, 0.5, 8), body).position.y = -0.25;
  solid(new CylinderGeometry(2.4, 2.4, 0.12, 8), violet).position.y = 0.06;
  solid(new CylinderGeometry(0.42, 0.42, 3.4, 8), body).position.y = 1.8;
  const rings = new Group();
  root.add(rings);
  [1.2, 2.2, 3.1].forEach((y, n) => {
    const ring = solid(new TorusGeometry(1.6 - n * 0.25, 0.07, 6, 32), n === 1 ? violet : body, rings);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
  });
  const crystal = solid(new OctahedronGeometry(0.7), crystalMat);
  crystal.position.y = 4.3;
  [-1, 1].forEach((side) => {
    const far = new Mesh(new BoxGeometry(0.6, 0.6, 0.6), beacon);
    far.position.set(side * 11, 1, -6);
    root.add(far);
  });

  const units = new InstancedMesh(new BoxGeometry(0.3, 0.3, 0.3), violet, COUNT);
  root.add(units);
  const swarmAnchor = new Object3D();
  swarmAnchor.position.set(0, 1.6, 0);
  root.add(swarmAnchor);

  return { rings, crystal, units, anchors: { crystal, swarm: swarmAnchor } };
}

export function setupStage(root, reduce, panel) {
  const spine = root.querySelector("[data-spine]");
  const host = root.querySelector("[data-host]");
  const chapters = [...root.querySelectorAll("[data-scene]")];
  const names = chapters.map((c) => c.dataset.scene);
  const started = performance.now();

  const vp = createViewport(host);
  if (!vp) {
    panel.set("status", "no WebGL");
    return () => {};
  }
  const { rings, crystal, units, anchors } = buildSculpture(vp.scene);
  const labels = [...root.querySelectorAll("[data-label]")].map((el) => ({ el, anchor: anchors[el.dataset.label] }));
  const heights = new Map();
  const heightOf = (el) => {
    if (!heights.has(el)) heights.set(el, el.offsetHeight);
    return heights.get(el);
  };
  const onResize = () => heights.clear();
  window.addEventListener("resize", onResize);

  const first = cameras[names[0]];
  utils.set(vp.orbit, { rotateY: first.rot });
  utils.set(vp.pitch, { rotateX: first.pitch });
  utils.set(vp.camera, { z: first.dist });

  const shapes = names.map((name) => Array.from({ length: COUNT }, (_, n) => formations[name](n)));
  const state = shapes[0].map((u) => ({ ...u }));
  const pop = shapes[0].map(() => ({ s: 1 }));
  const dummy = new Object3D();
  const tracks = shapes[0].map(() => []);
  let timeline = null;
  let loop = null;
  let ready = false;
  let disposed = false;
  let last = 0;

  const writeUnits = () => {
    const t = loop ? loop.currentTime / 1000 : 0;
    for (let n = 0; n < COUNT; n++) {
      const u = state[n];
      dummy.position.set(u.x, u.y + Math.sin(t * 1.6 + n) * 0.06, u.z);
      dummy.rotation.set(0, (u.ry * Math.PI) / 180 + t * 0.4, 0);
      dummy.scale.setScalar(Math.max(0.0001, pop[n].s));
      dummy.updateMatrix();
      units.setMatrixAt(n, dummy.matrix);
    }
    units.instanceMatrix.needsUpdate = true;
  };

  const draw = () => {
    if (!ready) return;
    const now = performance.now();
    if (last) vp.adapt(now - last);
    last = now;
    if (timeline) {
      const time = timeline.currentTime;
      for (let n = 0; n < COUNT; n++) sample(tracks[n], time, shapes[0][n], state[n]);
    }
    writeUnits();
    vp.render();
    for (const { el, anchor } of labels) {
      const p = vp.project(anchor);
      el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${(p.y - heightOf(el) / 2 - 10).toFixed(1)}px, 0) translateX(-50%)`;
    }
  };

  const meter = window.setInterval(() => {
    panel.set("pixel ratio", vp.ratio.toFixed(2));
    panel.set("frame", `${vp.frameMs.toFixed(1)} ms avg`);
    panel.set("programs", vp.renderer.info.programs?.length ?? 0);
    panel.set("draw calls", vp.renderer.info.render.calls);
  }, 500);

  if (!reduce) {
    const vh = window.innerHeight;
    const total = Math.max(1, spine.offsetHeight - vh);
    const offsets = chapters.map((c) => c.offsetTop);
    const tl = createTimeline({
      defaults: { ease: "inOut(2)" },
      autoplay: onScroll({ target: spine, enter: "top top", leave: "bottom bottom", sync: 0.6 }),
    });
    tl.add({ duration: total }, 0);
    timeline = tl;
    const cursor = shapes[0].map((u) => ({ ...u }));
    let rot = first.rot;
    let spun = 0;
    for (let c = 1; c < chapters.length; c++) {
      const start = clamp(offsets[c] - vh * 0.95, 0, total - 2);
      const end = clamp(offsets[c] - vh * 0.2, start + 1, total);
      const span = end - start;
      const next = c + 1 < chapters.length ? clamp(offsets[c + 1] - vh * 0.95, end + 1, total) : total;
      const cam = cameras[names[c]];
      rot = cam.rot;
      tl.add(vp.orbit, { rotateY: rot, duration: span }, start);
      tl.add(vp.pitch, { rotateX: cam.pitch, duration: span }, start);
      tl.add(vp.camera, { z: cam.dist, duration: span }, start);
      spun += 120;
      tl.add(rings, { rotateY: spun, duration: next - end, ease: "linear" }, end);
      shapes[c].forEach((to, n) => {
        const t0 = start + span * 0.38 * (((n * 7) % COUNT) / (COUNT - 1));
        tracks[n].push({ t0, t1: t0 + span * 0.62, from: cursor[n], to });
        cursor[n] = to;
      });
    }

    loop = createTimer({ autoplay: false, onUpdate: draw });
    onScroll({ target: spine, onEnter: () => loop.play(), onLeave: () => loop.pause() });
    utils.set(vp.dolly, { z: 10 });
    pop.forEach((p) => (p.s = 0.0001));
    utils.set(crystal.position, { y: 7 });
  }

  panel.set("status", "compiling shaders");
  vp.prepare()
    .then(() => new Promise((resolve) => requestAnimationFrame(resolve)))
    .then(() => {
      if (disposed) return;
      ready = true;
      panel.set("status", `ready in ${Math.round(performance.now() - started)} ms`);
      labels.forEach(({ el }) => (el.style.opacity = "1"));
      if (reduce) {
        draw();
        return;
      }
      createTimeline({ defaults: { ease: "out(4)" } })
        .add(vp.dolly, { z: 0, duration: 2000, ease: "out(3)" }, 0)
        .add(crystal.position, { y: 4.3, duration: 1100, ease: "outBack(1.3)" }, 300)
        .add(pop, { s: 1, duration: 700, ease: "outBack(2)", delay: stagger(18) }, 700);
      draw();
    });

  return () => {
    disposed = true;
    window.clearInterval(meter);
    window.removeEventListener("resize", onResize);
    loop?.pause();
    vp.dispose();
  };
}
