import * as THREE from "three";
import type { DerivedSkillEffectTexture } from "@ro-survivor/asset-contracts";
import type { RunEvent } from "@ro-survivor/core-sim";
import type { WorldSkillEffectLayer } from "../terrain.ts";
import type { FormalSceneData, ImageLike } from "./load.ts";
import type { TextureFactory } from "./world.ts";

export const SHIELD_WAVE_EFFECT_ID = "effect.skill.sw.shield_wave.projectile";
export const SHIELD_WAVE_CAPACITY = 32;
export const SHIELD_WAVE_MAX_PER_CAST = 10;
export const ENDURE_EFFECT_ID = "effect.skill.sw.endure";
export const ENDURE_CAPACITY = 1;
export const ENDURE_DURATION_MS = 900;
const SHIELD_WAVE_SOURCE = "skill.sw.shield_wave";
const ENDURE_SOURCE = "skill.sw.endure";
const TICK_MS = 1000 / 60;

export interface ShieldWaveCue {
  id: number;
  geomId: string;
  targetId: number | null;
  fromXmm: number;
  fromYmm: number;
  toXmm: number;
  toYmm: number;
  startMs: number;
  endMs: number;
  spinPhase: number;
}

export interface ShieldWaveSample {
  xMm: number;
  yMm: number;
  arcM: number;
  rotation: number;
  opacity: number;
  visible: boolean;
}

export interface EndureCue {
  geomId: string;
  startMs: number;
  endMs: number;
}

export interface EndureSample {
  opacity: number;
  scale: number;
  visible: boolean;
}

function normalizedDirection(x: number, y: number): [number, number] {
  const length = Math.hypot(x, y);
  return length > 0 ? [x / length, y / length] : [0, -1];
}

function cueDurationMs(fromXmm: number, fromYmm: number, toXmm: number, toYmm: number): number {
  const distanceM = Math.hypot(toXmm - fromXmm, toYmm - fromYmm) / 1000;
  return Math.max(160, Math.min(320, Math.round((distanceM / 16) * 1000)));
}

/** Pure presentation sampling: gameplay remains instantaneous and authoritative. */
export function sampleShieldWaveCue(cue: ShieldWaveCue, nowMs: number): ShieldWaveSample {
  const duration = Math.max(1, cue.endMs - cue.startMs);
  const progress = Math.max(0, Math.min(1, (nowMs - cue.startMs) / duration));
  const fade = progress < 0.72 ? 1 : Math.max(0, (1 - progress) / 0.28);
  return {
    xMm: cue.fromXmm + (cue.toXmm - cue.fromXmm) * progress,
    yMm: cue.fromYmm + (cue.toYmm - cue.fromYmm) * progress,
    arcM: 0.35 * 4 * progress * (1 - progress),
    rotation: cue.spinPhase + progress * Math.PI * 4,
    opacity: fade,
    visible: nowMs >= cue.startMs && nowMs < cue.endMs,
  };
}

/** Short, independent cast presentation; authoritative buff duration remains simulation-only. */
export function sampleEndureCue(cue: EndureCue, nowMs: number): EndureSample {
  const duration = Math.max(1, cue.endMs - cue.startMs);
  const progress = Math.max(0, Math.min(1, (nowMs - cue.startMs) / duration));
  const fadeIn = Math.min(1, progress / 0.15);
  const fadeOut = Math.min(1, (1 - progress) / 0.25);
  return {
    opacity: Math.max(0, Math.min(fadeIn, fadeOut)),
    scale: 0.85 + Math.sin(progress * Math.PI) * 0.2,
    visible: nowMs >= cue.startMs && nowMs < cue.endMs,
  };
}

/**
 * Bounded, replay-safe presentation queue. A cue follows every authoritative Shield Wave hit. If a
 * cast reports no usable hit position, one cue follows the authoritative sector direction/range.
 */
export class ShieldWavePresentation {
  readonly cues: ShieldWaveCue[] = [];
  #lastEvents: readonly RunEvent[] | null = null;
  #nextId = 1;

