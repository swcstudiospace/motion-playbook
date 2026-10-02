# 2. The frame budget

Smooth means every frame lands on time. At 60 Hz a frame is 16.7 ms; at 120 Hz it is 8.3 ms. The browser needs a good part of that for style, layout, paint and compositing, so treat your share as **about 4 ms of JavaScript per frame on a mid-range phone**. Test with the CPU throttled 4× in DevTools, because your laptop will hide everything.

## What a frame costs

| Stage | What triggers it | How to keep it cheap |
| --- | --- | --- |
| JavaScript | anime.js ticking every live animation, your `onUpdate` callbacks, scroll handlers | Fewer animations, precomputed values, no work while idle |
| Style | Every element whose inline style changed this frame | Touch fewer elements; one transform string per element, not five properties |
| Layout | Changing geometry (`width`, `top`, margins), or reading layout after a write | Animate `transform` only; read layout once and cache it |
| Paint | Anything that isn't transform or opacity: shadows, blur, gradients, `background-position` | Move a pre-painted layer instead of repainting |
| Composite | Many large layers, `backdrop-filter` over moving content | Fewer layers; no live blur over a canvas |

## Long tasks

Any task over 50 ms is a long task: the page can't respond to a tap or scroll until it finishes. **Total Blocking Time** is the sum of every long task's excess over 50 ms. Two places produce them:

1. **Setup.** Splitting text, building timelines, compiling shaders and parsing a big bundle all happen at load. On our site the worst load task on a throttled phone was 3.3 s before this work and 0.66 s after.
2. **Scrolling.** Hundreds of tweens and forced layouts inside scroll callbacks. Scroll blocking on the throttled phone went from 2.1 s to 0.5 s over a long scroll.

## The rules

**Read layout once.** `getBoundingClientRect`, `offsetTop`, `offsetHeight` and `scrollHeight` all force a layout if anything changed. Read them at setup, cache them, and re-read only from a `ResizeObserver` or a debounced `resize`. Inside a frame loop, never read layout after you've written a style.

```js
const heights = new Map();
const heightOf = (el) => {
  if (!heights.has(el)) heights.set(el, el.offsetHeight);
  return heights.get(el);
};
window.addEventListener("resize", () => heights.clear());
```

**Read the scroll position in the scroll event.** Store `window.scrollY` in a passive scroll listener and read the variable in your frame loop. Reading it inside `requestAnimationFrame` after writing styles can force a synchronous layout. See `demos/src/lib/scroll.js`.

**Read hover geometry on enter, not on move.** A magnetic button needs its rect, but only once per hover. Read it in `pointerenter` and reuse it for every `pointermove`. See `demos/cursor/`.

**Count your animations.** anime.js walks every active animation every frame, and each one costs setup time when it's created. 700 tweens that each move one dot are far slower than one loop that moves 140 dots from precomputed numbers. See [Scroll scenes](04-scroll-scenes.md).

**Write one transform per element.** When you drive many elements yourself, build one `translate3d(...) rotate(...) scale(...)` string per element per frame. Don't write four separate properties.

**Do nothing when nothing is happening.** A page that's sitting still should render zero frames. Pause loops when their section is off screen, pause everything when the tab is hidden, and put the whole engine to sleep a few seconds after the last input. See [Recipes: idle sleep](08-recipes.md#idle-sleep).

**Spread the setup out.** Paint the page first, then load motion code, then build the heavy parts when the browser is idle. One big task of 800 ms is far worse than eight of 100 ms. See [First paint](05-first-paint.md).

## Budget by device

What we ship to each class of device:

| | Desktop with a fine pointer | Phone or coarse pointer | Reduced motion |
| --- | --- | --- | --- |
| Scroll-scrubbed scenes | Yes | Yes, with fewer elements | Static end state |
| Soft blur on reveals | Yes | No | No |
| Per-word text splits | Yes | Yes, without blur | No |
| Cursor effects | Yes | No | No |
| 3D pixel ratio cap | 1.5 | 1.25 | One still frame |
| Ambient idle loops | Yes | Yes, paused off screen | No |

Use `matchMedia("(min-width: 900px) and (pointer: fine)")` for "rich pointer" and `matchMedia("(max-width: 899px), (pointer: coarse)")` for "compact". Width alone is not enough: a large tablet has a big screen and a weak GPU.
