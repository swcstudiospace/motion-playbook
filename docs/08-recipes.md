# 8. Recipes

Copy-ready patterns from the demos. Each one names the demo it lives in.

## Idle sleep

A page that nobody is touching should render nothing. After a few seconds without input, pause the anime.js engine. Wake it on any input. Hold it awake for a while after a form submit, so success animations can finish.

Because any animation that starts or resumes wakes the engine again (see the [field guide](03-animejs-v4.md#gotchas-we-hit)), the check runs every second rather than once.

```js
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

  const check = () => {
    const now = performance.now();
    if (document.hidden || now - last < sleepAfter || now < holdUntil) return;
    engine.pause();
  };

  const timer = setInterval(check, 1000);
  WAKE.forEach((type) => addEventListener(type, onInput, { passive: true, capture: true }));

  return () => {
    clearInterval(timer);
    WAKE.forEach((type) => removeEventListener(type, onInput, { capture: true }));
    if (engine.paused) engine.resume();
  };
}
```

Every demo uses this (`demos/src/lib/idle.js`). Watch the "anime engine" row in the readout switch to "stopped" about 6 seconds after you stop moving. On our site, the home page renders 0 frames once the reader has been still for 6 seconds.

## Scroll reveal with an in, a hold and an out

`demos/reveal/`. One animation per block, scrubbed across the whole time the block is on screen. Keyframe durations are worked out from the block's height so the hold covers the reading zone.

```js
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
    autoplay: onScroll({ target: el, enter: "bottom top", leave: "top bottom", sync: 0.45 }),
  });
}
```

The total duration of 1000 is arbitrary. Under scroll sync, only the proportions matter.

## Headline words that rise

`demos/reveal/`. Words rise from below a clipping line and don't blur.

```js
const split = splitText(heading, { words: { wrap: "clip" } });
animate(split.words, {
  y: ["110%", "0%"],
  opacity: [0, 1],
  duration: 600,
  ease: "out(3)",
  delay: stagger(70),
  autoplay: onScroll({ target: heading, enter: "bottom top", leave: "bottom-=38% top", sync: 0.45 }),
});
```

Return `() => split.revert()` from the scope, so a resize or teardown restores the original text.

## FAQ that takes over the grid

`demos/faq-morph/`. Click a question in a bento grid: the other cards fade away, and the clicked card grows to fill the grid. Click outside, press Escape, or click the question again, and it all reverses.

The sequence, using FLIP (First, Last, Invert, Play):

1. Fade the other cards: `opacity`, `scale` 0.92, 8 px blur, 260 ms, `in(2)`, staggered 35 ms.
2. **First:** read the clicked card's rect.
3. Lock the grid's current height with `min-height` so the page doesn't jump.
4. Apply the open layout with classes: the cell spans the whole grid and the others are taken out of the flow.
5. **Last:** read the rect again.
6. **Invert and play:** animate `x`, `y`, `width` and `height` from the old rect to the new one over 560 ms with `out(4)`, then clear the inline styles.
7. Grow the answer from height 0 to its `scrollHeight` with a 260 ms delay.

Closing runs the same steps backwards, a little faster: answer collapses in 240 ms, the card returns in 480 ms, the others fade back in staggered 45 ms.

The details that make it feel right:

- A `busy` flag ignores clicks while a morph is running.
- The scroll reveal animates the outer cell; the morph animates the inner card. Different elements, so they never cancel each other.
- It's built on `<details>` and `<summary>`, so it works without JavaScript and with a keyboard. Escape returns focus to the question.
- Under reduced motion, it switches layout instantly.

## Cursor follower, magnets and tilt

`demos/cursor/`. All three use `createAnimatable`, so pointer moves never create new animations.

```js
const dot = createAnimatable(follower, { x: 500, y: 500, ease: "out(3)" });
const pull = createAnimatable(button, { x: 0, y: 0, ease: spring({ bounce: 0.45, duration: 650 }) });
const tilt = createAnimatable(card, { rotateX: 600, rotateY: 600, ease: "out(3)" });

let rect = null;
button.addEventListener("pointerenter", () => (rect = button.getBoundingClientRect()));
button.addEventListener("pointerleave", () => {
  rect = null;
  pull.x(0).y(0);
});
addEventListener("pointermove", (e) => {
  dot.x(e.clientX).y(e.clientY);
  if (rect) pull.x((e.clientX - rect.left - rect.width / 2) * 0.35).y((e.clientY - rect.top - rect.height / 2) * 0.35);
});
```

- Only with `(hover: hover)` and a mouse (`e.pointerType === "mouse"`). Touch devices get nothing.
- The spring on the magnet keeps momentum, so it overshoots a little when you leave.
- Read rects on `pointerenter`, never on `pointermove`.

## Ambient motion on a pausable clock

`demos/three-stage/`. Idle bobbing and spinning use the frame timer's own `currentTime`, not `performance.now()`. When the engine sleeps and wakes, the motion carries on from where it stopped instead of jumping.

```js
const loop = createTimer({ autoplay: false, onUpdate: draw });

function draw() {
  const t = loop.currentTime / 1000;
  mesh.position.y = base + Math.sin(t * 1.6) * 0.06;
}
```

## Rebuild on a real resize

`demos/scroll-scene/`. Scroll scenes depend on measured positions, so they need rebuilding when the layout changes. Mobile browsers fire `resize` constantly as the URL bar shows and hides, so only rebuild when the width changed.

```js
let width = innerWidth;
let timer = 0;
addEventListener("resize", () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (Math.abs(innerWidth - width) < 2) return;
    width = innerWidth;
    scope.refresh();
  }, 220);
});
```

## A fallback for content that JavaScript reveals

`demos/reveal/`, `demos/hero/`. If the motion code never runs, show the content anyway.

```css
.motion:not(.motion-ready) [data-reveal] {
  opacity: 0;
  animation: reveal-fallback 0s linear 2.5s forwards;
}

@keyframes reveal-fallback {
  to {
    opacity: 1;
  }
}
```