  ingest(events: readonly RunEvent[], nowMs: number): void {
    if (events === this.#lastEvents) {
      this.prune(nowMs);
      return;
    }
    this.#lastEvents = events;
    const casts = events.filter((event): event is Extract<RunEvent, { type: "skill" }> => event.type === "skill" && event.source === SHIELD_WAVE_SOURCE);
    const maxTick = events.reduce((max, event) => Math.max(max, event.tick), 0);
    for (const cast of casts) {
      const castMs = nowMs - Math.max(0, maxTick - cast.tick) * TICK_MS;
      const hits = events.filter((event): event is Extract<RunEvent, { type: "hit" }> =>
        event.type === "hit"
        && event.source === SHIELD_WAVE_SOURCE
        && event.geomId === cast.geomId
        && Number.isFinite(event.xMm)
        && Number.isFinite(event.yMm),
      ).slice(0, SHIELD_WAVE_MAX_PER_CAST);
      if (hits.length > 0) {
        for (const hit of hits) this.add(cast.geomId, hit.targetId ?? null, cast.origin.xMm, cast.origin.yMm, hit.xMm as number, hit.yMm as number, castMs);
      } else {
        const range = cast.geometry && cast.geometry.shape !== "circle" ? cast.geometry.rangeMm : 1000;
        const [dx, dy] = normalizedDirection(cast.direction.x, cast.direction.y);
        this.add(cast.geomId, null, cast.origin.xMm, cast.origin.yMm, cast.origin.xMm + dx * range, cast.origin.yMm + dy * range, castMs);
      }
    }
    if (this.cues.length > SHIELD_WAVE_CAPACITY) this.cues.splice(0, this.cues.length - SHIELD_WAVE_CAPACITY);
    this.prune(nowMs);
  }

  prune(nowMs: number): void {
    for (let i = this.cues.length - 1; i >= 0; i -= 1) if (nowMs >= (this.cues[i]?.endMs ?? 0)) this.cues.splice(i, 1);
  }

  clear(): void {
    this.cues.splice(0);
    this.#lastEvents = null;
  }

  private add(geomId: string, targetId: number | null, fromXmm: number, fromYmm: number, toXmm: number, toYmm: number, startMs: number): void {
    const id = this.#nextId++;
    this.cues.push({
      id, geomId, targetId, fromXmm, fromYmm, toXmm, toYmm, startMs,
      endMs: startMs + cueDurationMs(fromXmm, fromYmm, toXmm, toYmm),
      spinPhase: (id % 8) * Math.PI / 4,
    });
  }
}

/** A single player-bound Endure cue. A new authoritative cast refreshes the one bounded slot. */
export class EndurePresentation {
  cue: EndureCue | null = null;
  #lastEvents: readonly RunEvent[] | null = null;

  ingest(events: readonly RunEvent[], nowMs: number): void {
    if (events === this.#lastEvents) {
      this.prune(nowMs);
      return;
    }
    this.#lastEvents = events;
    const casts = events.filter((event): event is Extract<RunEvent, { type: "skill" }> => event.type === "skill" && event.source === ENDURE_SOURCE);
    if (casts.length > 0) {
      const maxTick = events.reduce((max, event) => Math.max(max, event.tick), 0);
      const cast = casts.reduce((latest, candidate) => candidate.tick >= latest.tick ? candidate : latest);
      const startMs = nowMs - Math.max(0, maxTick - cast.tick) * TICK_MS;
      this.cue = { geomId: cast.geomId, startMs, endMs: startMs + ENDURE_DURATION_MS };
    }
    this.prune(nowMs);
  }

  prune(nowMs: number): void {
    if (this.cue && nowMs >= this.cue.endMs) this.cue = null;
  }

  clear(): void {
    this.cue = null;
    this.#lastEvents = null;
  }
}

const EFFECT_VERT = /* glsl */ `
attribute float aRotation;
attribute float aOpacity;
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec2 uSize;
varying vec2 vUv;
varying float vOpacity;
void main() {
  vec3 center = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float c = cos(aRotation);
  float s = sin(aRotation);
  vec2 p = vec2(position.x * uSize.x, position.y * uSize.y);
  vec2 r = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
  vec3 world = center + uRight * r.x + uUp * r.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  vUv = vec2(uv.x, 1.0 - uv.y);
  vOpacity = aOpacity;
}`;

const EFFECT_FRAG = /* glsl */ `
uniform sampler2D uMap;
varying vec2 vUv;
varying float vOpacity;
void main() {
  vec4 c = texture2D(uMap, vUv);
  if (c.a < 0.01) discard;
  gl_FragColor = vec4(c.rgb, c.a * vOpacity);
  #include <colorspace_fragment>
}`;

