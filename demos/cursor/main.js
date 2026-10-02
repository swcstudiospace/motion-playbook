import { createAnimatable, createScope, spring } from "animejs";
import { setupIdle } from "../src/lib/idle.js";
import { mountPanel } from "../src/lib/panel.js";

const panel = mountPanel("Pointer", { "move events": 0 });
setupIdle();

const root = document.getElementById("main");
createScope({ root, mediaQueries: { reduce: "(prefers-reduced-motion: reduce)", hover: "(hover: hover)" } }).add((self) => {
  if (self?.matches.reduce || !self?.matches.hover) {
    panel.set("mode", "static");
    return;
  }
  let moves = 0;
  const follower = document.querySelector("[data-follower]");
  const dot = createAnimatable(follower, { x: 500, y: 500, ease: "out(3)" });

  const magnets = [...root.querySelectorAll("[data-magnet]")].map((el) => ({
    el,
    rect: null,
    pull: createAnimatable(el, { x: 0, y: 0, ease: spring({ bounce: 0.45, duration: 650 }) }),
  }));

  const card = root.querySelector("[data-tilt]");
  const tilt = createAnimatable(card, { rotateX: 600, rotateY: 600, ease: "out(3)" });
  let cardRect = null;

  const onMove = (e) => {
    if (e.pointerType !== "mouse") return;
    moves += 1;
    follower.classList.add("is-on");
    dot.x(e.clientX).y(e.clientY);
    for (const m of magnets) {
      if (!m.rect) continue;
      const cx = m.rect.left + m.rect.width / 2;
      const cy = m.rect.top + m.rect.height / 2;
      m.pull.x((e.clientX - cx) * 0.35).y((e.clientY - cy) * 0.35);
    }
    if (cardRect) {
      const nx = (e.clientX - cardRect.left) / cardRect.width - 0.5;
      const ny = (e.clientY - cardRect.top) / cardRect.height - 0.5;
      tilt.rotateY(nx * 12).rotateX(-ny * 10);
    }
  };

  const offs = [];
  const on = (el, type, fn) => {
    el.addEventListener(type, fn);
    offs.push(() => el.removeEventListener(type, fn));
  };
  on(window, "pointermove", onMove);
  magnets.forEach((m) => {
    on(m.el, "pointerenter", () => (m.rect = m.el.getBoundingClientRect()));
    on(m.el, "pointerleave", () => {
      m.rect = null;
      m.pull.x(0).y(0);
    });
  });
  on(card, "pointerenter", () => (cardRect = card.getBoundingClientRect()));
  on(card, "pointerleave", () => {
    cardRect = null;
    tilt.rotateX(0).rotateY(0);
  });
  on(document.documentElement, "pointerleave", () => follower.classList.remove("is-on"));
  const meter = window.setInterval(() => panel.set("move events", moves), 500);

  return () => {
    window.clearInterval(meter);
    offs.forEach((fn) => fn());
  };
});
