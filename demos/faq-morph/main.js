import { animate, createScope, onScroll, stagger } from "animejs";
import { setupIdle } from "../src/lib/idle.js";
import { mountPanel } from "../src/lib/panel.js";

const cardOf = (cell) => cell.querySelector("details[data-faq]");
const bodyOf = (cell) => cell.querySelector("[data-faq-body]");
const clear = (el, ...props) => props.forEach((p) => el.style.removeProperty(p));

function setupFaq(root, reduce, panel) {
  const bentos = [...root.querySelectorAll("[data-bento]")].map((grid) => ({
    grid,
    cells: [...grid.querySelectorAll("[data-bento-cell]")],
    open: null,
    busy: false,
  }));

  const morph = (card, first, duration, done) => {
    const last = card.getBoundingClientRect();
    animate(card, {
      x: [first.left - last.left, 0],
      y: [first.top - last.top, 0],
      width: [first.width, last.width],
      height: [first.height, last.height],
      duration,
      ease: "out(4)",
      onComplete: () => {
        clear(card, "transform", "width", "height");
        done();
      },
    });
  };

  const open = (b, cell) => {
    const card = cardOf(cell);
    const body = bodyOf(cell);
    const others = b.cells.filter((c) => c !== cell).map(cardOf);
    b.busy = true;
    b.open = cell;

    const settle = () => {
      const first = card.getBoundingClientRect();
      const area = b.grid.offsetHeight;
      b.grid.style.minHeight = `${area}px`;
      if (!reduce) body.style.height = "0px";
      card.open = true;
      cell.classList.add("is-solo");
      b.grid.classList.add("bento--solo");
      card.style.minHeight = `${area}px`;
      panel.set("state", "open");
      if (reduce) {
        b.busy = false;
        return;
      }
      morph(card, first, 560, () => (b.busy = false));
      animate(body, {
        height: [0, body.scrollHeight],
        opacity: [0, 1],
        duration: 520,
        delay: 260,
        ease: "out(3)",
        onComplete: () => clear(body, "height"),
      });
    };

    if (reduce) return settle();
    animate(others, {
      opacity: [1, 0],
      scale: [1, 0.92],
      filter: ["blur(0px)", "blur(8px)"],
      duration: 260,
      ease: "in(2)",
      delay: stagger(35),
      onComplete: settle,
    });
  };

  const close = (b) => {
    const cell = b.open;
    if (!cell) return;
    const card = cardOf(cell);
    const body = bodyOf(cell);
    const others = b.cells.filter((c) => c !== cell).map(cardOf);
    b.busy = true;

    const restore = () => {
      const first = card.getBoundingClientRect();
      card.open = false;
      cell.classList.remove("is-solo");
      b.grid.classList.remove("bento--solo");
      clear(card, "min-height");
      clear(b.grid, "min-height");
      b.open = null;
      panel.set("state", "grid");
      if (reduce) {
        b.busy = false;
        return;
      }
      morph(card, first, 480, () => (b.busy = false));
      animate(others, {
        opacity: [0, 1],
        scale: [0.92, 1],
        filter: ["blur(8px)", "blur(0px)"],
        duration: 420,
        ease: "out(3)",
        delay: stagger(45, { start: 160 }),
        onComplete: () => others.forEach((o) => clear(o, "opacity", "transform", "filter")),
      });
    };

    if (reduce) return restore();
    animate(body, {
      height: [body.offsetHeight, 0],
      opacity: [1, 0],
      duration: 240,
      ease: "in(2)",
      onComplete: () => {
        restore();
        clear(body, "height", "opacity");
      },
    });
  };

  const offs = [];
  bentos.forEach((b) =>
    b.cells.forEach((cell) => {
      const summary = cell.querySelector("summary");
      const onClick = (e) => {
        e.preventDefault();
        if (b.busy) return;
        if (b.open === cell) close(b);
        else if (!b.open) open(b, cell);
      };
      summary.addEventListener("click", onClick);
      offs.push(() => summary.removeEventListener("click", onClick));
    }),
  );

  const onPointer = (e) => bentos.forEach((b) => b.open && !b.busy && !b.open.contains(e.target) && close(b));
  const onKey = (e) => {
    if (e.key !== "Escape") return;
    bentos.forEach((b) => {
      if (!b.open || b.busy) return;
      const summary = b.open.querySelector("summary");
      close(b);
      summary.focus();
    });
  };
  document.addEventListener("pointerdown", onPointer);
  document.addEventListener("keydown", onKey);

  return () => {
    offs.forEach((fn) => fn());
    document.removeEventListener("pointerdown", onPointer);
    document.removeEventListener("keydown", onKey);
  };
}

const panel = mountPanel("FAQ morph", { state: "grid" });
setupIdle();

const root = document.getElementById("main");
createScope({ root, mediaQueries: { reduce: "(prefers-reduced-motion: reduce)" } }).add((self) => {
  const reduce = Boolean(self?.matches.reduce);
  if (!reduce) {
    root.querySelectorAll("[data-reveal]").forEach((cell) =>
      animate(cell, {
        opacity: [0, 1],
        y: [36, 0],
        duration: 1000,
        ease: "out(3)",
        autoplay: onScroll({ target: cell, enter: "bottom top", leave: "bottom-=20% top", sync: 0.45 }),
      }),
    );
  }
  return setupFaq(root, reduce, panel);
});
