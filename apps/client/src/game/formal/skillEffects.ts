import * as THREE from "three";
import type { RunEvent } from "@ro-survivor/core-sim";
import type { WorldSkillEffectLayer } from "../terrain.ts";
import type { FormalSceneData } from "./load.ts";
import type { TextureFactory } from "./world.ts";

export const SHIELD_WAVE_EFFECT_ID = "effect.skill.sw.shield_wave.projectile";
export const SHIELD_WAVE_CAPACITY = 32;
export const SHIELD_WAVE_MAX_PER_CAST = 10;
const SHIELD_WAVE_SOURCE = "skill.sw.shield_wave";
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

/** One original-RO texture, one instanced draw, no per-cast GPU resource creation. */
export class OfficialSkillEffectLayer implements WorldSkillEffectLayer {
  readonly sourceAssetId = SHIELD_WAVE_EFFECT_ID;
  readonly mesh: THREE.InstancedMesh;
  readonly material: THREE.ShaderMaterial;
  readonly presentation = new ShieldWavePresentation();
  readonly #rotation: THREE.InstancedBufferAttribute;
  readonly #opacity: THREE.InstancedBufferAttribute;
  readonly #texture: THREE.Texture;
  readonly #matrix = new THREE.Matrix4();
  #disposed = false;

  constructor(data: FormalSceneData, makeTexture: TextureFactory) {
    const meta = data.effects.get(SHIELD_WAVE_EFFECT_ID);
    const image = data.effectImages.get(SHIELD_WAVE_EFFECT_ID);
    if (!meta || meta.kind !== "texture" || meta.format !== "bmp") throw new Error(`${SHIELD_WAVE_EFFECT_ID}: verified BMP metadata not loaded`);
    const textureMeta = meta;
    if (textureMeta.width !== 64 || textureMeta.height !== 64 || image?.width !== 64 || image.height !== 64) {
      throw new Error(`${SHIELD_WAVE_EFFECT_ID}: expected verified 64x64 image`);
    }
    this.#texture = makeTexture(image, {});
    const geometry = new THREE.PlaneGeometry(1, 1);
    this.#rotation = new THREE.InstancedBufferAttribute(new Float32Array(SHIELD_WAVE_CAPACITY), 1);
    this.#opacity = new THREE.InstancedBufferAttribute(new Float32Array(SHIELD_WAVE_CAPACITY), 1);
    for (const attribute of [this.#rotation, this.#opacity]) attribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("aRotation", this.#rotation);
    geometry.setAttribute("aOpacity", this.#opacity);
    this.material = new THREE.ShaderMaterial({
      vertexShader: EFFECT_VERT,
      fragmentShader: EFFECT_FRAG,
      uniforms: {
        uMap: { value: this.#texture },
        uRight: { value: new THREE.Vector3(1, 0, 0) },
        uUp: { value: new THREE.Vector3(0, 1, 0) },
        uSize: { value: new THREE.Vector2(textureMeta.width * 0.025, textureMeta.height * 0.025) },
      },
      transparent: true,
      depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(geometry, this.material, SHIELD_WAVE_CAPACITY);
    this.mesh.count = 0;
    this.mesh.renderOrder = 6;
    this.mesh.frustumCulled = false;
    this.mesh.userData = { formal: "skill-effect", sourceAssetId: SHIELD_WAVE_EFFECT_ID };
  }

  get activeCount(): number {
    return this.mesh.count;
  }

  ingest(events: readonly RunEvent[], nowMs: number): void {
    if (!this.#disposed) this.presentation.ingest(events, nowMs);
  }

  update(nowMs: number, heightAt: (xm: number, ym: number) => number, right: THREE.Vector3, up: THREE.Vector3, effectOpacity: number): void {
    if (this.#disposed) return;
    this.presentation.prune(nowMs);
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
      this.#opacity.setX(count, sample.opacity * Math.max(0.2, Math.min(1, effectOpacity)));
      count += 1;
    }
    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.#rotation.needsUpdate = true;
    this.#opacity.needsUpdate = true;
    (this.material.uniforms.uRight as { value: THREE.Vector3 }).value.copy(right);
    (this.material.uniforms.uUp as { value: THREE.Vector3 }).value.copy(up);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.presentation.clear();
    this.mesh.count = 0;
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.#texture.dispose();
  }
}
