# 1. Designing motion that feels clean

Fast animation that looks wrong is still wrong. These are the design rules we settled on while building spectrumweb.co, a scroll-driven site where nearly everything moves.

## Every animation needs a job

Before adding motion, name what it does for the person on the page. If it doesn't do one of these, cut it or make it quieter.

| Job | Example |
| --- | --- |
| **Orient**: show where you are | A progress readout that tracks the current chapter |
| **Connect**: show cause and effect | A FAQ card that grows out of the question you clicked |
| **Explain**: show a change of state | A 3D model that reassembles when the section changes |
| **Reward**: acknowledge an action | A button that springs back after a press |
| **Atmosphere**: set the mood | A slow idle drift on a background object |

Atmosphere is seasoning. One ambient loop per screen is plenty, and it should be the first thing to stop when the device is struggling or the reader asks for less motion.

## One hero moment per screen

Pick the single thing on each screen that gets the big movement, and keep everything around it calm. When a 3D scene is reassembling behind a chapter, the chapter text just fades and rises. When a FAQ card takes over the grid, the other cards simply fade out. Two elements competing for attention read as noise, not polish.

## Timing scale

Use a small, fixed set of durations so the whole site feels like one system.

| Kind | Duration | Used for |
| --- | --- | --- |
| Micro | 120–200 ms | Hover, press, focus, icon flips |
| UI | 240–420 ms | Open, close, swap, toast |
| Entrance | 600–900 ms | Hero text, cards arriving, the intro of a scene |
| Scene | Scroll length | Anything scrubbed by scroll: it takes as long as the reader takes |

Exits run at about 60–70% of the matching entrance. In the FAQ morph, the other cards fade out in 260 ms and the card settles in 560 ms on open; closing collapses the answer in 240 ms and the card returns in 480 ms.

## Easing

| Movement | Ease | Why |
| --- | --- | --- |
| Something arriving | `out(3)` to `out(4)` | Fast start, gentle landing |
| Something leaving | `in(2)` | Accelerates away, so it never lingers |
| Moving between two states | `inOut(2)` to `inOut(3)` | Starts and ends at rest |
| Continuous loops, scrubbed holds | `linear` | Speed should be constant |
| Direct manipulation (cursor, drag) | `spring({ bounce, duration })` | Keeps momentum and feels physical |
| Playful pop-ins | `outBack(1.3)` to `outBack(2)` | A small overshoot, used sparingly |

## Stagger

Stagger reads as order. Keep each step between 16 ms (letters) and 110 ms (blocks), and keep the total under about 400 ms so the last item doesn't arrive late. Stagger in reading order, or `from: "center"` for symmetric groups. For many items, a deterministic shuffle like `((n * 7) % count) / (count - 1)` spreads arrivals without looking random.

## Scroll-linked motion

- Scrub, never hijack. The page scrolls at the reader's speed. Animations follow the scroll position; they never move the scroll position.
- Smooth the scrub with anime.js `sync` values between 0.45 and 0.7, so motion glides toward the scroll position instead of snapping. Under reduced motion, skip scrubbed motion entirely (see below).
- Give content an in, a hold and an out. A block fades and rises in, holds still while it's being read, then leaves as it scrolls past. Never animate text while it's in the reading zone.
- Don't stop the user from scrolling. If you pin to the top on load, release the moment the reader scrolls, taps or presses a key.

## Content is visible at rest

Motion enhances content that is already there; it never gates it.

- Your headline and first paragraph must be readable on the first frame, before JavaScript runs. See [First paint](05-first-paint.md).
- Anything you hide until JavaScript runs needs a CSS fallback that reveals it after a couple of seconds, in case the script never arrives.
- Nothing meant to be read should be stuck at `opacity: 0` waiting for an observer.

## Reverse what you open

Every state change you can open, you can close the same way. The FAQ morph runs the same FLIP backwards on close, and the other cards fade back in with the same stagger they left with. Close on Escape, on a second click, and on a click outside, and return focus to the trigger.

## Respect reduced motion

When `prefers-reduced-motion: reduce` matches:

- Snap to end states. Elements are simply visible.
- Keep instant state changes (a FAQ still opens) but drop the travel.
- Stop loops, idle drift and scrubbed transforms. A 3D scene can render one still frame.
- Don't animate the scroll position or parallax anything.

## Decorative text stays decorative

HUD readouts, coordinates, stage labels and "scroll to explore" hints are part of the picture, not the content. Mark their container `aria-hidden="true"` and `data-nosnippet`, and render their text with CSS `content: attr(data-text)` so search engines and screen readers never treat it as copy.
