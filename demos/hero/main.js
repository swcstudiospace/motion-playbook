import { afterPaint } from "../src/lib/env.js";
import { mountPanel } from "../src/lib/panel.js";

const bad = document.documentElement.classList.contains("bad");
document.querySelectorAll("[data-mode]").forEach((a) => a.setAttribute("aria-current", String((a.dataset.mode === "bad") === bad)));

const panel = mountPanel("First paint", { mode: bad ? "hidden until JS" : "CSS-first" });

new PerformanceObserver((list) => {
  list.getEntries().forEach((e) => {
    if (e.name === "first-contentful-paint") panel.set("FCP", `${Math.round(e.startTime)} ms`);
  });
}).observe({ type: "paint", buffered: true });

new PerformanceObserver((list) => {
  const last = list.getEntries().at(-1);
  if (last) panel.set("LCP", `${Math.round(last.startTime)} ms · ${last.element?.tagName.toLowerCase() ?? "?"}`);
}).observe({ type: "largest-contentful-paint", buffered: true });

function busy(ms) {
  const until = performance.now() + ms;
  while (performance.now() < until);
}

if (bad) {
  busy(700);
  const { enhance } = await import("./enhance.js");
  enhance({ heroToo: true });
  panel.set("enhanced", `${Math.round(performance.now())} ms`);
} else {
  const [{ enhance }] = await Promise.all([import("./enhance.js"), afterPaint()]);
  busy(700);
  enhance({ heroToo: false });
  panel.set("enhanced", `${Math.round(performance.now())} ms`);
}