interface EffectGpu {
  mesh: THREE.InstancedMesh;
  material: THREE.ShaderMaterial;
  rotation: THREE.InstancedBufferAttribute;
  opacity: THREE.InstancedBufferAttribute;
  texture: THREE.Texture;
}

function requireTexture(
  data: FormalSceneData,
  assetId: string,
  expected: { format: "bmp" | "tga"; bitsPerPixel: 24 | 32; alpha: "ro-color-key" | "source-alpha" },
): { meta: DerivedSkillEffectTexture; image: ImageLike } {
  const meta = data.effects.get(assetId);
  const image = data.effectImages.get(assetId);
  if (!meta || meta.kind !== "texture" || meta.format !== expected.format) {
    throw new Error(`${assetId}: verified ${expected.format.toUpperCase()} metadata not loaded`);
  }
  if (meta.bitsPerPixel !== expected.bitsPerPixel || meta.alpha.mode !== expected.alpha) {
    throw new Error(`${assetId}: verified ${expected.bitsPerPixel}-bit ${expected.alpha} metadata required`);
  }
  if (meta.width !== 64 || meta.height !== 64 || image?.width !== 64 || image.height !== 64) {
    throw new Error(`${assetId}: expected verified 64x64 image`);
  }
  return { meta, image };
}

