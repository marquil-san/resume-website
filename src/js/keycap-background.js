/**
 * Premium Mechanical Keyboard Keycap Background
 * Built with Three.js — vanilla JS, no framework
 *
 * Architecture:
 *  - One InstancedMesh covers the visible viewport (dynamic tile count)
 *  - Mouse drives a Gaussian pressure field → height + tilt per keycap
 *  - Per-instance color: tiles near cursor turn electric blue
 *  - Crack overlay: second InstancedMesh of flat planes with procedural
 *    crack texture that appears on the most-pressed tiles
 *  - EffectComposer → RenderPass + UnrealBloomPass for subtle bloom
 *  - All per-frame temporaries pre-allocated to avoid GC pressure
 */

import "../styles/keycap-background.css";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

// ============================================================
// CONFIG
// ============================================================

const CFG = {
  // Keycap geometry
  keycapW:     0.17,
  keycapH:     0.08,
  keycapD:     0.17,
  bevelRadius: 0.025,
  bevelSegs:   3,
  spacing:     0.21,

  // Camera
  camFov: 30,
  camY:   9.0,
  camZ:   3.2,

  // Material
  roughness:          0.28,
  metalness:          0.45,
  clearcoat:          0.8,
  clearcoatRoughness: 0.2,

  // Colors
  keycapColor:   0x1a1a1f,
  blueColor:     0x0055ff,   // vivid electric blue at peak
  rimLightColor: 0x1a55ff,
  keyLightColor: 0xffffff,

  // Mouse interaction
  pressureRadius: 1.75,
  pressureMaxH:   0.38,
  tiltStrength:   0.45,
  lerpSpeed:      1.0,

  // Crack overlay — tiles with height > crackThreshold start showing cracks
  crackThreshold: 0.72,   // fraction of pressureMaxH — high = tight radius
  crackIntensity: 2.5,    // scale multiplier so visible cracks are dramatic

  // Bloom
  bloomStrength:  1.4,
  bloomRadius:    0.6,
  bloomThreshold: 0.08,

  // Viewport margin
  marginTiles: 2,
};

// ============================================================
// SCENE SETUP
// ============================================================

const canvas = document.getElementById("canvas");

console.log("Canvas:", canvas);

export const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});

document.body.style.background = "red";
renderer.setClearColor(0x00ff00, 1);
renderer.clear();

console.log("Canvas:", renderer.domElement);
console.log("GL:", renderer.getContext());

console.log(renderer.domElement);

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080808);


export const camera = new THREE.PerspectiveCamera(CFG.camFov, 1, 0.1, 100);
camera.position.set(0, 5, 5);
camera.lookAt(0, 0, 0);

// ============================================================
// POST PROCESSING
// ============================================================

export const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  CFG.bloomStrength,
  CFG.bloomRadius,
  CFG.bloomThreshold,
);
composer.addPass(bloomPass);

// ============================================================
// LIGHTING
// ============================================================

const ambientLight = new THREE.AmbientLight(0x111122, 0.8);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(CFG.keyLightColor, 3.5);
keyLight.position.set(4, 12, 6);
keyLight.castShadow = true;
keyLight.shadow.mapSize.width  = 2048;
keyLight.shadow.mapSize.height = 2048;
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far  = 50;
keyLight.shadow.camera.left = keyLight.shadow.camera.bottom = -18;
keyLight.shadow.camera.right = keyLight.shadow.camera.top  =  18;
keyLight.shadow.bias = -0.0005;
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(CFG.rimLightColor, 3.5);
rimLight.position.set(-5, 6, -8);
scene.add(rimLight);

const fillLight = new THREE.PointLight(0x2233aa, 0.6, 30);
fillLight.position.set(8, 4, -4);
scene.add(fillLight);

// ============================================================
// SHADOW RECEIVER
// ============================================================

