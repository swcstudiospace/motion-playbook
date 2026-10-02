import { createScope, createTimeline, createTimer, eases, onScroll, utils } from "animejs";
import { setupIdle } from "../src/lib/idle.js";
import { mountPanel } from "../src/lib/panel.js";

const COUNT = 140;
const KEYS = ["x", "y", "r", "s"];
const easeMove = eases.inOut(3);
const mode = new URLSearchParams(location.search).get("mode") === "tweens" ? "tweens" : "tracks";
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

document.querySelectorAll("[data-mode-link]").forEach((a) => a.setAttribute("aria-current", String(a.dataset.modeLink === mode)));

function seeded(n) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

const formations = {
  ring: (n, R) => {
    const a = (n / COUNT) * Math.PI * 2;
    return { x: Math.cos(a) * R, y: Math.sin(a) * R * 0.62, r: (a * 180) / Math.PI, s: 1 };
  },
  grid: (n, R) => {
    const cols = 14;
    const gap = (R * 2) / cols;
    return { x: ((n % cols) - (cols - 1) / 2) * gap, y: (Math.floor(n / cols) - 4.5) * gap, r: 0, s: 0.9 };
  },
  wave: (n, R) => {
    const t = n / (COUNT - 1);
    return { x: (t - 0.5) * R * 2.4, y: Math.sin(t * Math.PI * 4) * R * 0.35, r: t * 360, s: 0.8 + Math.sin(t * Math.PI * 4) * 0.3 };
  },
  spiral: (n, R) => {
    const a = n * 2.39996;
    const d = Math.sqrt(n / COUNT) * R;
    return { x: Math.cos(a) * d, y: Math.sin(a) * d, r: (a * 180) / Math.PI, s: 0.6 + (n / COUNT) * 0.7 };
  },
  burst: (n, R) => {
    const a = seeded(n) * Math.PI * 2;
    const d = (0.35 + seeded(n + 99) * 0.75) * R;
    return { x: Math.cos(a) * d, y: Math.sin(a) * d, r: seeded(n + 7) * 720 - 360, s: 0.5 + seeded(n + 3) };
  },
  stack: (n, R) => {
    const col = n % 7;
    const row = Math.floor(n / 7);
    const gap = R * 0.16;
    return { x: (col - 3) * gap, y: R - row * gap * 0.62, r: 0, s: 1 };
  },
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

const panel = mountPanel("Scroll scene", { mode });
setupIdle();

const root = document.getElementById("main");
const scope = createScope({ root, mediaQueries: { reduce: "(prefers-reduced-motion: reduce)" } }).add((self) => {
  const reduce = Boolean(self?.matches.reduce);
  const spine = root.querySelector("[data-spine]");
  const field = root.querySelector("[data-field]");
  const readout = root.querySelector("[data-readout]");
  const chapters = [...root.querySelectorAll("[data-formation]")];
  const names = chapters.map((c) => c.dataset.formation);

  field.replaceChildren(...Array.from({ length: COUNT }, () => Object.assign(document.createElement("i"), { className: "dot" })));
  const dots = [...field.children];
  const R = Math.min(window.innerWidth, window.innerHeight) * (window.innerWidth < 900 ? 0.36 : 0.28);
  const shapes = names.map((name) => Array.from({ length: COUNT }, (_, n) => formations[name](n, R)));
  const write = (dot, u) => {
    dot.style.transform = `translate3d(${u.x.toFixed(1)}px, ${u.y.toFixed(1)}px, 0) rotate(${u.r.toFixed(1)}deg) scale(${u.s.toFixed(3)})`;
  };
  shapes[0].forEach((u, n) => write(dots[n], u));
  readout.textContent = names[0];

  if (reduce) {
    panel.set("setup", "reduced motion · static");
    return;
  }

  const started = performance.now();
  const vh = window.innerHeight;
  const total = Math.max(1, spine.offsetHeight - vh);
  const offsets = chapters.map((c) => c.offsetTop);
  let added = 0;

  const tl = createTimeline({
    defaults: { ease: "inOut(3)" },
    autoplay: onScroll({
      target: spine,
      enter: "top top",
      leave: "bottom bottom",
      sync: 0.6,
      onUpdate: (obs) => {
        const t = obs.progress * total;
        let index = 0;
        for (let c = 0; c < offsets.length; c++) if (offsets[c] - vh * 0.5 <= t) index = c;
        if (readout.textContent !== names[index]) readout.textContent = names[index];
      },
    }),
  });
  tl.add({ duration: total }, 0);
  added += 1;

  const tracks = dots.map(() => []);
  const cursor = shapes[0].map((u) => ({ ...u }));
  const state = dots.map(() => ({ x: 0, y: 0, r: 0, s: 1 }));
  let spin = 0;

  for (let c = 1; c < chapters.length; c++) {
    const start = clamp(offsets[c] - vh * 0.95, 0, total - 2);
    const end = clamp(offsets[c] - vh * 0.2, start + 1, total);
    const span = end - start;
    const next = c + 1 < chapters.length ? clamp(offsets[c + 1] - vh * 0.95, end + 1, total) : total;

    dots.forEach((dot, n) => {
      const t0 = start + span * 0.38 * (((n * 7) % COUNT) / (COUNT - 1));
      const to = shapes[c][n];
      if (mode === "tweens") {
        tl.add(dot, { x: to.x, y: to.y, rotate: to.r, scale: to.s, duration: span * 0.62 }, t0);
        added += 1;
      } else {
        tracks[n].push({ t0, t1: t0 + span * 0.62, from: cursor[n], to });
        cursor[n] = to;
      }
    });

    spin += 24;
    tl.add(field, { rotate: spin, duration: next - end, ease: "linear" }, end);
    added += 1;
  }

  if (mode === "tweens") {
    dots.forEach((dot, n) => {
      const u = shapes[0][n];
      dot.style.transform = "";
      utils.set(dot, { x: u.x, y: u.y, rotate: u.r, scale: u.s });
    });
  }

  let frameMs = 0;
  const loop = createTimer({
    autoplay: false,
    onUpdate: () => {
      if (mode !== "tracks") return;
      const t0 = performance.now();
      const time = tl.currentTime;
      for (let n = 0; n < COUNT; n++) {
        sample(tracks[n], time, shapes[0][n], state[n]);
        write(dots[n], state[n]);
      }
      frameMs += (performance.now() - t0 - frameMs) * 0.1;
    },
  });
  onScroll({ target: spine, onEnter: () => loop.play(), onLeave: () => loop.pause() });

  panel.set("dots", COUNT);
  panel.set("animations", added);
  panel.set("setup", `${(performance.now() - started).toFixed(1)} ms`);
  const meter = mode === "tracks" ? window.setInterval(() => panel.set("frame JS", `${frameMs.toFixed(2)} ms`), 500) : 0;

  return () => window.clearInterval(meter);
});

let width = window.innerWidth;
let timer = 0;
window.addEventListener("resize", () => {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    if (Math.abs(window.innerWidth - width) < 2) return;
    width = window.innerWidth;
    scope.refresh();
  }, 220);
});
