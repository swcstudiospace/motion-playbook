# 5. First paint: animate the page, don't hide it

The most common way motion hurts a site is at load: the headline starts at `opacity: 0` and waits for JavaScript to fade it in. Largest Contentful Paint (LCP) is usually that headline, and Chrome doesn't count an element as painted while its opacity is 0. So LCP waits for the bundle to download, parse, run and finish setting up animation.

Demo: `demos/hero/`. The default version paints the headline on the first frame. `?bad=1` hides it until JavaScript runs, with the same 700 ms of simulated bundle work in both. Across our runs, LCP was **260–360 ms** CSS-first versus **930–970 ms** hidden-until-JS.

## Rule 1: the hero entrance is CSS

Give the headline and lede a CSS keyframe that starts *visible*, just lower and dimmer, and rises into place. It runs with no JavaScript, so it paints on the first frame.

```css
@keyframes hero-in {
  from {
    transform: translateY(0.28em);
    opacity: 0.35;
  }
}

.motion .hero__title {
  animation: hero-in 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.motion .hero__lede {
  animation: hero-in 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) 0.12s both;
}
```

Starting at 0.35 rather than 0 matters: the element is painted, so it counts for LCP immediately, and the rise still reads as an entrance.

The `motion` class comes from a tiny inline script in `<head>`, so reduced-motion visitors never get the animation at all:

```html
<script>
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) document.documentElement.classList.add("motion");
</script>
```

## Rule 2: anything JavaScript reveals has a CSS escape hatch

Secondary elements like eyebrows, buttons and below-the-fold reveals can wait for JavaScript, but they must not wait forever. If the script fails, is blocked or is slow, a CSS animation shows them anyway.

```css
@keyframes reveal-fallback {
  to {
    opacity: 1;
  }
}

.motion:not(.motion-ready) [data-reveal] {
  opacity: 0;
  animation: reveal-fallback 0s linear 2.5s forwards;
}
```

The motion code adds `motion-ready` to `<html>` once it has taken over.

## Rule 3: load motion code after the first paint

Don't put animation code in the critical bundle. Import it dynamically once the first frame is on screen.

```js
export function afterPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
}

afterPaint().then(() => import("./motion.js")).then(({ start }) => start());
```

`requestAnimationFrame` runs just before the next paint; the `setTimeout` inside it runs just after. In a React or Next.js app, do this in a client component's effect, and render nothing from it.

## Rule 4: build heavy things when the browser is idle

A 3D scene, a big text split or a long timeline can wait a few hundred milliseconds. Schedule it with `requestIdleCallback` and a timeout, so it runs in a gap rather than on top of the first interaction.

```js
export function whenIdle(start, timeout = 300) {
  let stop = null;
  let cancelled = false;
  const run = () => {
    if (!cancelled) stop = start();
  };
  const idle = "requestIdleCallback" in window ? requestIdleCallback(run, { timeout }) : 0;
  const timer = idle ? 0 : setTimeout(run, 50);
  return () => {
    cancelled = true;
    if (idle) cancelIdleCallback(idle);
    if (timer) clearTimeout(timer);
    stop?.();
  };
}
```

Inside an anime.js scope, wrap the late work in `self.execute(...)` so the scope can still revert it. See the [field guide](03-animejs-v4.md#gotchas-we-hit).

## Rule 5: fonts are part of first paint

- **Preload only the faces the hero uses.** Usually that's the display face and one body weight. Set everything else, like italics or a mono used in small labels, to load lazily (`preload: false` in `next/font`).
- **Drop variable axes you don't use.** An unused optical-size axis can double a font file.
- **Use `font-display: swap`** so text paints in a fallback face straight away.

On our site this took preloaded fonts from 163 KB to 61 KB.

## Rule 6: don't make CSS a separate round trip

For a site with a modest amount of CSS, inlining it into the HTML removes a render-blocking request. In Next.js that's `experimental.inlineCss: true`. Check the HTML size afterwards; this suits sites with tens of kilobytes of CSS, not hundreds.

## Results on the production site

Lighthouse mobile on the home page, a WebGL-heavy page, run on a machine without a GPU, which inflates WebGL costs:

| | Before | After |
| --- | --- | --- |
| Performance score | 40 | 65 |
| LCP | 6.8 s | 1.4 s |
| Longest task at load, 4× throttled phone | 3.3 s | 0.66 s |

The remaining score is mostly the 3D scene's main-thread cost on a GPU-less machine. Real phones with a GPU do better, which is why we track our own numbers too. See [Measuring](09-measuring.md).
