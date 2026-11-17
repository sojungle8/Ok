import * as THREE from "three";
import type { RenderSnapshot } from "@ro-survivor/core-sim";
import type { Slot, SpriteSheet } from "./sprites.ts";

const VERT = /* glsl */ `
attribute vec4 aUv;      // atlas rect (normalised): x, y, w, h — top-down
attribute vec2 aSize;    // frame size in pixels
attribute vec2 aOrigin;  // pivot (foot) inside the frame, pixels
attribute float aFlip;   // 1 = mirror horizontally (UV flip, no extra texture)
uniform vec3 uRight;
uniform vec3 uUp;
uniform float uPx;
varying vec2 vUv;
void main() {
  vec3 center = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float u = position.x + 0.5;
  float v = 0.5 - position.y;
  float px = u * aSize.x - aOrigin.x;
  float py = v * aSize.y - aOrigin.y;
  vec3 world = center + uRight * (px * uPx) - uUp * (py * uPx);
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  float su = aFlip > 0.5 ? 1.0 - u : u;
  vUv = vec2(aUv.x + su * aUv.z, aUv.y + v * aUv.w);
}`;

const FRAG = /* glsl */ `
uniform sampler2D uMap;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(uMap, vUv);
  if (c.a < 0.5) discard;
  gl_FragColor = c;
  #include <colorspace_fragment>
}`;

class BillboardBatch {
  readonly mesh: THREE.InstancedMesh;
  readonly material: THREE.ShaderMaterial;
  readonly uv: THREE.InstancedBufferAttribute;
  readonly size: THREE.InstancedBufferAttribute;
  readonly origin: THREE.InstancedBufferAttribute;
  readonly flip: THREE.InstancedBufferAttribute;
  readonly sheet: SpriteSheet;

  constructor(sheet: SpriteSheet, capacity: number) {
    this.sheet = sheet;
    const geo = new THREE.PlaneGeometry(1, 1);
    this.uv = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    this.size = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 2), 2);
    this.origin = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 2), 2);
    this.flip = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    for (const a of [this.uv, this.size, this.origin, this.flip]) a.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("aUv", this.uv);
    geo.setAttribute("aSize", this.size);
    geo.setAttribute("aOrigin", this.origin);
    geo.setAttribute("aFlip", this.flip);
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uMap: { value: sheet.texture }, uRight: { value: new THREE.Vector3(1, 0, 0) }, uUp: { value: new THREE.Vector3(0, 1, 0) }, uPx: { value: sheet.pxToWorld } },
    });
    this.mesh = new THREE.InstancedMesh(geo, this.material, capacity);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
  }

  set(i: number, x: number, y: number, z: number, slot: Slot, dir: number, timeMs: number): void {
    const d = this.sheet.data;
    const anim = d.slots[slot].directions[dir] ?? d.slots.idle.directions[0];
    const frames = anim?.frames ?? [0];
    const idx = frames[Math.floor(timeMs / Math.max(1, anim?.delayMs ?? 100)) % frames.length] ?? 0;
    const f = d.frames[idx];
    if (!f) return;
    const m = new THREE.Matrix4().makeTranslation(x, y, z);
    this.mesh.setMatrixAt(i, m);
    this.uv.setXYZW(i, f.x / d.atlas.width, f.y / d.atlas.height, f.w / d.atlas.width, f.h / d.atlas.height);
    this.size.setXY(i, f.w, f.h);
    this.origin.setXY(i, f.originX, f.originY);
    this.flip.setX(i, f.flipX ? 1 : 0);
  }

  commit(count: number, right: THREE.Vector3, up: THREE.Vector3): void {
    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    for (const a of [this.uv, this.size, this.origin, this.flip]) a.needsUpdate = true;
    (this.material.uniforms.uRight as { value: THREE.Vector3 }).value.copy(right);
    (this.material.uniforms.uUp as { value: THREE.Vector3 }).value.copy(up);
  }
}

export interface GroundData {
  /** GAT cells, metres per cell = 1. */
  width: number;
  height: number;
  /** One digit per cell (GAT type), row-major, y=0 south. */
  types: string;
  /** Average GAT height per cell (RO units, negative = up). */
  cellHeights: number[];
}

