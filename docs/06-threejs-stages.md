# 6. three.js stages driven by anime.js

Our site has a 3D sculpture behind its long chapters: the camera orbits, parts of the model move, and a swarm of 64 small units reassembles for each chapter. anime.js drives all of it. These are the things that made it smooth.

Demo: `demos/three-stage/`. The readout shows load status, pixel ratio, average frame time, shader programs and draw calls. Across our runs it was ready 350–700 ms after idle, with 4 programs and 15 draw calls.

## Load it late

three.js is the biggest thing on the page: the demo's stage chunk is 560 KB minified, about 140 KB gzipped. Keep it out of the first bundle completely.

```js
createScope({ root }).add((self) => {
  let stop = null;
  let live = true;
  const cancel = whenIdle(() => {
    import("./stage.js").then(({ setupStage }) => {
      if (live) stop = self.execute(() => setupStage(root));
    });
  });
  return () => {
    live = false;
    cancel();
    stop?.();
  };
});
```

The page is readable and scrollable before three.js has even downloaded. The stage fades in when it's ready.

## Renderer setup

```js
let renderer;
try {
  renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
} catch {
  return null;
}
renderer.debug.checkShaderErrors = false;
```

- **Don't probe for WebGL with a throwaway canvas.** Creating a second context just to check support costs a full context creation, and browsers limit how many you can have. Try to create the real renderer and handle the failure.
- **Turn off shader error checking in production.** When it's on, three.js asks the driver for compile status straight after compiling, which forces the compile to finish synchronously and stalls the main thread.

## Compile before the first frame, then prewarm

The first time three.js draws a material, it compiles a shader program. The first time it draws a mesh, it uploads its buffers. If that happens mid-scroll, when a new part of the model swings into view, you get a visible hitch.

```js
const prepare = () =>
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
  });
```

`compileAsync` uses parallel shader compilation where the browser supports it, so compiling doesn't block. The single render with culling switched off then uploads every mesh, including ones that are currently off camera. Only after this do we mark the stage ready and start the intro.

## Adaptive pixel ratio

Rendering at a phone's native 3× ratio is rarely worth it. Cap the ratio, then let measured frame times push it down or up.

```js
const maxRatio = Math.min(devicePixelRatio, compact ? 1.25 : 1.5);
const minRatio = Math.min(maxRatio, compact ? 0.75 : 1);
let ratio = maxRatio;
let average = 16;
let changedAt = 0;

function adapt(frameMs) {
  if (frameMs <= 0 || frameMs > 250) return;
  average += (frameMs - average) * 0.08;
  const now = performance.now();
  if (now - changedAt < 1500) return;
  const next = average > 22 ? Math.max(minRatio, ratio - 0.25) : average < 12 ? Math.min(maxRatio, ratio + 0.25) : ratio;
  if (next === ratio) return;
  ratio = next;
  changedAt = now;
  average = 16;
  renderer.setPixelRatio(ratio);
  renderer.setSize(width, height, false);
}
```

- The moving average (`0.08`) ignores one-off spikes.
- The 1.5 s cooldown stops the ratio flapping.
- Skipping frames over 250 ms ignores the gap after a tab switch or idle sleep.

## A camera rig with one job per group

```
orbit (rotateY) → pitch (rotateX) → dolly (z) → camera (z)
```

Each group has exactly one property that anime.js animates. Chapter changes animate `orbit.rotateY`, `pitch.rotateX` and `camera.z` on the scroll timeline; the intro animates `dolly.z`. Because they're separate objects, the scroll timeline and the intro never compete for the same property. See the composition gotcha in the [field guide](03-animejs-v4.md#gotchas-we-hit).

With the three.js adapter, these are ordinary timeline tweens:

```js
import "animejs/adapters/three";

tl.add(vp.orbit, { rotateY: cam.rot, duration: span }, start);
tl.add(vp.pitch, { rotateX: cam.pitch, duration: span }, start);
tl.add(vp.camera, { z: cam.dist, duration: span }, start);
```

## Many identical things: one InstancedMesh

The 64 swarm units are one `InstancedMesh`: one draw call, not 64. Their positions come from precomputed tracks sampled once per frame (see [Scroll scenes](04-scroll-scenes.md)), and they're written into the instance matrices with a single reused `Object3D`:

```js
for (let n = 0; n < COUNT; n++) {
  dummy.position.set(u.x, u.y, u.z);
  dummy.rotation.set(0, u.ry, 0);
  dummy.updateMatrix();
  units.setMatrixAt(n, dummy.matrix);
}
units.instanceMatrix.needsUpdate = true;
```

## Few materials, few programs

Each distinct material type and setup is a shader program to compile. The demo ends up with four: standard, standard with instancing, line and Lambert. Three standard materials share one program because they differ only in colours, which are uniforms. Before adding a material, check whether a colour change on an existing one would do.

## HTML labels that follow the model

Project an anchor `Object3D` to screen space each frame and move a DOM label with a transform. Cache each label's height, because reading `offsetHeight` every frame forces layout.

```js
const p = vp.project(anchor);
el.style.transform = `translate3d(${p.x}px, ${p.y - heightOf(el) / 2 - 10}px, 0) translateX(-50%)`;
```

Labels are decorative: the stage is `aria-hidden="true"` and `data-nosnippet`, and each label's text sits in a `data-text` attribute that CSS renders with `content: attr(data-text)`.

## Render only when it matters

- One `createTimer` drives the render loop, and `onScroll` plays it only while the stage is on screen.
- The anime.js engine pauses on hidden tabs, and our idle sleep pauses it after a few seconds without input. That stops rendering completely when the scene is still. See [Recipes: idle sleep](08-recipes.md#idle-sleep).
- Reduced motion renders a single still frame and never starts the loop.

## Clean up properly

```js
observer.disconnect();
renderer.dispose();
renderer.forceContextLoss();
renderer.domElement.remove();
```

`forceContextLoss` releases the GPU context straight away instead of waiting for garbage collection, which matters when people navigate back and forth in a single-page app.
