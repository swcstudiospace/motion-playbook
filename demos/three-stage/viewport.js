import { AmbientLight, DirectionalLight, Group, HemisphereLight, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from "three";
import { isCompact } from "../src/lib/env.js";

const STEP = 0.25;
const SLOW_MS = 22;
const FAST_MS = 12;
const COOLDOWN_MS = 1500;

export function createViewport(host) {
  let renderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch {
    return null;
  }
  renderer.debug.checkShaderErrors = false;

  const compact = isCompact();
  const device = window.devicePixelRatio || 1;
  const maxRatio = Math.min(device, compact ? 1.25 : 1.5);
  const minRatio = Math.min(maxRatio, compact ? 0.75 : 1);
  let ratio = maxRatio;
  let average = 16;
  let changedAt = 0;
  renderer.setPixelRatio(ratio);
  renderer.setClearColor(0x000000, 0);
  host.append(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(26, 1, 0.1, 200);
  const orbit = new Group();
  const pitch = new Group();
  const dolly = new Group();
  orbit.position.y = 1.4;
  camera.position.z = 18;
  orbit.add(pitch);
  pitch.add(dolly);
  dolly.add(camera);
  scene.add(orbit);
  scene.add(new HemisphereLight("#ffffff", "#d8ccff", 1.6), new AmbientLight("#ffffff", 0.3));
  const key = new DirectionalLight("#ffffff", 2.2);
  key.position.set(6, 10, 7);
  const rim = new DirectionalLight("#8b5cf6", 1.8);
  rim.position.set(-7, 4, -6);
  scene.add(key, rim);

  let w = 1;
  let h = 1;
  const resize = () => {
    w = Math.max(1, host.clientWidth);
    h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(host);

  const tmp = new Vector3();
  return {
    renderer,
    scene,
    camera,
    orbit,
    pitch,
    dolly,
    get ratio() {
      return ratio;
    },
    get frameMs() {
      return average;
    },
    width: () => w,
    height: () => h,
    render: () => renderer.render(scene, camera),
    prepare: () =>
      renderer.compileAsync(scene, camera).then(() => {
        const culled = [];
        scene.traverse((o) => {
          if (o.frustumCulled) {
            culled.push(o);
            o.frustumCulled = false;
          }
        });
        renderer.render(scene, camera);
        culled.forEach((o) => (o.frustumCulled = true));
      }),
    adapt: (frameMs) => {
      if (frameMs <= 0 || frameMs > 250) return;
      average += (frameMs - average) * 0.08;
      const now = performance.now();
      if (now - changedAt < COOLDOWN_MS) return;
      const next = average > SLOW_MS ? Math.max(minRatio, ratio - STEP) : average < FAST_MS ? Math.min(maxRatio, ratio + STEP) : ratio;
      if (next === ratio) return;
      ratio = next;
      changedAt = now;
      average = 16;
      renderer.setPixelRatio(ratio);
      renderer.setSize(w, h, false);
    },
    project: (target) => {
      target.getWorldPosition(tmp);
      tmp.project(camera);
      return { x: (tmp.x * 0.5 + 0.5) * w, y: (-tmp.y * 0.5 + 0.5) * h };
    },
    dispose: () => {
      observer.disconnect();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
