import { chromium } from "playwright";

const [base = "http://localhost:5173", list = "/"] = process.argv.slice(2);
const paths = list.split(",");
const args = ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
if (process.env.SOFTWARE_GL) args.push("--use-angle=swiftshader");

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args });
const frames = (page) => page.evaluate(() => window.__frames);

for (const path of paths) {
  for (const reduced of [false, true]) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: reduced ? "reduce" : "no-preference" });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      window.__frames = 0;
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (cb) =>
        raf((t) => {
          window.__frames++;
          cb(t);
        });
    });
    await page.goto(base + path, { waitUntil: "load" });
    await page.waitForTimeout(4000);
    const a = await frames(page);
    await page.waitForTimeout(5000);
    const b = await frames(page);
    await page.waitForTimeout(6000);
    const c = await frames(page);
    await page.mouse.move(400, 400);
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(1500);
    const d = await frames(page);
    console.log(`${path}${reduced ? " (reduced motion)" : ""}: 4–9 s ${b - a} frames · 9–15 s idle ${c - b} frames · 1.5 s after scrolling ${d - c} frames`);
    await ctx.close();
  }
}

await browser.close();
