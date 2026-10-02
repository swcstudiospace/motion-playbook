# Motion Playbook

How we made a scroll-driven website, built with anime.js v4 and three.js, load fast and scroll smoothly: the design rules, the performance techniques, the gotchas, and a runnable demo of each.

Everything here was learned building [spectrumweb.co](https://www.spectrumweb.co), the site of Spectrum Web Co, a Software Engineering Collective. It's a long page where nearly everything moves: scrubbed chapters, a 3D sculpture that reassembles as you scroll, text that rises in, and a FAQ grid that morphs. It started out heavy on phones. These are the changes that fixed it, with the numbers.

## What it bought us

Same machine, same scripts, before and after:

| Measure | Before | After |
| --- | --- | --- |
| Longest task at load, phone at 4× CPU | 3.3 s | 0.66 s |
| Blocking during a long scroll, phone at 4× CPU | 2.1 s | 0.5 s |
| Blocking during a long scroll, desktop | 243 ms | 35 ms |
| Building the 3D scene's timeline | ~780 ms | ~120 ms |
| Lighthouse mobile LCP, home page | 6.8 s | 1.4 s |
| Lighthouse mobile score, home page (GPU-less runner) | 40 | 65 |

With idle sleep on, the page renders 0 frames once the reader has been still for 6 seconds. Full table and method: [Measuring](docs/09-measuring.md).

## Run the demos

```bash
cd demos
npm install
npm run dev
```

Open the URL Vite prints. Each demo has a readout in the corner showing long tasks, blocking time and whether the anime.js engine is running. Several have a toggle between the good version and the obvious one.

| Demo | Shows | Try |
| --- | --- | --- |
| [`reveal`](demos/reveal) | Scrubbed in, hold, out reveals; word rises with no blur; soft blur on desktop only | Scroll slowly, then fast |
| [`scroll-scene`](demos/scroll-scene) | 140 dots through 6 formations using precomputed tracks | Compare with `?mode=tweens`: 706 animations instead of 6 |
| [`faq-morph`](demos/faq-morph) | A bento card that fades the others and takes over the grid, with FLIP | Open with the keyboard, close with Escape |
| [`hero`](demos/hero) | Hero text that paints on the first frame | Compare LCP with `?bad=1` |
| [`three-stage`](demos/three-stage) | three.js loaded at idle, async compile, prewarm, adaptive pixel ratio, instancing | Watch the pixel ratio and the engine go to "stopped" |
| [`cursor`](demos/cursor) | `createAnimatable` follower, spring magnets, tilt | Hover the buttons, then leave quickly |

Try each one with reduced motion turned on, too. In Chrome DevTools: Rendering → Emulate CSS media feature `prefers-reduced-motion`.

## The rules, on one page

**Design**

1. Every animation needs a job: orient, connect, explain, reward or atmosphere.
2. One hero moment per screen. Everything else stays calm.
3. Use a small set of durations: 120–200 ms, 240–420 ms, 600–900 ms. Exits run at about two thirds of the entrance.
4. Arrivals `out(3)`, exits `in(2)`, state changes `inOut(3)`, pointer motion `spring()`.
5. Scrub scroll, never hijack it. Text holds still while it's being read.
6. Content is visible without JavaScript. Motion enhances; it never gates.

**Performance**

7. Read layout once, cache it, re-read on resize. Never read layout inside a frame loop.
8. Many elements on one scroll scene: precompute tracks and sample them in one loop, instead of one tween per element.
9. The hero entrance is CSS. Motion code is a dynamic import after the first paint. Heavy setup waits for idle.
10. Render only what's on screen, and nothing while the reader is idle.
11. No `backdrop-filter` over moving content, no per-word blur, no infinite `background-position` loops.
12. For three.js: lazy load, `compileAsync` and prewarm, cap and adapt the pixel ratio, instance repeated meshes.

**anime.js gotchas**

13. `onScroll` without `sync` *plays* on enter. It doesn't scrub.
14. Two animations of the same property on one element replace each other. Give each system its own wrapper.
15. `engine.pause()` doesn't stop new animations waking the loop. Check again periodically.
16. Work created after setup (imports, idle callbacks) needs `self.execute()` to belong to its scope.

## The guide

1. [Designing motion that feels clean](docs/01-designing-motion.md)
2. [The frame budget](docs/02-frame-budget.md)
3. [anime.js v4 field guide](docs/03-animejs-v4.md)
4. [Scroll scenes: tracks, not tweens](docs/04-scroll-scenes.md)
5. [First paint: animate the page, don't hide it](docs/05-first-paint.md)
6. [three.js stages driven by anime.js](docs/06-threejs-stages.md)
7. [CSS that quietly costs frames](docs/07-css-that-costs.md)
8. [Recipes](docs/08-recipes.md)
9. [Measuring](docs/09-measuring.md)
10. [Ship checklist](docs/10-checklist.md)

## Repository layout

```
demos/          Vite multi-page app, one folder per demo
  src/lib/      Shared helpers: idle sleep, scheduling, scroll state, the readout panel
docs/           The guide
tools/          Playwright scripts for load, scroll and idle measurements
```

## Built with

[anime.js](https://animejs.com) 4.5 · [three.js](https://threejs.org) 0.186 · [Vite](https://vite.dev) 8 · [Playwright](https://playwright.dev) for measuring.

## Licence

MIT. See [LICENSE](LICENSE).
