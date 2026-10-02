import { animate, createTimeline, scrambleText, stagger, utils } from "animejs";

export function enhance({ heroToo }) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const items = [...document.querySelectorAll("[data-enhance]")];
  const hero = heroToo ? [...document.querySelectorAll("[data-hero]")] : [];
  const eyebrow = document.querySelector("[data-eyebrow]");

  if (reduce) {
    utils.set([...items, ...hero], { opacity: 1 });
    document.documentElement.classList.add("motion-ready");
    return;
  }

  utils.set([...items, ...hero], { opacity: 0, y: 24 });
  document.documentElement.classList.add("motion-ready");
  createTimeline({ defaults: { ease: "out(4)", duration: 900 } })
    .add(hero, { opacity: 1, y: 0, delay: stagger(110) }, 0)
    .add(items, { opacity: 1, y: 0, delay: stagger(110) }, heroToo ? 200 : 0);

  if (eyebrow) {
    animate(eyebrow, {
      innerHTML: scrambleText({ text: eyebrow.textContent ?? "", chars: "uppercase", cursor: true }),
      duration: 520,
    });
  }
}
