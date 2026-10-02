import { engine } from "animejs";

const WAKE = ["scroll", "wheel", "pointermove", "pointerdown", "touchstart", "touchmove", "keydown", "focusin", "input", "submit"];

export function setupIdle({ sleepAfter = 6000, holdAfterSubmit = 30000 } = {}) {
  let last = performance.now();
  let holdUntil = 0;

  const onInput = (event) => {
    last = performance.now();
    if (event.type === "submit") holdUntil = last + holdAfterSubmit;
    if (engine.paused) engine.resume();
  };

  const onVisibility = () => {
    if (!document.hidden) last = performance.now();
  };

  const check = () => {
    const now = performance.now();
    if (document.hidden || now - last < sleepAfter || now < holdUntil) return;
    engine.pause();
  };

  const timer = window.setInterval(check, 1000);
  WAKE.forEach((type) => window.addEventListener(type, onInput, { passive: true, capture: true }));
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    window.clearInterval(timer);
    WAKE.forEach((type) => window.removeEventListener(type, onInput, { capture: true }));
    document.removeEventListener("visibilitychange", onVisibility);
    if (engine.paused) engine.resume();
  };
}
