import { animate, createScope, onScroll, splitText, stagger, utils } from "animejs";
import { isRichPointer } from "../src/lib/env.js";
import { setupIdle } from "../src/lib/idle.js";
import { mountPanel } from "../src/lib/panel.js";

const SYNC = 0.45;
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

function passThrough(el, vh, soft) {
  const h = el.offsetHeight;
  const range = vh + h;
  const inEnd = clamp((vh * 0.3) / range, 0.04, 0.45);
  const outStart = clamp((vh * 0.82 + h) / range, inEnd + 0.08, 0.97);
  const a = inEnd * 1000;
  const b = (outStart - inEnd) * 1000;
  const c = 1000 - a - b;
  animate(el, {
    opacity: [
      { from: 0, to: 1, duration: a, ease: "out(2)" },
      { to: 1, duration: b, ease: "linear" },
      { to: 0, duration: c, ease: "in(2)" },
    ],
    y: [
      { from: 42, to: 0, duration: a, ease: "out(3)" },
      { to: 0, duration: b, ease: "linear" },
      { to: -30, duration: c, ease: "in(2)" },
    ],
    ...(soft
      ? {
          filter: [
            { from: "blur(8px)", to: "blur(0px)", duration: a, ease: "out(2)" },
            { to: "blur(0px)", duration: b, ease: "linear" },
            { to: "blur(6px)", duration: c, ease: "in(2)" },
          ],
        }
      : {}),
    autoplay: onScroll({ target: el, enter: "bottom top", leave: "top bottom", sync: SYNC }),
  });
}

const panel = mountPanel("Reveals");
setupIdle();

createScope({ root: document.getElementById("main"), mediaQueries: { reduce: "(prefers-reduced-motion: reduce)" } }).add((self) => {
  const root = document.getElementById("main");
  const reduce = Boolean(self?.matches.reduce);
  const headings = [...root.querySelectorAll("[data-split]")];
  const blocks = [...root.querySelectorAll("[data-reveal]")];
  const started = performance.now();

  if (reduce) {
    utils.set([...headings, ...blocks], { opacity: 1 });
    document.documentElement.classList.add("motion-ready");
    panel.set("mode", "reduced motion");
    return;
  }

  const soft = isRichPointer();
  const vh = window.innerHeight;
  const splits = headings.map((heading) => {
    const split = splitText(heading, { words: { wrap: "clip" } });
    utils.set(heading, { opacity: 1 });
    animate(split.words, {
      y: ["110%", "0%"],
      opacity: [0, 1],
      duration: 600,
      ease: "out(3)",
      delay: stagger(70),
      autoplay: onScroll({ target: heading, enter: "bottom top", leave: "bottom-=38% top", sync: SYNC }),
    });
    return split;
  });
  blocks.forEach((block) => passThrough(block, vh, soft));
  document.documentElement.classList.add("motion-ready");

  panel.set("mode", soft ? "desktop · soft blur" : "compact · no blur");
  panel.set("observers", headings.length + blocks.length);
  panel.set("setup", `${(performance.now() - started).toFixed(1)} ms`);

  return () => splits.forEach((s) => s.revert());
});
