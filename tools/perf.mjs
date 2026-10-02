import { chromium } from "playwright";

const [base = "http://localhost:5173", list = "/"] = process.argv.slice(2);
const paths = list.split(",");
const steps = Number(process.env.STEPS ?? 80);
const args = ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
if (process.env.SOFTWARE_GL) args.push("--use-angle=swiftshader");

const profiles = [
  { mode: "desktop", width: 1440, height: 900, scale: 1, cpu: 1, wheel: 120 },
  { mode: "mobile", width: 390, height: 844, scale: 3, cpu: 4, wheel: 90 },
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args });
const metrics = async (cdp) => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));

for (const p of profiles) {
  for (const path of paths) {
    const mobile = p.mode === "mobile";
    const ctx = await browser.newContext({ viewport: { width: p.width, height: p.height }, deviceScaleFactor: p.scale, isMobile: mobile, hasTouch: mobile });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Performance.enable");
    if (p.cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: p.cpu });

    await page.addInitScript(() => {
      window.__long = [];
      window.__lcp = 0;
      new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(e.duration))).observe({ type: "longtask", buffered: true });
      new PerformanceObserver((l) => l.getEntries().forEach((e) => (window.__lcp = e.startTime))).observe({ type: "largest-contentful-paint", buffered: true });
    });

    await page.goto(base + path, { waitUntil: "load" });
    await page.waitForTimeout(6000);

    const load = await page.evaluate(() => {
      const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0;
      const blocking = window.__long.reduce((s, d) => s + Math.max(0, d - 50), 0);
      return { fcp: Math.round(fcp), lcp: Math.round(window.__lcp), longTasks: window.__long.length, blocking: Math.round(blocking), worst: Math.round(Math.max(0, ...window.__long)) };
    });

    const before = await metrics(cdp);
    await page.evaluate(() => {
      window.__long = [];
      window.__frames = [];
      window.__run = true;
      let last = performance.now();
      const tick = (t) => {
        window.__frames.push(t - last);
        last = t;
        if (window.__run) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    for (let i = 0; i < steps; i++) {
      await page.mouse.wheel(0, p.wheel);
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(800);

    const scroll = await page.evaluate(() => {
      window.__run = false;
      const f = window.__frames.slice(2).sort((a, b) => a - b);
      const q = (n) => Math.round(f[Math.floor(f.length * n)] ?? 0);
      const blocking = window.__long.reduce((s, d) => s + Math.max(0, d - 50), 0);
      return { frames: f.length, p50: q(0.5), p95: q(0.95), longTasks: window.__long.length, blocking: Math.round(blocking) };
    });
    const after = await metrics(cdp);
    const ms = (k) => Math.round((after[k] - before[k]) * 1000);

    console.log(
      JSON.stringify({
        mode: p.mode,
        path,
        load,
        scroll: {
          ...scroll,
          scriptMs: ms("ScriptDuration"),
          styleMs: ms("RecalcStyleDuration"),
          layoutMs: ms("LayoutDuration"),
          styleRecalcs: after.RecalcStyleCount - before.RecalcStyleCount,
          layouts: after.LayoutCount - before.LayoutCount,
        },
      }),
    );
    await ctx.close();
  }
}

await browser.close();
