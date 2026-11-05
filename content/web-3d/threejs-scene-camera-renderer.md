---
title: Three.js in three objects
summary: A scene holds your stuff, a camera decides the view, a renderer paints it onto a canvas every frame. Learn those and the rest is detail.
tags: [threejs, basics, webgl]
order: 1
date: 2026-11-05
---

## The whole mental model

Every Three.js page, including the dream-home model you've already built, boils down to the same three objects. The **scene** is the world, the **camera** is where you stand in it, and the **renderer** takes both and paints a picture onto a `<canvas>`, around 60 times a second.

<figure class="dg"><svg viewBox="0 0 420 214" role="img" aria-label="Scene and camera both feed the renderer, which draws to a canvas every frame">
<rect class="box" x="14" y="14" width="180" height="120" rx="12"/><text x="28" y="38" class="b">Scene</text>
<g class="pop" style="animation-delay:.1s"><rect class="box hot" x="28" y="52" width="152" height="32" rx="8"/><text x="40" y="73" class="s">Mesh: shape + material</text></g>
<g class="pop" style="animation-delay:.25s"><rect class="box hot" x="28" y="92" width="152" height="30" rx="8"/><text x="40" y="112" class="s">Light</text></g>
<rect class="box" x="14" y="150" width="180" height="50" rx="12"/><text x="28" y="172" class="b">Camera</text><text x="28" y="189" class="m">where you look from</text>
<path class="flow" d="M196 74 C214 74 220 92 236 94"/>
<path class="flow" d="M196 175 C214 175 220 114 236 112"/>
<rect class="box hot" x="240" y="74" width="100" height="56" rx="12"/><text x="290" y="107" text-anchor="middle" class="b">Renderer</text>
<path class="flow" d="M262 70 C262 40 318 40 318 70"/>
<text class="m" x="290" y="34" text-anchor="middle">every frame</text>
<path class="flow" d="M342 102 H358"/>
<rect class="box" x="360" y="74" width="48" height="56" rx="8"/>
<rect class="spin" x="374" y="92" width="20" height="20" rx="3"/>
<text class="m" x="384" y="150" text-anchor="middle">canvas</text>
</svg><figcaption>The renderer combines scene and camera into one image, then does it again on the next frame.</figcaption></figure>

## Smallest working example

```js
import * as THREE from 'three';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 100);
camera.position.z = 4;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: '#2f86e0' })
);
scene.add(cube);
scene.add(new THREE.DirectionalLight('white', 3));

renderer.setAnimationLoop(() => {
  cube.rotation.y += 0.01;
  renderer.render(scene, camera);
});
```

## Things that trip people up

- **Black screen with a `MeshStandardMaterial`?** It reacts to light, and you haven't added any. Add a light, or swap to `MeshBasicMaterial` while debugging.
- **Axes.** `x` points right, `y` points up, `z` points toward you. The camera looks down negative `z` by default, which is why the example moves it back to `z = 4`.
- **Units are yours to decide.** Pick 1 unit = 1 metre and stick to it; lights, shadows and camera near/far planes all behave better when the scale is sensible.
- **Phones.** Cap the pixel ratio at 2, like the example does. A 3× screen renders 9 pixels for every CSS pixel and your frame rate pays for it.

> [!tip] Mesh = geometry + material
> Geometry is the shape (the points and triangles). Material is the surface (colour, shininess, texture). You can share one geometry across a hundred meshes with different materials.

```flashcards
Q: What are the three objects every Three.js app needs?
A: A scene, a camera and a renderer.
Q: Why is a MeshStandardMaterial cube black?
A: There's no light in the scene, and that material only shows up when lit.
Q: Which way does the default camera look?
A: Down the negative z axis.
Q: What two things make up a Mesh?
A: A geometry (the shape) and a material (the surface).
```

```quiz
? Your scene runs smoothly on a laptop but stutters on an iPhone. What's the first thing to check?
- Use a bigger far plane on the camera
+ Cap the renderer's pixel ratio at 2
- Switch from PerspectiveCamera to OrthographicCamera
= High-DPI phones can multiply the pixel count many times over. Capping the pixel ratio is the cheapest big win.
```
