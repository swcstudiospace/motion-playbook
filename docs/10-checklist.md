# 10. Ship checklist

Run through this before a motion-heavy page goes live.

## Design

- [ ] Every animation has a job: orient, connect, explain, reward or atmosphere.
- [ ] One hero moment per screen; everything around it is calm.
- [ ] Durations come from the scale: micro 120–200 ms, UI 240–420 ms, entrance 600–900 ms.
- [ ] Arrivals use `out`, exits use `in`, state changes use `inOut`.
- [ ] Staggers stay under about 400 ms in total.
- [ ] Text holds still while it's in the reading zone.
- [ ] Anything that opens closes the same way, on Escape, a click outside and a second click.
- [ ] Decorative text is `aria-hidden` and rendered from `data-text` by CSS.

## First paint

- [ ] The headline and first paragraph are visible on the first frame, with no JavaScript.
- [ ] The hero entrance is CSS and starts above opacity 0.
- [ ] Anything JavaScript reveals has a CSS fallback that shows it after about 2.5 s.
- [ ] Motion code is a dynamic import after the first paint.
- [ ] Heavy setup (3D, long timelines) runs in `requestIdleCallback`, inside `self.execute`.
- [ ] Only the hero's font faces are preloaded; unused axes are dropped.

## Runtime

- [ ] Layout reads (`getBoundingClientRect`, `offsetTop`, `offsetHeight`) happen at setup or on resize, never per frame.
- [ ] `scrollY` is read in the scroll event, not in the frame loop.
- [ ] Hover geometry is read on `pointerenter`, not `pointermove`.
- [ ] Scroll scenes with many elements use precomputed tracks and one loop, not a tween per element.
- [ ] Every `onScroll` that should scrub has a `sync` value.
- [ ] Frame loops run only while their section is on screen.
- [ ] The engine sleeps after a few seconds without input, and the check repeats.
- [ ] Rebuilds on resize only happen when the width changed, debounced.
- [ ] No two systems animate the same property on the same element.

## CSS

- [ ] No `backdrop-filter` over a moving canvas or scrolling content on phones.
- [ ] No per-word or per-letter blur. Block blur on desktop only.
- [ ] Infinite loops move a transform, not `background-position`.
- [ ] Long below-the-fold sections use `content-visibility: auto` (unless a scroll scene measures them).
- [ ] `will-change` only on things that move continuously.

## three.js

- [ ] three.js loads lazily, after idle.
- [ ] No separate WebGL support probe.
- [ ] `renderer.debug.checkShaderErrors = false` in production.
- [ ] `compileAsync` then a prewarm render with culling off, before the stage is shown.
- [ ] Pixel ratio is capped (1.5 desktop, 1.25 phones) and adapts to frame time.
- [ ] Repeated objects are one `InstancedMesh`.
- [ ] Dispose calls `renderer.dispose()` and `forceContextLoss()`.

## Accessibility

- [ ] With reduced motion on, content is visible, layouts switch instantly, loops and scrubbing are off, and 3D shows a still frame.
- [ ] Cursor effects only run with `(hover: hover)` and a mouse.
- [ ] Nothing blocks scrolling, and nothing scrolls the page on its own.
- [ ] Keyboard focus is visible and is returned after closing something.

## Measured

- [ ] `tools/perf.mjs` before and after, saved.
- [ ] Longest load task on a 4× throttled phone is under about 700 ms.
- [ ] No long tasks during a scroll on desktop.
- [ ] `tools/idle-frames.mjs` shows 0 idle frames.
- [ ] Lighthouse run three times, with every request succeeding.
- [ ] Checked on a real phone.