function createEffectGpu(meta: DerivedSkillEffectTexture, image: ImageLike, capacity: number, makeTexture: TextureFactory, assetId: string): EffectGpu {
  const texture = makeTexture(image, {});
  let geometry: THREE.PlaneGeometry | null = null;
  let material: THREE.ShaderMaterial | null = null;
  try {
    geometry = new THREE.PlaneGeometry(1, 1);
    const rotation = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    const opacity = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    for (const attribute of [rotation, opacity]) attribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("aRotation", rotation);
    geometry.setAttribute("aOpacity", opacity);
    material = new THREE.ShaderMaterial({
      vertexShader: EFFECT_VERT,
      fragmentShader: EFFECT_FRAG,
      uniforms: {
        uMap: { value: texture },
        uRight: { value: new THREE.Vector3(1, 0, 0) },
        uUp: { value: new THREE.Vector3(0, 1, 0) },
        uSize: { value: new THREE.Vector2(meta.width * 0.025, meta.height * 0.025) },
      },
      transparent: true,
      depthWrite: false,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, capacity);
    mesh.count = 0;
    mesh.renderOrder = 6;
    mesh.frustumCulled = false;
    mesh.userData = { formal: "skill-effect", sourceAssetId: assetId };
    return { mesh, material, rotation, opacity, texture };
  } catch (err) {
    geometry?.dispose();
    material?.dispose();
    texture.dispose();
    throw err;
  }
}

/** Two verified original-RO textures in two bounded instanced draws; no per-cast GPU allocation. */
export class OfficialSkillEffectLayer implements WorldSkillEffectLayer {
  readonly sourceAssetId = SHIELD_WAVE_EFFECT_ID;
  readonly sourceAssetIds = [SHIELD_WAVE_EFFECT_ID, ENDURE_EFFECT_ID] as const;
  readonly object = new THREE.Group();
  readonly mesh: THREE.InstancedMesh;
  readonly material: THREE.ShaderMaterial;
  readonly endureMesh: THREE.InstancedMesh;
  readonly endureMaterial: THREE.ShaderMaterial;
  readonly presentation = new ShieldWavePresentation();
  readonly endurePresentation = new EndurePresentation();
  readonly #rotation: THREE.InstancedBufferAttribute;
  readonly #opacity: THREE.InstancedBufferAttribute;
  readonly #texture: THREE.Texture;
  readonly #endureOpacity: THREE.InstancedBufferAttribute;
  readonly #endureTexture: THREE.Texture;
  readonly #matrix = new THREE.Matrix4();
  #disposed = false;

  constructor(data: FormalSceneData, makeTexture: TextureFactory) {
    const shieldSource = requireTexture(data, SHIELD_WAVE_EFFECT_ID, { format: "bmp", bitsPerPixel: 24, alpha: "ro-color-key" });
    const endureSource = requireTexture(data, ENDURE_EFFECT_ID, { format: "tga", bitsPerPixel: 32, alpha: "source-alpha" });
    const shield = createEffectGpu(shieldSource.meta, shieldSource.image, SHIELD_WAVE_CAPACITY, makeTexture, SHIELD_WAVE_EFFECT_ID);
    let endure: EffectGpu;
    try {
      endure = createEffectGpu(endureSource.meta, endureSource.image, ENDURE_CAPACITY, makeTexture, ENDURE_EFFECT_ID);
    } catch (err) {
      shield.mesh.geometry.dispose();
      shield.material.dispose();
      shield.texture.dispose();
      throw err;
    }
    this.mesh = shield.mesh;
    this.material = shield.material;
    this.#rotation = shield.rotation;
    this.#opacity = shield.opacity;
    this.#texture = shield.texture;
    this.endureMesh = endure.mesh;
    this.endureMaterial = endure.material;
    this.#endureOpacity = endure.opacity;
    this.#endureTexture = endure.texture;
    this.object.add(this.mesh, this.endureMesh);
  }

  get activeCount(): number {
    return this.mesh.count + this.endureMesh.count;
  }

  get shieldWaveActiveCount(): number {
    return this.mesh.count;
  }

  get endureActiveCount(): number {
    return this.endureMesh.count;
  }

  ingest(events: readonly RunEvent[], nowMs: number): void {
    if (this.#disposed) return;
    this.presentation.ingest(events, nowMs);
    this.endurePresentation.ingest(events, nowMs);
  }

  update(nowMs: number, playerXmm: number, playerYmm: number, heightAt: (xm: number, ym: number) => number, right: THREE.Vector3, up: THREE.Vector3, effectOpacity: number): void {
    if (this.#disposed) return;
    this.presentation.prune(nowMs);
    this.endurePresentation.prune(nowMs);
    const boundedOpacity = Math.max(0.2, Math.min(1, effectOpacity));
    let count = 0;
    for (const cue of this.presentation.cues) {
      if (count >= SHIELD_WAVE_CAPACITY) break;
      const sample = sampleShieldWaveCue(cue, nowMs);
      if (!sample.visible) continue;
      const xm = sample.xMm / 1000;
      const ym = sample.yMm / 1000;
      this.#matrix.makeTranslation(xm, heightAt(xm, ym) + 0.9 + sample.arcM, -ym);
      this.mesh.setMatrixAt(count, this.#matrix);
      this.#rotation.setX(count, sample.rotation);
      this.#opacity.setX(count, sample.opacity * boundedOpacity);
      count += 1;
    }
    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.#rotation.needsUpdate = true;
    this.#opacity.needsUpdate = true;
    (this.material.uniforms.uRight as { value: THREE.Vector3 }).value.copy(right);
    (this.material.uniforms.uUp as { value: THREE.Vector3 }).value.copy(up);

    const endureCue = this.endurePresentation.cue;
    const endureSample = endureCue ? sampleEndureCue(endureCue, nowMs) : null;
    if (endureSample?.visible) {
      const xm = playerXmm / 1000;
      const ym = playerYmm / 1000;
      this.#matrix.makeTranslation(xm, heightAt(xm, ym) + 0.9, -ym);
      this.endureMesh.setMatrixAt(0, this.#matrix);
      this.#endureOpacity.setX(0, endureSample.opacity * boundedOpacity);
      (this.endureMaterial.uniforms.uSize as { value: THREE.Vector2 }).value.setScalar(64 * 0.025 * endureSample.scale);
      this.endureMesh.count = 1;
    } else this.endureMesh.count = 0;
    this.endureMesh.instanceMatrix.needsUpdate = true;
    this.#endureOpacity.needsUpdate = true;
    (this.endureMaterial.uniforms.uRight as { value: THREE.Vector3 }).value.copy(right);
    (this.endureMaterial.uniforms.uUp as { value: THREE.Vector3 }).value.copy(up);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.presentation.clear();
    this.endurePresentation.clear();
    this.mesh.count = 0;
    this.endureMesh.count = 0;
    this.object.remove(this.mesh, this.endureMesh);
    this.mesh.geometry.dispose();
    this.endureMesh.geometry.dispose();
    this.material.dispose();
    this.endureMaterial.dispose();
    for (const texture of new Set([this.#texture, this.#endureTexture])) texture.dispose();
  }
}
