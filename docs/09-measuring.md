# 9. Measuring

"It feels smoother" isn't a result. Every change in this playbook was measured before and after, on the same machine, the same way. Here's how.

## In the browser

**DevTools Performance panel**, with CPU set to 4× slowdown. Record a page load, then record a scroll. Look for:

- Red-cornered long tasks at load. Click one and read the bottom-up view to see which functions own the time.
- Purple (style and layout) blocks inside scroll frames. "Forced reflow" warnings point at a layout read after a write.
- Green (paint) blocks that run every frame. Something is repainting that should be a transform.

**DevTools Rendering tab:**

- *Paint flashing* shows what repaints while you scroll. Ideally only small areas flash.
- *Layer borders* shows how many compositor layers you've made.
- *Frame rendering stats* shows live frame timing.

**In-page readouts.** Every demo mounts a small panel (`demos/src/lib/panel.js`) that shows long tasks, blocking time and whether the anime.js engine is running. That last one is the fastest way to check idle sleep is working.

```js
new PerformanceObserver((list) => {
  list.getEntries().forEach((e) => {
    longTasks += 1;
    blocking += Math.max(0, e.duration - 50);
  });
}).observe({ type: "longtask", buffered: true });
```

## Scripted runs

`tools/` has two Playwright scripts that produce repeatable numbers.

```bash
cd tools
npm install
npx playwright install chromium
node perf.mjs http://localhost:5173 /scroll-scene/,/three-stage/
node idle-frames.mjs http://localhost:5173 /three-stage/
```

**`perf.mjs`** loads each path as a desktop (1440×900) and as a phone (390×844, 3× DPR, 4× CPU throttle). For each one it reports:

- **Load:** FCP, LCP, number of long tasks, total blocking and the worst single task in the first 6 seconds.
- **Scroll:** a scripted 80-step wheel scroll, with frame-time p50 and p95, long tasks and blocking. From Chrome's `Performance.getMetrics` it also gives the script, style and layout time spent during the scroll, and the counts of style recalculations and layouts.

**`idle-frames.mjs`** counts `requestAnimationFrame` callbacks in three windows: just after load, while idle, and just after a scroll. The idle window should be 0. It also runs each page with reduced motion on.

Environment variables:

- `CHROMIUM_PATH` points at a specific Chromium build.
- `SOFTWARE_GL=1` forces software WebGL, for machines without a GPU.
- `STEPS` changes the scroll length.

## Profiling with real function names

Minified bundles make CPU profiles unreadable. Build without name mangling to profile:

- Next.js: `next build --no-mangling`
- Vite: `vite build --minify false`

Then record a CPU profile with DevTools, or with the Chrome DevTools Protocol's `Profiler` domain from Playwright, and sort by self time. This is how we found that just building the tweens for the 3D scene, before anything was drawn, cost about 780 ms at load.

## Lighthouse, with care

Lighthouse is useful, and easy to misread.

- **Run it three or more times** and look at the spread, not one score.
- **Check that the page actually loaded.** We once got a desktop score of 99. The cause was a 502 on one JavaScript chunk, so the motion code never ran at all. A clean re-run gave 65. Always look at the network tab or the failed requests before believing a jump.
- **A machine without a GPU punishes WebGL.** In CI containers, WebGL runs on the CPU, which inflates blocking time and LCP for any page with a 3D scene. Compare runs on the same machine, and confirm on real hardware.
- **LCP for animated heroes** depends on opacity: an element at opacity 0 isn't a candidate. If your LCP equals the time your motion script finished, your hero is hidden until JavaScript runs. See [First paint](05-first-paint.md).

## What we measured on spectrumweb.co

The same machine, the same scripts, before and after this work:

| Measure | Before | After |
| --- | --- | --- |
| Longest task at load, phone at 4× CPU | 3.3 s | 0.66 s |
| Blocking time at load, phone at 4× CPU | 3.9 s | 1.9 s |
| Longest task at load, desktop | 1.46 s | 0.63 s |
| Blocking during a long scroll, desktop | 243 ms | 35 ms |
| Blocking during a long scroll, phone at 4× CPU | 2.1 s | 0.5 s |
| Building the 3D scene's timeline | ~780 ms | ~120 ms |
| Fonts preloaded | 163 KB | 61 KB |
| Lighthouse mobile, home page (GPU-less runner) | 40 | 65 |
| Lighthouse mobile LCP, home page | 6.8 s | 1.4 s |

With idle sleep in place, the home page renders 0 frames once the reader has been still for 6 seconds.

## Habits

- Measure before you change anything, and save the output. `perf.mjs` prints one JSON line per run, so `node perf.mjs ... >> before.jsonl` gives you a file to compare.
- Change one thing, then measure again. Several changes at once hide which one helped, and which one hurt.
- Test the reduced-motion path every time. It's the easiest to break without noticing.
- Watch the engine readout go to "stopped" while idle. If it doesn't, something is waking it.
