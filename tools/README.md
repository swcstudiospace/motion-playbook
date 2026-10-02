# Measuring tools

Two Playwright scripts used to produce the numbers in the guide. See [Measuring](../docs/09-measuring.md) for what they report and how to read it.

```bash
npm install
npx playwright install chromium
node perf.mjs http://localhost:5173 /scroll-scene/,/scroll-scene/?mode=tweens
node idle-frames.mjs http://localhost:5173 /three-stage/,/reveal/
```

| Variable | Effect |
| --- | --- |
| `CHROMIUM_PATH` | Use a specific Chromium binary |
| `SOFTWARE_GL=1` | Force software WebGL, for machines without a GPU |
| `STEPS` | Number of wheel steps in the scroll test (default 80) |

They work against any URL, not just the demos.
