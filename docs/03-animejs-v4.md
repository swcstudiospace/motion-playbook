# 3. anime.js v4 field guide

Everything here was used in production on anime.js 4.5. v4 is a full rewrite of v3: imports are named, easings are strings like `"out(3)"`, and scroll, scope, text and three.js support are built in.

```js
import { animate, createTimeline, createTimer, createScope, createAnimatable, onScroll, stagger, spring, splitText, scrambleText, utils, eases, engine } from "animejs";
```

## The pieces we used

### `animate(targets, params)`

The workhorse. Values can be `to`, `[from, to]`, or a list of keyframes with their own durations and eases.

```js
animate(el, {
  opacity: [
    { from: 0, to: 1, duration: 300, ease: "out(2)" },
    { to: 1, duration: 400, ease: "linear" },
    { to: 0, duration: 300, ease: "in(2)" },
  ],
  y: [42, 0],
  duration: 600,
  ease: "out(3)",
});
```

Transform shorthands: `x`, `y`, `z`, `rotate`, `rotateX`, `rotateY`, `scale`. anime.js composes them into one `transform` and remembers each one separately.

### Easing

| String | Feel |
| --- | --- |
| `"out(3)"`, `"out(4)"` | Arrivals |
| `"in(2)"` | Exits |
| `"inOut(2)"`, `"inOut(3)"` | State to state |
| `"outBack(1.3)"` | Small overshoot |
| `"linear"` | Loops and scrubbed holds |
| `spring({ bounce: 0.45, duration: 650 })` | Pointer-driven motion |

When you sample motion yourself, take the function form: `const ease = eases.inOut(3); ease(0.5)`.

### `createTimeline({ defaults, autoplay })`

Sequence animations with absolute positions in milliseconds: `tl.add(target, params, position)`. A timeline can also hold nothing but time: `tl.add({ duration: total }, 0)` gives you a clock that runs from 0 to `total`, which is how the scroll scenes work.

### `onScroll({ target, enter, leave, sync, onEnter, onLeave, onUpdate })`

Pass it as `autoplay` to tie an animation or timeline to scroll.

```js
createTimeline({
  autoplay: onScroll({ target: spine, enter: "top top", leave: "bottom bottom", sync: 0.6 }),
});
```

- `enter` and `leave` are `"<container edge> <target edge>"`. `"bottom top"` starts when the viewport's bottom meets the target's top (the target starts to appear). `"top bottom"` ends when the viewport's top meets the target's bottom (it has fully left). Offsets work too: `"bottom-=38% top"`.
- `sync` decides what scroll does to the animation:
  - **Omitted:** defaults to `"play pause"`. The animation *plays* on enter and pauses on leave. It does **not** scrub. This is the most common surprise.
  - **A number below 1:** scrubs with smoothing. Lower numbers glide more and lag more. We use 0.45 for text and 0.6–0.7 for big scenes.
  - **`true` or `1`:** scrubs with no smoothing.
  - **An ease string**, like `"inOut(2)"`: scrubs through that ease.
- Without an animation, `onScroll({ target, onEnter, onLeave })` is a cheap visibility observer. We use it to start and stop frame loops when their section enters or leaves.

### `createScope({ root, mediaQueries }).add(self => cleanup)`

A scope collects everything created inside it, so it can be reverted in one call. Media queries rerun the setup when they change.

```js
const scope = createScope({ root, mediaQueries: { reduce: "(prefers-reduced-motion: reduce)" } }).add((self) => {
  if (self.matches.reduce) return;
  return () => {};
});
```

- `self.matches.reduce` is a boolean you branch on.
- `scope.refresh()` reverts and rebuilds. Call it from a debounced resize, and only when the width really changed (mobile URL bars change the height constantly).
- `scope.revert()` tears down everything.

### `createTimer({ autoplay: false, onUpdate })`

A frame loop owned by the anime.js engine. Because it's owned by the engine, it pauses when the engine pauses, when the tab is hidden, and when you call `pause()`. Its `currentTime` doesn't jump forward after a pause, which makes it a good clock for idle motion.

### `createAnimatable(el, { x: 500, y: 500, ease })`

Built for values that change constantly, like a cursor. You give each property a duration once, then retarget it as often as you like with no new animations being created.

```js
const dot = createAnimatable(follower, { x: 500, y: 500, ease: "out(3)" });
window.addEventListener("pointermove", (e) => dot.x(e.clientX).y(e.clientY));
```

### Text

- `splitText(el, { words: { wrap: "clip" } })` wraps each word in a clipping span, so words can rise from below their line. It returns `split.words` and `split.revert()`.
- `scrambleText({ text, chars: "uppercase", cursor: true })` is a value you animate `innerHTML` to. Keep it to short labels.

### `stagger(step, { start, from })`

`delay: stagger(70)` for reading order, `stagger(45, { start: 160 })` to offset the group, `{ from: "center" }` for symmetric groups.

### `utils.set(targets, props)`

Sets values instantly *through* anime.js, so its transform cache stays in sync with what's on screen.

### three.js adapter

```js
import "animejs/adapters/three";
animate(camera, { z: 18 });
animate(group, { rotateY: 120 });
```

After that one import, `Object3D` targets accept `x`, `y`, `z`, `rotateX/Y/Z` in degrees, and `scale`.

## Gotchas we hit

**Two animations on the same property replace each other.** The default composition is `replace`: a new animation of `y` on an element cancels the running `y` tween on that element. Our FAQ cells have a scroll reveal on `y`, and the open morph also moves the card on `y`. The fix is structural: the reveal runs on the outer cell and the morph runs on the inner card. When two systems need to move one thing, give each its own wrapper.

**Give each element's transform one owner.** While it animates an element, anime.js writes that element's whole `transform` string on every tick, built from its own record of `x`, `y`, `rotate` and `scale`. If your own loop also writes `style.transform` on the same element, the two overwrite each other every frame and you get flicker. Either let anime.js own the element, or drive it yourself with no anime.js transforms on it. When you hand an element over to anime.js, clear your inline transform and set the starting values with `utils.set`, so its record matches what's on screen.

**Thousands of targets switch composition off.** At 1,000 or more targets in one call, anime.js uses `composition: "none"` for speed, so overlapping animations stop replacing each other. Usually fine, occasionally surprising.

**`engine.pause()` isn't a lock.** Any animation, timeline or timer that starts or resumes calls `engine.wake()`, which restarts the main loop even while `engine.paused` is true. A scroll-linked animation updating or a hover starting a tween will start frames again. If you put the engine to sleep, check again periodically rather than once. `engine.reqId` is `0` when the loop is actually stopped. See [Recipes: idle sleep](08-recipes.md#idle-sleep).

**anime.js already pauses on hidden tabs.** `engine.pauseOnDocumentHidden` is on by default. Your own `requestAnimationFrame` loops don't get this, which is another reason to drive them with `createTimer`.

**Work started after setup escapes the scope.** Code that runs later, in a promise, a dynamic import or an idle callback, isn't recorded by the scope. Wrap it in `self.execute(() => ...)`, and the scope can revert it.

```js
createScope({ root }).add((self) => {
  let stop = null;
  import("./stage.js").then(({ setupStage }) => {
    stop = self.execute(() => setupStage(root));
  });
  return () => stop?.();
});
```

**`width` and `height` animations cause layout every frame.** We allow them in exactly one place: the FAQ morph, where one card animates for about half a second after a click. Nowhere scroll-linked, and never on many elements.

**`filter: blur()` is a paint every frame.** Per-word blur on a long heading was one of our biggest scroll costs. Blur whole blocks, only on desktop, or not at all.
