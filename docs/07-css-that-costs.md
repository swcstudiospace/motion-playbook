# 7. CSS that quietly costs frames

Some of our worst scroll frames had nothing to do with JavaScript. They came from CSS that looks harmless in a static design and becomes expensive the moment something behind or inside it moves.

## `backdrop-filter` over moving content

A frosted-glass header or panel blurs whatever is behind it. If what's behind it is a scrolling page or an animating canvas, the blur has to be recalculated every frame, across the whole area of the element.

What we did:

- Over the 3D stage, cards that had `backdrop-filter` got a near-opaque fill instead: `rgb(255 255 255 / 0.92)`. Nobody can tell the difference over a busy scene.
- On phones, the sticky header and the progress readout use a solid `0.94`–`0.96` fill with no blur.
- Desktop keeps the blur only where the content behind is mostly still.

## `filter: blur()` on many elements

Animating a blur means repainting the element every frame, and the cost grows with its size. Splitting a heading into words and blurring each one multiplies that by the word count.

- Never blur individual words or letters.
- Blur whole blocks, on desktop only (`(min-width: 900px) and (pointer: fine)`), for the in and out phases. When the block is resting in the reading zone the filter is `blur(0px)`, so it costs nothing.
- For the FAQ morph, a short 8 px blur on the cards fading out is fine: a handful of elements for 260 ms after a click.

## Animating `background-position`

A moving grid floor, a gradient sweep or a scrolling pattern done with `background-position` repaints the whole element every frame. Make the layer one tile taller (or wider) than its box and move it with a transform instead. The transform runs on the compositor; the pattern is painted once.

```css
.floor span {
  position: absolute;
  inset: -48px 0 0;
  background-image:
    linear-gradient(rgb(0 255 200 / 0.7) 1px, transparent 1px),
    linear-gradient(90deg, rgb(0 255 200 / 0.7) 1px, transparent 1px);
  background-size: 72px 48px;
  will-change: transform;
  animation: floor 2.6s linear infinite;
}

@keyframes floor {
  to {
    transform: translateY(48px);
  }
}
```

Moving by exactly one tile height makes the loop seamless.

A one-off hover sweep, run with a `background-position` transition, is fine. The problem is infinite or scroll-linked loops.

## Full-screen fixed overlays

A `position: fixed` overlay across the whole viewport (scanlines, noise, vignette) is composited over every frame of scrolling. On desktop it's usually fine. On phones we turn it off with `display: none` below 900 px.

## `content-visibility: auto` for long pages

Sections far below the fold don't need styling, layout or painting until the reader gets near them.

```css
.latest,
.signup,
.final,
.site-footer {
  content-visibility: auto;
  contain-intrinsic-size: auto 720px;
}
```

- `contain-intrinsic-size` reserves an estimated height so the scrollbar doesn't jump. The `auto` keyword remembers the real height once the section has rendered.
- Don't use it on sections your scroll scenes measure with `offsetTop` or `getBoundingClientRect`. The measurements would use the placeholder size, and reading them forces the section to render anyway.
- Don't use it on anything above the fold.

## `will-change`

`will-change: transform` promotes an element to its own layer, which makes transform animations cheap but costs GPU memory. Use it on things that move continuously (the grid floor, a custom cursor, a 3D canvas host), not as a blanket rule. anime.js doesn't need it to animate transforms.

## Properties to avoid animating

| Instead of animating | Do this |
| --- | --- |
| `width`, `height`, `top`, `left`, `margin` | `transform: translate()` / `scale()`. Use the FLIP technique when the layout really changes |
| `box-shadow` | Put the shadow on a pseudo-element and animate its `opacity` |
| `background-position` | Translate an oversized layer |
| `filter: blur()` per word | Blur whole blocks, desktop only |
| `backdrop-filter` over motion | A near-opaque fill |
| `clip-path` on large elements while scrolling | `overflow: hidden` on a wrapper plus a transform on the child |

## Reduced motion in CSS

Every CSS animation needs an off switch too:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Or, as in the demos, only add the animation under a `.motion` class that is set when reduced motion is *not* requested.