const floorGeo = new THREE.PlaneGeometry(60, 60);
const floorMat = new THREE.ShadowMaterial({ opacity: 0.25 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -CFG.keycapH / 2 - 0.01;
floor.receiveShadow = true;
scene.add(floor);

// ============================================================
// CRACK TEXTURE (procedurally drawn on a canvas)
// ============================================================

/**
 * Recursive branch: draw a crack segment then fork into sub-branches.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x, y   start point
 * @param {number} length  length of this segment
 * @param {number} angle   direction in radians
 * @param {number} depth   recursion depth
 */
function drawCrackBranch(ctx, x, y, length, angle, depth) {
  if (depth <= 0 || length < 4) return;

  // Add slight jitter to angle for natural look
  const jitter = (Math.random() - 0.5) * 0.55;
  const a = angle + jitter;
  const ex = x + Math.cos(a) * length;
  const ey = y + Math.sin(a) * length;

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(ex, ey);
  ctx.stroke();

  // Main continuation
  drawCrackBranch(ctx, ex, ey, length * 0.65, a, depth - 1);

  // Fork branch (appears with ~60% probability)
  if (Math.random() > 0.4) {
    const forkAngle = a + (Math.random() > 0.5 ? 1 : -1) * (0.4 + Math.random() * 0.5);
    drawCrackBranch(ctx, ex, ey, length * 0.45, forkAngle, depth - 2);
  }
}

/**
 * Generate a CanvasTexture containing a glowing blue crack pattern.
 * The pattern is seeded randomly once — all crack planes share this texture.
 */
function generateCrackTexture(size = 256) {
  const cvs = document.createElement("canvas");
  cvs.width = cvs.height = size;
  const ctx = cvs.getContext("2d");

  // Transparent background
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;

  // Outer glow pass (wide, dim)
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = "rgba(60, 130, 255, 0.25)";
  ctx.shadowColor = "#3388ff";
  ctx.shadowBlur  = 18;

  const arms = 5 + Math.floor(Math.random() * 3); // 5–7 main arms
  for (let i = 0; i < arms; i++) {
    const angle = (Math.PI * 2 * i) / arms + (Math.random() - 0.5) * 0.6;
    drawCrackBranch(ctx, cx, cy, size * 0.38, angle, 4);
  }

  // Core bright pass (narrow, vivid)
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = "rgba(130, 190, 255, 0.95)";
  ctx.shadowColor = "#88ccff";
  ctx.shadowBlur  = 8;

  for (let i = 0; i < arms; i++) {
    const angle = (Math.PI * 2 * i) / arms + (Math.random() - 0.5) * 0.6;
    drawCrackBranch(ctx, cx, cy, size * 0.38, angle, 4);
  }

  // Tiny bright centre dot
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.08);
  grad.addColorStop(0,   "rgba(200, 230, 255, 0.9)");
  grad.addColorStop(1,   "rgba(60, 130, 255, 0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.08, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(cvs);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const crackTexture = generateCrackTexture(256);

// ============================================================
// GRID CALCULATION
// ============================================================

function calcGrid() {
  const aspect = window.innerWidth / window.innerHeight;
  const fovRad = (CFG.camFov * Math.PI) / 180;
  const camDist = CFG.camY;
  const halfH   = Math.tan(fovRad / 2) * camDist;
  const halfW   = halfH * aspect;
  const margin  = CFG.spacing * (CFG.marginTiles + 1);

  const cols = Math.ceil((halfW * 2 + margin * 2) / CFG.spacing) + 1;
  const rows = Math.ceil((halfH * 2 + margin * 2) / CFG.spacing) + 1;

  const c = cols % 2 === 0 ? cols + 1 : cols;
  const r = rows % 2 === 0 ? rows + 1 : rows;
  return { cols: c, rows: r };
}

// ============================================================
// KEYCAP MATERIAL & GEOMETRY
// ============================================================

const keycapGeo = new RoundedBoxGeometry(
  CFG.keycapW, CFG.keycapH, CFG.keycapD,
  CFG.bevelSegs, CFG.bevelRadius,
);

const keycapMat = new THREE.MeshPhysicalMaterial({
  color:              new THREE.Color(CFG.keycapColor),
  roughness:          CFG.roughness,
  metalness:          CFG.metalness,
  clearcoat:          CFG.clearcoat,
  clearcoatRoughness: CFG.clearcoatRoughness,
  envMapIntensity:    0.6,
});

// ============================================================
// CRACK OVERLAY MATERIAL & GEOMETRY
// ============================================================

// Flat plane — same XZ footprint as a keycap, rendered just above the top face
const crackGeo = new THREE.PlaneGeometry(CFG.keycapW * 1.15, CFG.keycapD * 1.15);

const crackMat = new THREE.MeshBasicMaterial({
  map:         crackTexture,
  transparent: true,
  opacity:     1.0,
  blending:    THREE.AdditiveBlending,
  depthWrite:  false,
  side:        THREE.DoubleSide,
});

// ============================================================
// INSTANCED MESHES
// ============================================================

let { cols, rows } = calcGrid();
let instanceCount = cols * rows;

// Keycap mesh
let mesh = new THREE.InstancedMesh(keycapGeo, keycapMat, instanceCount);
mesh.castShadow    = true;
mesh.receiveShadow = true;
scene.add(mesh);

// Crack overlay mesh (same count — hidden by scaling to 0 when not active)
let crackMesh = new THREE.InstancedMesh(crackGeo, crackMat, instanceCount);
crackMesh.castShadow    = false;
crackMesh.receiveShadow = false;
scene.add(crackMesh);

// Per-tile data
let tileX   = new Float32Array(instanceCount);
let tileZ   = new Float32Array(instanceCount);
let heights = new Float32Array(instanceCount);
let targetH = new Float32Array(instanceCount);

// Pre-allocated colour objects (avoid per-frame allocation)
const _colorBase = new THREE.Color(CFG.keycapColor);
const _colorBlue = new THREE.Color(CFG.blueColor);
const _colorTmp  = new THREE.Color();

// ============================================================
// INSTANCE COLOUR INITIALISATION
// ============================================================

/**
 * Must be called whenever a new InstancedMesh is created so the
 * instanceColor buffer is allocated (Three.js lazy-inits it on
 * the first setColorAt call).
 */
function initInstanceColors(m, count) {
  for (let i = 0; i < count; i++) {
    m.setColorAt(i, _colorBase);
  }
  m.instanceColor.needsUpdate = true;
}

// ============================================================
// GRID LAYOUT
// ============================================================

function buildGrid(c, r) {
  const startX = -((c - 1) * CFG.spacing) / 2;
  const startZ = -((r - 1) * CFG.spacing) / 2;
  let idx = 0;
  for (let ri = 0; ri < r; ri++) {
    for (let ci = 0; ci < c; ci++) {
      tileX[idx] = startX + ci * CFG.spacing;
      tileZ[idx] = startZ + ri * CFG.spacing;
      heights[idx] = 0;
      targetH[idx] = 0;
      idx++;
    }
  }
}

buildGrid(cols, rows);
initInstanceColors(mesh, instanceCount);

// ============================================================
// PRE-ALLOCATED PER-FRAME TEMPORARIES
// ============================================================

const _mat   = new THREE.Matrix4();
const _matC  = new THREE.Matrix4();   // for crack planes
const _pos   = new THREE.Vector3();
const _quat  = new THREE.Quaternion();
const _sclK  = new THREE.Vector3(1, 1, 1);  // keycap scale (always 1)
const _sclC  = new THREE.Vector3();          // crack scale (varies)
const _eul   = new THREE.Euler();

// ============================================================
// MOUSE / POINTER TRACKING
// ============================================================

export const mouse = { x: 0, y: 0, active: false };
const mouseWorld = new THREE.Vector3();
const raycaster  = new THREE.Raycaster();
const gridPlane  = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _rayTarget = new THREE.Vector3();

window.addEventListener("mousemove", (e) => {
  mouse.x = (e.clientX / window.innerWidth)  *  2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  mouse.active = true;
}, { passive: true });

window.addEventListener("touchmove", (e) => {
  if (!e.touches.length) return;
  const t = e.touches[0];
  mouse.x = (t.clientX / window.innerWidth)  *  2 - 1;
  mouse.y = -(t.clientY / window.innerHeight) * 2 + 1;
  mouse.active = true;
}, { passive: true });

window.addEventListener("mouseleave", () => { mouse.active = false; });
window.addEventListener("touchend",   () => { mouse.active = false; });

function updateMouseWorld() {
  raycaster.setFromCamera(mouse, camera);
  if (raycaster.ray.intersectPlane(gridPlane, _rayTarget)) {
    mouseWorld.copy(_rayTarget);
  }
}

// ============================================================
// PRESSURE FIELD + TILT + COLOUR + CRACK UPDATE
// ============================================================

function gaussian(dx, dz, sigma) {
  return Math.exp(-(dx * dx + dz * dz) / (2 * sigma * sigma));
}

function updateInstances(dt) {
  const sigma  = CFG.pressureRadius;
  const maxH   = CFG.pressureMaxH;
  const active = mouse.active;
  const mx = mouseWorld.x;
  const mz = mouseWorld.z;

  // --- Target heights ---
  for (let i = 0; i < instanceCount; i++) {
    if (active) {
      const dx = tileX[i] - mx;
      const dz = tileZ[i] - mz;
      targetH[i] = maxH * gaussian(dx, dz, sigma);
    } else {
      targetH[i] = 0;
    }
  }

  // --- Lerp heights (frame-rate independent) ---
  const alpha = 1 - Math.pow(1 - CFG.lerpSpeed, dt * 60);
  for (let i = 0; i < instanceCount; i++) {
    heights[i] += (targetH[i] - heights[i]) * alpha;
  }

  // --- Per-tile: matrix + colour + crack ---
  for (let ri = 0; ri < rows; ri++) {
    for (let ci = 0; ci < cols; ci++) {
      const i = ri * cols + ci;
      const h = heights[i];

      // Finite-difference slope
      const iL = ri * cols + Math.max(ci - 1, 0);
      const iR = ri * cols + Math.min(ci + 1, cols - 1);
      const iU = Math.max(ri - 1, 0) * cols + ci;
      const iD = Math.min(ri + 1, rows - 1) * cols + ci;

      const dhdx = (heights[iR] - heights[iL]) / (CFG.spacing * 2);
      const dhdz = (heights[iD] - heights[iU]) / (CFG.spacing * 2);

      const tiltZ = -dhdx * CFG.tiltStrength;
      const tiltX =  dhdz * CFG.tiltStrength;

      // ---- Keycap instance matrix ----
      _eul.set(tiltX, 0, tiltZ, "XYZ");
      _quat.setFromEuler(_eul);
      _pos.set(tileX[i], h, tileZ[i]);
      _mat.compose(_pos, _quat, _sclK);
      mesh.setMatrixAt(i, _mat);

      // ---- Per-instance colour: lerp graphite → blue ----
      // normalised proximity in [0, 1]
      const t = Math.min(h / maxH, 1);
      _colorTmp.lerpColors(_colorBase, _colorBlue, t);
      mesh.setColorAt(i, _colorTmp);

      // ---- Crack overlay matrix ----
      // Crack plane sits just above keycap top face (y = h + keycapH/2 + epsilon)
      // It is horizontal, tilted to match keycap, scaled by crack intensity.
      const crackT = Math.max((t - CFG.crackThreshold) / (1 - CFG.crackThreshold), 0);
      const cs = Math.min(crackT * CFG.crackIntensity, 1.6); // overdrive a bit for drama

      _eul.set(tiltX - Math.PI / 2, 0, tiltZ, "XYZ");
      _quat.setFromEuler(_eul);
      _pos.set(tileX[i], h + CFG.keycapH * 0.5 + 0.003, tileZ[i]);
      _sclC.set(cs, cs, cs);
      _matC.compose(_pos, _quat, _sclC);
      crackMesh.setMatrixAt(i, _matC);
    }
  }

  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate  = true;
  crackMesh.instanceMatrix.needsUpdate = true;
}

// ============================================================
// RESIZE
// ============================================================

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);

  const prev = instanceCount;
  const g = calcGrid();
  cols = g.cols;
  rows = g.rows;
  instanceCount = cols * rows;

  if (instanceCount > prev) {
    // Need more instances — rebuild both meshes
    scene.remove(mesh);
    scene.remove(crackMesh);
    mesh.dispose();
    crackMesh.dispose();

    tileX   = new Float32Array(instanceCount);
    tileZ   = new Float32Array(instanceCount);
    heights = new Float32Array(instanceCount);
    targetH = new Float32Array(instanceCount);

    mesh = new THREE.InstancedMesh(keycapGeo, keycapMat, instanceCount);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);

    crackMesh = new THREE.InstancedMesh(crackGeo, crackMat, instanceCount);
    scene.add(crackMesh);

    initInstanceColors(mesh, instanceCount);
  } else {
    heights.fill(0);
    targetH.fill(0);
  }

  buildGrid(cols, rows);
}

window.addEventListener("resize", onResize, { passive: true });

onResize();

export { onResize };

// ============================================================
// ANIMATION LOOP
// ============================================================

const timer = new THREE.Timer();

export function updateKeycapBackground() {
    console.log("Keycap update");

  timer.update();

  const dt = Math.min(timer.getDelta(), 0.05);

  if (mouse.active) {
    updateMouseWorld();
  }

  updateInstances(dt);

  renderer.render(scene, camera);

}
