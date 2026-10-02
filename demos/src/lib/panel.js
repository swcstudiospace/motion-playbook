import { engine } from "animejs";

export function mountPanel(title, rows = {}) {
  const panel = document.createElement("aside");
  panel.className = "panel";
  panel.setAttribute("aria-label", `${title} readout`);
  const heading = document.createElement("p");
  heading.className = "panel__title";
  heading.textContent = title;
  const list = document.createElement("dl");
  panel.append(heading, list);
  document.body.append(panel);

  const cells = new Map();
  const set = (key, value) => {
    let cell = cells.get(key);
    if (!cell) {
      const dt = document.createElement("dt");
      dt.textContent = key;
      cell = document.createElement("dd");
      list.append(dt, cell);
      cells.set(key, cell);
    }
    const text = String(value);
    if (cell.textContent !== text) cell.textContent = text;
  };
  Object.entries(rows).forEach(([k, v]) => set(k, v));

  let blocking = 0;
  let longTasks = 0;
  if ("PerformanceObserver" in window && PerformanceObserver.supportedEntryTypes?.includes("longtask")) {
    new PerformanceObserver((list) => {
      list.getEntries().forEach((e) => {
        longTasks += 1;
        blocking += Math.max(0, e.duration - 50);
      });
    }).observe({ type: "longtask", buffered: true });
  }

  window.setInterval(() => {
    set("anime engine", engine.reqId ? "running" : "stopped");
    set("long tasks", `${longTasks} · ${Math.round(blocking)} ms blocking`);
  }, 500);

  return { set };
}
