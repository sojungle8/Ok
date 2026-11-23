import * as THREE from "three";
import type { Slot, SpriteSheet } from "./sprites.ts";

const VERT = /* glsl */ `
attribute vec4 aUv;      // atlas rect (normalised): x, y, w, h — top-down
attribute vec2 aSize;    // frame size in pixels
attribute vec2 aOrigin;  // pivot (foot) inside the frame, pixels
attribute float aFlip;   // 1 = mirror horizontally (UV flip, no extra texture)
attribute float aScale;  // visual scale; simulation collision remains authoritative
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
  vec3 world = center + uRight * (px * uPx * aScale) - uUp * (py * uPx * aScale);
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

export class BillboardBatch {
  readonly mesh: THREE.InstancedMesh;
  readonly material: THREE.ShaderMaterial;
  readonly uv: THREE.InstancedBufferAttribute;
  readonly size: THREE.InstancedBufferAttribute;
  readonly origin: THREE.InstancedBufferAttribute;
  readonly flip: THREE.InstancedBufferAttribute;
  readonly scale: THREE.InstancedBufferAttribute;
  readonly sheet: SpriteSheet;

  constructor(sheet: SpriteSheet, capacity: number) {
    this.sheet = sheet;
    const geo = new THREE.PlaneGeometry(1, 1);
    this.uv = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    this.size = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 2), 2);
    this.origin = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 2), 2);
    this.flip = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    this.scale = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    for (const a of [this.uv, this.size, this.origin, this.flip, this.scale]) a.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("aUv", this.uv);
    geo.setAttribute("aSize", this.size);
    geo.setAttribute("aOrigin", this.origin);
    geo.setAttribute("aFlip", this.flip);
    geo.setAttribute("aScale", this.scale);
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

  set(i: number, x: number, y: number, z: number, slot: Slot, dir: number, timeMs: number, scale = 1): void {
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
    this.scale.setX(i, scale);
  }

  commit(count: number, right: THREE.Vector3, up: THREE.Vector3): void {
    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    for (const a of [this.uv, this.size, this.origin, this.flip, this.scale]) a.needsUpdate = true;
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
