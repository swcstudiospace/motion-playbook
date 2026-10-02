export const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const isRichPointer = () => window.matchMedia("(min-width: 900px) and (pointer: fine)").matches;

export const isCompact = () => window.matchMedia("(max-width: 899px), (pointer: coarse)").matches;

export function afterPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
}

export function whenIdle(start, timeout = 300) {
  let stop = null;
  let cancelled = false;
  const run = () => {
    if (!cancelled) stop = start();
  };
  const idle = "requestIdleCallback" in window ? window.requestIdleCallback(run, { timeout }) : 0;
  const timer = idle ? 0 : window.setTimeout(run, 50);
  return () => {
    cancelled = true;
    if (idle) window.cancelIdleCallback(idle);
    if (timer) window.clearTimeout(timer);
    stop?.();
  };
}