/** Renders the arena from RenderSnapshots only. It never mutates simulation state. */
export class ArenaRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  readonly #player: BillboardBatch;
  readonly #enemies: BillboardBatch;
  readonly #shadows: THREE.InstancedMesh;
  #ground: THREE.Mesh | null = null;
  #overlay: THREE.Mesh | null = null;
  #heightAt: (x: number, y: number) => number = () => 0;
  readonly viewHeightM: number;
  textureBytes: number;

  constructor(canvas: HTMLCanvasElement, player: SpriteSheet, enemy: SpriteSheet, options: { capacity: number; viewHeightM?: number; pixelRatio?: number }) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(options.pixelRatio ?? window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x8fb6d8);
    this.viewHeightM = options.viewHeightM ?? 22;
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
    this.#player = new BillboardBatch(player, 1);
    this.#enemies = new BillboardBatch(enemy, options.capacity);
    const shadowGeo = new THREE.CircleGeometry(0.42, 16).rotateX(-Math.PI / 2);
    this.#shadows = new THREE.InstancedMesh(shadowGeo, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false, depthTest: false }), options.capacity + 1);
    this.#shadows.frustumCulled = false;
    // Shadows draw after the ground and before sprites, ignoring depth, so slopes never clip them.
    this.#shadows.renderOrder = 1;
    this.#enemies.mesh.renderOrder = 2;
    this.#player.mesh.renderOrder = 3;
    this.scene.add(this.#shadows, this.#enemies.mesh, this.#player.mesh);
    this.textureBytes = player.textureBytes + enemy.textureBytes;
    this.setGround(null);
  }

  /** Ground from GAT data (or a placeholder field). Y-up world: sim (x, y north) -> (X, -Z). */
  setGround(data: GroundData | null): void {
    if (this.#ground) this.scene.remove(this.#ground);
    if (this.#overlay) this.scene.remove(this.#overlay);
    const w = data?.width ?? 120;
    const h = data?.height ?? 120;
    // Real maps start at (0,0) in GAT cells; the placeholder field is centred on the origin.
    const off = data ? 0 : -w / 2;
    const heightAt = (cx: number, cy: number): number => {
      if (!data) return 0;
      const x = Math.max(0, Math.min(w - 1, cx));
      const y = Math.max(0, Math.min(h - 1, cy));
      return -(data.cellHeights[y * w + x] ?? 0) * 0.2;
    };
    this.#heightAt = (xm, ym) => heightAt(Math.floor(xm), Math.floor(ym));
    const geo = new THREE.PlaneGeometry(w, h, w, h).rotateX(-Math.PI / 2);
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const overlayColors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i += 1) {
      const vx = pos.getX(i) + w / 2;
      const vz = pos.getZ(i) + h / 2;
      const cx = Math.min(w - 1, Math.floor(vx));
      const cy = Math.min(h - 1, Math.floor(h - vz));
      pos.setXYZ(i, vx + off, heightAt(cx, cy), -(h - vz + off));
      const checker = (Math.floor(vx / 4) + Math.floor(vz / 4)) % 2 === 0 ? 0.04 : 0;
      colors.set([0.36 + checker, 0.55 + checker, 0.3], i * 3);
      const t = data ? data.types.charCodeAt(cy * w + cx) - 48 : 0;
      overlayColors.set(t === 0 || t === 3 ? [0.2, 0.75, 0.3] : [0.85, 0.15, 0.15], i * 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    this.#ground = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }));
    const ogeo = geo.clone();
    ogeo.setAttribute("color", new THREE.BufferAttribute(overlayColors, 3));
    this.#overlay = new THREE.Mesh(ogeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
    this.#overlay.visible = false;
    this.scene.add(this.#ground, this.#overlay);
  }

  setDebugOverlay(on: boolean): void {
    if (this.#overlay) this.#overlay.visible = on;
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    const aspect = width / Math.max(1, height);
    const vh = this.viewHeightM / 2;
    this.camera.left = -vh * aspect;
    this.camera.right = vh * aspect;
    this.camera.top = vh;
    this.camera.bottom = -vh;
    this.camera.updateProjectionMatrix();
  }

  render(snap: RenderSnapshot, timeMs: number): void {
    const px = snap.player.x / 1000;
    const pz = -snap.player.y / 1000;
    const py = this.#heightAt(px, snap.player.y / 1000);
    this.camera.position.set(px, py + 30, pz + 30);
    this.camera.lookAt(px, py, pz);
    this.camera.updateMatrixWorld();
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
    const m = new THREE.Matrix4();
    this.#player.set(0, px, py, pz, snap.player.moving ? "walk" : "idle", snap.player.dir, timeMs);
    this.#player.commit(1, right, up);
    this.#shadows.setMatrixAt(0, m.makeTranslation(px, py + 0.02, pz));
    const e = snap.enemies;
    for (let i = 0; i < snap.enemyCount; i += 1) {
      const ex = (e[i * 5 + 1] as number) / 1000;
      const ey = (e[i * 5 + 2] as number) / 1000;
      const eh = this.#heightAt(ex, ey);
      this.#enemies.set(i, ex, eh, -ey, e[i * 5 + 4] ? "walk" : "idle", e[i * 5 + 3] as number, timeMs + (e[i * 5] as number) * 37);
      this.#shadows.setMatrixAt(i + 1, m.makeTranslation(ex, eh + 0.02, -ey));
    }
    this.#enemies.commit(snap.enemyCount, right, up);
    this.#shadows.count = snap.enemyCount + 1;
    this.#shadows.instanceMatrix.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
