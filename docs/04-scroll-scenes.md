# 4. Scroll scenes: tracks, not tweens

A scroll scene is a long section where scrolling drives a picture through several states: 140 dots that become a ring, then a grid, then a wave; or a 3D model that rearranges itself for each chapter. These scenes were our biggest cost, and fixing them was our biggest win.

Demo: `demos/scroll-scene/`. Open it normally for the tracks version and with `?mode=tweens` for the obvious version. The readout shows how many animations each one creates and how long setup takes.

## The obvious version

One timeline scrubbed by scroll, and one tween per element per chapter:

```js
const tl = createTimeline({ autoplay: onScroll({ target: spine, enter: "top top", leave: "bottom bottom", sync: 0.6 }) });
chapters.forEach((chapter, c) => {
  dots.forEach((dot, n) => {
    tl.add(dot, { x: shapes[c][n].x, y: shapes[c][n].y, rotate: shapes[c][n].r, duration: span }, start + n * 4);
  });
});
```

It reads well and it works. With 140 dots and 5 transitions it creates **706 animations**. Every one has to be built at load, and anime.js walks them on every scrubbed frame. On our site the equivalent setup took about 780 ms in one blocking task.

## The tracks version

Describe the motion as data, keep the timeline as a clock, and sample the data yourself.

**1. Precompute a track for each element:** a list of segments, each with a start time, an end time, a start pose and an end pose. This is plain array work, with no animation objects.

```js
const tracks = dots.map(() => []);
const cursor = shapes[0].map((u) => ({ ...u }));

for (let c = 1; c < chapters.length; c++) {
  dots.forEach((dot, n) => {
    const t0 = start + span * 0.38 * (((n * 7) % COUNT) / (COUNT - 1));
    const to = shapes[c][n];
    tracks[n].push({ t0, t1: t0 + span * 0.62, from: cursor[n], to });
    cursor[n] = to;
  });
}
```

**2. Use an empty timeline as the clock.** It has the scroll length as its duration, and `onScroll` with `sync` gives you smoothing for free.

```js
const tl = createTimeline({ autoplay: onScroll({ target: spine, enter: "top top", leave: "bottom bottom", sync: 0.6 }) });
tl.add({ duration: total }, 0);
```

**3. Sample in one frame loop that only runs while the scene is on screen.**

```js
const ease = eases.inOut(3);

function sample(track, time, base, out) {
  let seg = null;
  for (let i = track.length - 1; i >= 0; i--) {
    if (track[i].t0 <= time) {
      seg = track[i];
      break;
    }
  }
  if (!seg) return Object.assign(out, base);
  const p = ease(Math.min(1, Math.max(0, (time - seg.t0) / (seg.t1 - seg.t0))));
  for (const k of ["x", "y", "r", "s"]) out[k] = seg.from[k] + (seg.to[k] - seg.from[k]) * p;
}

const loop = createTimer({
  autoplay: false,
  onUpdate: () => {
    const time = tl.currentTime;
    for (let n = 0; n < COUNT; n++) {
      sample(tracks[n], time, shapes[0][n], state[n]);
      dots[n].style.transform = `translate3d(${state[n].x}px, ${state[n].y}px, 0) rotate(${state[n].r}deg) scale(${state[n].s})`;
    }
  },
});
onScroll({ target: spine, onEnter: () => loop.play(), onLeave: () => loop.pause() });
```

Group-level motion that is genuinely one thing, like the whole field slowly rotating or a camera move, stays as normal timeline tweens. There are only a handful of those.

## Results

Measured on the demo in headless Chromium, on the same machine, with [`tools/perf.mjs`](../tools/perf.mjs) and the demo's own readout:

| | Tweens | Tracks |
| --- | --- | --- |
| Animations created | 706 | 6 |
| Setup time (readout) | ~300 ms | 12–20 ms |
| Longest task at load, desktop | 370 ms | none over 50 ms |
| Longest task at load, phone at 4× CPU | 992 ms | 156 ms |
| Blocking time at load, phone at 4× CPU | 948 ms | 106 ms |
| Script time over a 40-step scroll, desktop | 133 ms | 88 ms |

On the production site, moving the 3D scene from tweens to tracks took timeline building from about 780 ms to about 120 ms, and was the main reason scroll blocking on a throttled phone fell from 2.1 s to 0.5 s.

## Rules for scroll scenes

- **Measure once.** Read chapter `offsetTop`s and the spine height at setup. Rebuild on a real width change by calling `scope.refresh()` from a debounced resize. Ignore height-only resizes, which mobile URL bars fire constantly.
- **Stagger by math, not by tween.** `((n * 7) % COUNT) / (COUNT - 1)` spreads start times evenly without looking random, and costs nothing.
- **Transition between chapters, hold during them.** Start a change about 95% of a viewport before the chapter arrives and finish it about 20% after, so the picture is settled while the reader is reading.
- **Gate on ready.** If the scene loads late (a dynamic import or a WebGL compile), don't sample tracks until it's ready, then jump straight to the current scroll position.
- **Reduced motion gets the first state, static.** No timeline, no loop.
- **Show where the reader is.** A readout like `02 / 05 · grid` updated from `onUpdate` orients people in a long scene. Only write to the DOM when the value changes.
