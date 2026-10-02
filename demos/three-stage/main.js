import { createScope } from "animejs";
import { whenIdle } from "../src/lib/env.js";
import { setupIdle } from "../src/lib/idle.js";
import { mountPanel } from "../src/lib/panel.js";

const panel = mountPanel("three.js stage", { status: "waiting for idle" });
setupIdle();

const root = document.getElementById("main");
createScope({ root, mediaQueries: { reduce: "(prefers-reduced-motion: reduce)" } }).add((self) => {
  const reduce = Boolean(self?.matches.reduce);
  let stop = null;
  let live = true;
  const cancel = whenIdle(() => {
    panel.set("status", "loading three.js");
    import("./stage.js").then(({ setupStage }) => {
      if (live) stop = self.execute(() => setupStage(root, reduce, panel));
    });
    return () => {};
  });
  return () => {
    live = false;
    cancel();
    stop?.();
  };
});
