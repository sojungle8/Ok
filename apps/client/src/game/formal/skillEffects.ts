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
export const BASH_EFFECT_IDS = [
  "effect.skill.sw.bash.alpha_down",
  "effect.skill.sw.bash.alpha_center",
  "effect.skill.sw.bash.lens1",
  "effect.skill.sw.bash.lens2",
] as const;
export type BashEffectId = (typeof BASH_EFFECT_IDS)[number];
/** Bounded impact queue: 16 impact cues x 4 verified original-RO planes = at most 64 planes. */
export const BASH_CAPACITY = 16;
/** Presentation-only upper bound per cast; above every authoritative Bash hitLimit (rank 3 = 2). */
export const BASH_MAX_PER_CAST = 4;
export const BASH_IMPACT_DURATION_MS = 360;
/** Bounded replay-protection memory of already presented geomId + target pairs. */
export const BASH_SEEN_CAPACITY = 256;
/** Exact verified source contract of each Bash plane (canonical-v5 whitelist rows). */
export const BASH_EFFECT_CONTRACT: Readonly<Record<BashEffectId, { canonicalPath: string; bytes: number; width: number; height: number }>> = {
  "effect.skill.sw.bash.alpha_down": { canonicalPath: "data\\texture\\effect\\alpha_down.tga", bytes: 16428, width: 64, height: 64 },
  "effect.skill.sw.bash.alpha_center": { canonicalPath: "data\\texture\\effect\\alpha_center.tga", bytes: 4140, width: 32, height: 32 },
  "effect.skill.sw.bash.lens1": { canonicalPath: "data\\texture\\effect\\lens1.tga", bytes: 16428, width: 32, height: 128 },
  "effect.skill.sw.bash.lens2": { canonicalPath: "data\\texture\\effect\\lens2.tga", bytes: 16428, width: 32, height: 128 },
};
export const MAGNUM_BREAK_EFFECT_IDS = ["effect.skill.sw.magnum_break.ring_yellow", "effect.skill.sw.magnum_break.explosion"] as const;
export type MagnumBreakEffectId = (typeof MAGNUM_BREAK_EFFECT_IDS)[number];
/** At most 4 concurrent Magnum Break bursts (one ring + one explosion plane each). */
export const MAGNUM_BREAK_CAPACITY = 4;
export const MAGNUM_BREAK_DURATION_MS = 520;
export const MAGNUM_BREAK_EFFECT_CONTRACT: Readonly<Record<MagnumBreakEffectId, { canonicalPath: string; bytes: number; width: number; height: number }>> = {
  "effect.skill.sw.magnum_break.ring_yellow": { canonicalPath: "data\\texture\\effect\\ring_yellow.tga", bytes: 16428, width: 64, height: 64 },
  "effect.skill.sw.magnum_break.explosion": { canonicalPath: "data\\texture\\effect\\대폭발.tga", bytes: 65580, width: 128, height: 128 },
};
const MAGNUM_BREAK_SOURCE = "skill.sw.magnum_break";
/** Provoke bitmap sources; the original `provoke.str` stays source-only (unparsed) and is not drawn. */
export const PROVOKE_EFFECT_IDS = ["effect.skill.sw.provoke.explosive_1_128", "effect.skill.sw.provoke.piero", "effect.skill.sw.provoke.pika01"] as const;
export type ProvokeEffectId = (typeof PROVOKE_EFFECT_IDS)[number];
export const PROVOKE_CAPACITY = 2;
export const PROVOKE_SPARKS_PER_CAST = 6;
export const PROVOKE_DURATION_MS = 640;
export const PROVOKE_EFFECT_CONTRACT: Readonly<Record<ProvokeEffectId, { canonicalPath: string; bytes: number; width: number; height: number; bitsPerPixel: 8 | 24 }>> = {
  "effect.skill.sw.provoke.explosive_1_128": { canonicalPath: "data\\texture\\effect\\explosive_1_128.bmp", bytes: 17462, width: 128, height: 128, bitsPerPixel: 8 },
  "effect.skill.sw.provoke.piero": { canonicalPath: "data\\texture\\effect\\piero.bmp", bytes: 12344, width: 64, height: 64, bitsPerPixel: 24 },
  "effect.skill.sw.provoke.pika01": { canonicalPath: "data\\texture\\effect\\pika01.bmp", bytes: 1336, width: 16, height: 16, bitsPerPixel: 8 },
};
const PROVOKE_SOURCE = "skill.sw.provoke";
const BASH_SOURCE = "skill.sw.bash";
const BASH_FALLBACK_MAX_MM = 3000;
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

export interface BashImpactCue {
  id: number;
  geomId: string;
  targetId: number | null;
  xMm: number;
  yMm: number;
  startMs: number;
  endMs: number;
  phase: number;
}

export interface BashPlaneSample {
  opacity: number;
  scale: number;
  rotation: number;
  liftM: number;
}

export interface BashImpactSample {
  visible: boolean;
  /** One sample per verified source plane, in {@link BASH_EFFECT_IDS} order. */
  planes: readonly [BashPlaneSample, BashPlaneSample, BashPlaneSample, BashPlaneSample];
}

/** One cast-centred area cue; anchored at the public cast origin, never at live player state. */
export interface AreaCastCue {
  id: number;
  geomId: string;
  xMm: number;
  yMm: number;
  radiusMm: number;
  startMs: number;
  endMs: number;
  phase: number;
}

export interface ProvokeSample {
  visible: boolean;
  /** Flat ground shockwave; `scale` is relative to the authoritative circle diameter. */
  wave: BashPlaneSample;
  /** Camera-facing taunt mark over the cast origin. */
  mark: BashPlaneSample;
  /** Sparks travelling outward along the circle; `radiusFactor` is relative to the authoritative radius. */
  spark: BashPlaneSample & { radiusFactor: number };
}

export interface MagnumBreakSample {
  visible: boolean;
  /** Flat ground ring; `scale` is relative to the authoritative circle diameter. */
  ring: BashPlaneSample;
  /** Camera-facing explosion over the cast origin. */
  explosion: BashPlaneSample;
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

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/**
 * Clean-room layered impact (project-written timing): a ground flash, a short center pop and two
 * crossed streaks. Pure presentation; damage, stun and hit resolution stay in the simulation.
 */
export function sampleBashImpact(cue: BashImpactCue, nowMs: number): BashImpactSample {
  const duration = Math.max(1, cue.endMs - cue.startMs);
  const p = clamp01((nowMs - cue.startMs) / duration);
  const flash = (startAt: number, peakAt: number, endAt: number): number => {
    if (p < startAt || p >= endAt) return 0;
    return p < peakAt ? clamp01((p - startAt) / Math.max(1e-6, peakAt - startAt)) : clamp01((endAt - p) / Math.max(1e-6, endAt - peakAt));
  };
  return {
    visible: nowMs >= cue.startMs && nowMs < cue.endMs,
    planes: [
      { opacity: clamp01(1 - p), scale: 0.6 + 0.8 * p, rotation: cue.phase, liftM: 0.35 },
      { opacity: flash(0, 0.12, 0.6), scale: 0.8 + 0.8 * clamp01(p / 0.6), rotation: 0, liftM: 0.9 },
      { opacity: flash(0, 0.08, 0.5), scale: 0.9 + 0.3 * p, rotation: cue.phase + Math.PI / 4, liftM: 0.9 },
      { opacity: flash(0.1, 0.2, 0.65), scale: 0.9 + 0.3 * p, rotation: cue.phase - Math.PI / 4, liftM: 0.9 },
    ],
  };
}

/** Clean-room Magnum Break burst: a ground ring expanding to the authoritative radius plus a flash. */
export function sampleMagnumBreak(cue: AreaCastCue, nowMs: number): MagnumBreakSample {
  const duration = Math.max(1, cue.endMs - cue.startMs);
  const p = clamp01((nowMs - cue.startMs) / duration);
  const easeOut = 1 - (1 - p) * (1 - p);
  const ringFade = p < 0.55 ? 1 : clamp01((1 - p) / 0.45);
  const flashIn = clamp01(p / 0.1);
  const flashOut = clamp01((0.7 - p) / 0.45);
  return {
    visible: nowMs >= cue.startMs && nowMs < cue.endMs,
    ring: { opacity: ringFade, scale: 0.25 + 0.75 * easeOut, rotation: cue.phase + p * Math.PI / 3, liftM: 0.06 },
    explosion: { opacity: Math.min(flashIn, flashOut), scale: 0.7 + 0.6 * easeOut, rotation: cue.phase, liftM: 1 },
  };
}

/** Clean-room Provoke cue: an outward ground shockwave, a short mark pop and outward sparks. */
export function sampleProvoke(cue: AreaCastCue, nowMs: number): ProvokeSample {
  const duration = Math.max(1, cue.endMs - cue.startMs);
  const p = clamp01((nowMs - cue.startMs) / duration);
  const easeOut = 1 - (1 - p) * (1 - p);
  const markIn = clamp01(p / 0.12);
  const markOut = clamp01((0.75 - p) / 0.35);
  return {
    visible: nowMs >= cue.startMs && nowMs < cue.endMs,
    wave: { opacity: clamp01((1 - p) / 0.6), scale: 0.15 + 0.85 * easeOut, rotation: cue.phase, liftM: 0.05 },
    mark: { opacity: Math.min(markIn, markOut), scale: 0.8 + 0.3 * Math.sin(Math.min(1, p / 0.4) * Math.PI), rotation: 0, liftM: 2.1 },
    spark: { opacity: p < 0.15 ? clamp01(p / 0.15) : clamp01((1 - p) / 0.85), scale: 1, rotation: p * Math.PI * 2, liftM: 0.5, radiusFactor: 0.1 + 0.9 * easeOut },
  };
}

/**
 * Bounded cast-centred cue queue for circle skills. One cue per authoritative cast geomId (never
 * replayed); radius comes from the public circle geometry.
 */
export class AreaCastPresentation {
  readonly cues: AreaCastCue[] = [];
  readonly #seen = new Set<string>();
  readonly #source: string;
  readonly #durationMs: number;
  readonly #capacity: number;
  #lastEvents: readonly RunEvent[] | null = null;
  #nextId = 1;

  constructor(source: string, durationMs: number, capacity: number) {
    this.#source = source;
    this.#durationMs = durationMs;
    this.#capacity = capacity;
  }

  ingest(events: readonly RunEvent[], nowMs: number): void {
    if (events === this.#lastEvents) {
      this.prune(nowMs);
      return;
    }
    this.#lastEvents = events;
    const maxTick = events.reduce((max, event) => Math.max(max, event.tick), 0);
    for (const cast of events) {
      if (cast.type !== "skill" || cast.source !== this.#source || this.#seen.has(cast.geomId)) continue;
      this.#seen.add(cast.geomId);
      if (this.#seen.size > BASH_SEEN_CAPACITY) {
        const oldest = this.#seen.values().next().value;
        if (oldest !== undefined) this.#seen.delete(oldest);
      }
      const startMs = nowMs - Math.max(0, maxTick - cast.tick) * TICK_MS;
      const radiusMm = cast.geometry?.shape === "circle" ? Math.max(0, cast.geometry.radiusMm) : 0;
      const id = this.#nextId++;
      this.cues.push({ id, geomId: cast.geomId, xMm: cast.origin.xMm, yMm: cast.origin.yMm, radiusMm, startMs, endMs: startMs + this.#durationMs, phase: (id % 6) * Math.PI / 3 });
    }
    if (this.cues.length > this.#capacity) this.cues.splice(0, this.cues.length - this.#capacity);
    this.prune(nowMs);
  }

  prune(nowMs: number): void {
    for (let i = this.cues.length - 1; i >= 0; i -= 1) if (nowMs >= (this.cues[i]?.endMs ?? 0)) this.cues.splice(i, 1);
  }

  clear(): void {
    this.cues.splice(0);
    this.#seen.clear();
    this.#lastEvents = null;
  }
}

/**
 * Bounded Bash impact queue. Every positioned authoritative hit sharing the cast geomId becomes an
 * impact anchor (rank 3 may hit two targets). Only a cast with no positioned hit gets one fallback
 * anchor along its public direction/geometry. A geomId + target pair is never presented twice.
 */
export class BashPresentation {
  readonly cues: BashImpactCue[] = [];
  readonly #seen = new Set<string>();
  #lastEvents: readonly RunEvent[] | null = null;
  #nextId = 1;

  ingest(events: readonly RunEvent[], nowMs: number): void {
    if (events === this.#lastEvents) {
      this.prune(nowMs);
      return;
    }
    this.#lastEvents = events;
    const maxTick = events.reduce((max, event) => Math.max(max, event.tick), 0);
    for (const cast of events) {
      if (cast.type !== "skill" || cast.source !== BASH_SOURCE) continue;
      const castMs = nowMs - Math.max(0, maxTick - cast.tick) * TICK_MS;
      let anchored = 0;
      const targets = new Set<number>();
      for (const hit of events) {
        if (anchored >= BASH_MAX_PER_CAST) break;
        if (hit.type !== "hit" || hit.source !== BASH_SOURCE || hit.geomId !== cast.geomId) continue;
        if (!Number.isFinite(hit.xMm) || !Number.isFinite(hit.yMm)) continue;
        const targetId = hit.targetId ?? null;
        if (targetId !== null) {
          if (targets.has(targetId)) continue;
          targets.add(targetId);
        }
        anchored += 1;
        this.add(cast.geomId, targetId, hit.xMm as number, hit.yMm as number, castMs);
      }
      if (anchored === 0) {
        const range = !cast.geometry ? 0 : cast.geometry.shape === "circle" ? 0 : Math.min(BASH_FALLBACK_MAX_MM, Math.max(0, cast.geometry.rangeMm));
        const [dx, dy] = normalizedDirection(cast.direction.x, cast.direction.y);
        this.add(cast.geomId, null, cast.origin.xMm + dx * range, cast.origin.yMm + dy * range, castMs);
      }
    }
    if (this.cues.length > BASH_CAPACITY) this.cues.splice(0, this.cues.length - BASH_CAPACITY);
    this.prune(nowMs);
  }

  prune(nowMs: number): void {
    for (let i = this.cues.length - 1; i >= 0; i -= 1) if (nowMs >= (this.cues[i]?.endMs ?? 0)) this.cues.splice(i, 1);
  }

  clear(): void {
    this.cues.splice(0);
    this.#seen.clear();
    this.#lastEvents = null;
  }

  private add(geomId: string, targetId: number | null, xMm: number, yMm: number, startMs: number): void {
    const key = `${geomId}#${targetId ?? "fallback"}`;
    if (this.#seen.has(key)) return;
    this.#seen.add(key);
    if (this.#seen.size > BASH_SEEN_CAPACITY) {
      const oldest = this.#seen.values().next().value;
      if (oldest !== undefined) this.#seen.delete(oldest);
    }
    const id = this.#nextId++;
    this.cues.push({ id, geomId, targetId, xMm, yMm, startMs, endMs: startMs + BASH_IMPACT_DURATION_MS, phase: (id % 4) * Math.PI / 8 });
  }
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
attribute float aScale;
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec2 uSize;
varying vec2 vUv;
varying float vOpacity;
void main() {
  vec3 center = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float c = cos(aRotation);
  float s = sin(aRotation);
  vec2 p = vec2(position.x * uSize.x, position.y * uSize.y) * aScale;
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
  scale: THREE.InstancedBufferAttribute;
  texture: THREE.Texture;
}

function requireTexture(
  data: FormalSceneData,
  assetId: string,
  expected: { format: "bmp" | "tga"; bitsPerPixel: 8 | 24 | 32; alpha: "ro-color-key" | "source-alpha"; width?: number; height?: number; canonicalPath?: string; bytes?: number },
): { meta: DerivedSkillEffectTexture; image: ImageLike } {
  const w = expected.width ?? 64;
  const h = expected.height ?? 64;
  const meta = data.effects.get(assetId);
  const image = data.effectImages.get(assetId);
  if (!meta || meta.kind !== "texture" || meta.format !== expected.format) {
    throw new Error(`${assetId}: verified ${expected.format.toUpperCase()} metadata not loaded`);
  }
  if (meta.bitsPerPixel !== expected.bitsPerPixel || meta.alpha.mode !== expected.alpha) {
    throw new Error(`${assetId}: verified ${expected.bitsPerPixel}-bit ${expected.alpha} metadata required`);
  }
  if (meta.width !== w || meta.height !== h || image?.width !== w || image.height !== h) {
    throw new Error(`${assetId}: expected verified ${w}x${h} image`);
  }
  if (expected.canonicalPath !== undefined || expected.bytes !== undefined) {
    if (meta.derived.width !== w || meta.derived.height !== h) throw new Error(`${assetId}: derived ${meta.derived.width}x${meta.derived.height} != verified ${w}x${h}`);
    if (!/^[0-9a-f]{64}$/iu.test(meta.derived.sha256) || !/^[0-9a-f]{64}$/iu.test(meta.source.sha256)) throw new Error(`${assetId}: verified SHA-256 contract missing`);
    if (expected.canonicalPath !== undefined && meta.source.canonicalPath !== expected.canonicalPath) throw new Error(`${assetId}: source ${meta.source.canonicalPath} != ${expected.canonicalPath}`);
    if (expected.bytes !== undefined && meta.source.bytes !== expected.bytes) throw new Error(`${assetId}: source ${meta.source.bytes} bytes != ${expected.bytes}`);
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
    const scale = new THREE.InstancedBufferAttribute(new Float32Array(capacity).fill(1), 1);
    for (const attribute of [rotation, opacity, scale]) attribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("aRotation", rotation);
    geometry.setAttribute("aOpacity", opacity);
    geometry.setAttribute("aScale", scale);
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
    return { mesh, material, rotation, opacity, scale, texture };
  } catch (err) {
    geometry?.dispose();
    material?.dispose();
    texture.dispose();
    throw err;
  }
}

function disposeGpu(gpu: EffectGpu): void {
  gpu.mesh.geometry.dispose();
  gpu.material.dispose();
  gpu.texture.dispose();
}

/**
 * Verified original-RO skill textures in bounded instanced draws: Shield Wave (32), Endure (1),
 * four Bash lanes (16 each), two Magnum Break lanes (4 each: ground ring, explosion) and three
 * Provoke lanes (2 wave, 2 mark, 12 sparks). No per-cast texture/material/geometry allocation.
 */
export class OfficialSkillEffectLayer implements WorldSkillEffectLayer {
  readonly sourceAssetId = SHIELD_WAVE_EFFECT_ID;
  readonly sourceAssetIds = [SHIELD_WAVE_EFFECT_ID, ENDURE_EFFECT_ID, ...BASH_EFFECT_IDS, ...MAGNUM_BREAK_EFFECT_IDS, ...PROVOKE_EFFECT_IDS] as const;
  readonly object = new THREE.Group();
  readonly mesh: THREE.InstancedMesh;
  readonly material: THREE.ShaderMaterial;
  readonly endureMesh: THREE.InstancedMesh;
  readonly endureMaterial: THREE.ShaderMaterial;
  /** Bash lanes in {@link BASH_EFFECT_IDS} order. */
  readonly bashMeshes: readonly THREE.InstancedMesh[];
  readonly bashMaterials: readonly THREE.ShaderMaterial[];
  /** Magnum Break lanes in {@link MAGNUM_BREAK_EFFECT_IDS} order (ground ring, explosion). */
  readonly magnumMeshes: readonly THREE.InstancedMesh[];
  /** Provoke lanes in {@link PROVOKE_EFFECT_IDS} order (ground wave, mark, sparks). */
  readonly provokeMeshes: readonly THREE.InstancedMesh[];
  readonly presentation = new ShieldWavePresentation();
  readonly endurePresentation = new EndurePresentation();
  readonly bashPresentation = new BashPresentation();
  readonly magnumPresentation = new AreaCastPresentation(MAGNUM_BREAK_SOURCE, MAGNUM_BREAK_DURATION_MS, MAGNUM_BREAK_CAPACITY);
  readonly provokePresentation = new AreaCastPresentation(PROVOKE_SOURCE, PROVOKE_DURATION_MS, PROVOKE_CAPACITY);
  readonly #shield: EffectGpu;
  readonly #endure: EffectGpu;
  readonly #bash: readonly EffectGpu[];
  readonly #magnum: readonly EffectGpu[];
  readonly #provoke: readonly EffectGpu[];
  readonly #groundRight = new THREE.Vector3(1, 0, 0);
  readonly #groundUp = new THREE.Vector3(0, 0, -1);
  readonly #matrix = new THREE.Matrix4();
  #bashImpacts = 0;
  #magnumBursts = 0;
  #provokeCues = 0;
  #disposed = false;

  constructor(data: FormalSceneData, makeTexture: TextureFactory) {
    const shieldSource = requireTexture(data, SHIELD_WAVE_EFFECT_ID, { format: "bmp", bitsPerPixel: 24, alpha: "ro-color-key" });
    const endureSource = requireTexture(data, ENDURE_EFFECT_ID, { format: "tga", bitsPerPixel: 32, alpha: "source-alpha" });
    const bashSources = BASH_EFFECT_IDS.map((id) => requireTexture(data, id, { format: "tga", bitsPerPixel: 32, alpha: "source-alpha", ...BASH_EFFECT_CONTRACT[id] }));
    const provokeSources = PROVOKE_EFFECT_IDS.map((id) => requireTexture(data, id, { format: "bmp", alpha: "ro-color-key", ...PROVOKE_EFFECT_CONTRACT[id] }));
    const magnumSources = MAGNUM_BREAK_EFFECT_IDS.map((id) => requireTexture(data, id, { format: "tga", bitsPerPixel: 32, alpha: "source-alpha", ...MAGNUM_BREAK_EFFECT_CONTRACT[id] }));
    const built: EffectGpu[] = [];
    try {
      built.push(createEffectGpu(shieldSource.meta, shieldSource.image, SHIELD_WAVE_CAPACITY, makeTexture, SHIELD_WAVE_EFFECT_ID));
      built.push(createEffectGpu(endureSource.meta, endureSource.image, ENDURE_CAPACITY, makeTexture, ENDURE_EFFECT_ID));
      BASH_EFFECT_IDS.forEach((id, index) => {
        const source = bashSources[index] as (typeof bashSources)[number];
        built.push(createEffectGpu(source.meta, source.image, BASH_CAPACITY, makeTexture, id));
      });
      MAGNUM_BREAK_EFFECT_IDS.forEach((id, index) => {
        const source = magnumSources[index] as (typeof magnumSources)[number];
        built.push(createEffectGpu(source.meta, source.image, MAGNUM_BREAK_CAPACITY, makeTexture, id));
      });
      PROVOKE_EFFECT_IDS.forEach((id, index) => {
        const source = provokeSources[index] as (typeof provokeSources)[number];
        const capacity = id === "effect.skill.sw.provoke.pika01" ? PROVOKE_CAPACITY * PROVOKE_SPARKS_PER_CAST : PROVOKE_CAPACITY;
        built.push(createEffectGpu(source.meta, source.image, capacity, makeTexture, id));
      });
    } catch (err) {
      for (const gpu of built) disposeGpu(gpu);
      throw err;
    }
    const [shield, endure, ...rest] = built as [EffectGpu, EffectGpu, ...EffectGpu[]];
    const bash = rest.slice(0, BASH_EFFECT_IDS.length);
    const magnum = rest.slice(BASH_EFFECT_IDS.length, BASH_EFFECT_IDS.length + MAGNUM_BREAK_EFFECT_IDS.length);
    const provoke = rest.slice(BASH_EFFECT_IDS.length + MAGNUM_BREAK_EFFECT_IDS.length);
    this.#shield = shield;
    this.#endure = endure;
    this.#bash = bash;
    this.#magnum = magnum;
    this.magnumMeshes = magnum.map((gpu) => gpu.mesh);
    this.#provoke = provoke;
    this.provokeMeshes = provoke.map((gpu) => gpu.mesh);
    this.mesh = shield.mesh;
    this.material = shield.material;
    this.endureMesh = endure.mesh;
    this.endureMaterial = endure.material;
    this.bashMeshes = bash.map((gpu) => gpu.mesh);
    this.bashMaterials = bash.map((gpu) => gpu.material);
    this.object.add(this.mesh, this.endureMesh, ...this.bashMeshes, ...this.magnumMeshes, ...this.provokeMeshes);
  }

  get activeCount(): number {
    return this.mesh.count + this.endureMesh.count + this.#bashImpacts + this.#magnumBursts + this.#provokeCues;
  }

  get shieldWaveActiveCount(): number {
    return this.mesh.count;
  }

  get endureActiveCount(): number {
    return this.endureMesh.count;
  }

  /** Visible Bash impact cues (each drawn with up to four verified source planes). */
  get bashActiveCount(): number {
    return this.#bashImpacts;
  }

  /** Visible Magnum Break bursts (ground ring + explosion plane each). */
  get magnumBreakActiveCount(): number {
    return this.#magnumBursts;
  }

  /** Visible Provoke cues (ground wave + mark + six sparks each). */
  get provokeActiveCount(): number {
    return this.#provokeCues;
  }

  ingest(events: readonly RunEvent[], nowMs: number): void {
    if (this.#disposed) return;
    this.provokePresentation.ingest(events, nowMs);
    this.presentation.ingest(events, nowMs);
    this.endurePresentation.ingest(events, nowMs);
    this.bashPresentation.ingest(events, nowMs);
    this.magnumPresentation.ingest(events, nowMs);
  }

  update(nowMs: number, playerXmm: number, playerYmm: number, heightAt: (xm: number, ym: number) => number, right: THREE.Vector3, up: THREE.Vector3, effectOpacity: number): void {
    if (this.#disposed) return;
    this.presentation.prune(nowMs);
    this.endurePresentation.prune(nowMs);
    this.bashPresentation.prune(nowMs);
    this.magnumPresentation.prune(nowMs);
    this.provokePresentation.prune(nowMs);
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
      this.#shield.rotation.setX(count, sample.rotation);
      this.#shield.opacity.setX(count, sample.opacity * boundedOpacity);
      count += 1;
    }
    this.mesh.count = count;
    this.#flush(this.#shield, right, up);

    const endureCue = this.endurePresentation.cue;
    const endureSample = endureCue ? sampleEndureCue(endureCue, nowMs) : null;
    if (endureSample?.visible) {
      const xm = playerXmm / 1000;
      const ym = playerYmm / 1000;
      this.#matrix.makeTranslation(xm, heightAt(xm, ym) + 0.9, -ym);
      this.endureMesh.setMatrixAt(0, this.#matrix);
      this.#endure.opacity.setX(0, endureSample.opacity * boundedOpacity);
      (this.endureMaterial.uniforms.uSize as { value: THREE.Vector2 }).value.setScalar(64 * 0.025 * endureSample.scale);
      this.endureMesh.count = 1;
    } else this.endureMesh.count = 0;
    this.#flush(this.#endure, right, up);

    let impacts = 0;
    for (const cue of this.bashPresentation.cues) {
      if (impacts >= BASH_CAPACITY) break;
      const sample = sampleBashImpact(cue, nowMs);
      if (!sample.visible) continue;
      const xm = cue.xMm / 1000;
      const ym = cue.yMm / 1000;
      const ground = heightAt(xm, ym);
      this.#bash.forEach((gpu, lane) => {
        const plane = sample.planes[lane] as BashPlaneSample;
        this.#matrix.makeTranslation(xm, ground + plane.liftM, -ym);
        gpu.mesh.setMatrixAt(impacts, this.#matrix);
        gpu.rotation.setX(impacts, plane.rotation);
        gpu.opacity.setX(impacts, plane.opacity * boundedOpacity);
        gpu.scale.setX(impacts, plane.scale);
      });
      impacts += 1;
    }
    this.#bashImpacts = impacts;
    for (const gpu of this.#bash) {
      gpu.mesh.count = impacts;
      this.#flush(gpu, right, up);
    }

    const [ring, explosion] = this.#magnum as [EffectGpu, EffectGpu];
    const ringBaseM = MAGNUM_BREAK_EFFECT_CONTRACT["effect.skill.sw.magnum_break.ring_yellow"].width * 0.025;
    let bursts = 0;
    for (const cue of this.magnumPresentation.cues) {
      if (bursts >= MAGNUM_BREAK_CAPACITY) break;
      const sample = sampleMagnumBreak(cue, nowMs);
      if (!sample.visible) continue;
      const xm = cue.xMm / 1000;
      const ym = cue.yMm / 1000;
      const ground = heightAt(xm, ym);
      const diameterM = Math.max(0.5, (2 * cue.radiusMm) / 1000);
      this.#matrix.makeTranslation(xm, ground + sample.ring.liftM, -ym);
      ring.mesh.setMatrixAt(bursts, this.#matrix);
      ring.rotation.setX(bursts, sample.ring.rotation);
      ring.opacity.setX(bursts, sample.ring.opacity * boundedOpacity);
      ring.scale.setX(bursts, (diameterM / ringBaseM) * sample.ring.scale);
      this.#matrix.makeTranslation(xm, ground + sample.explosion.liftM, -ym);
      explosion.mesh.setMatrixAt(bursts, this.#matrix);
      explosion.rotation.setX(bursts, sample.explosion.rotation);
      explosion.opacity.setX(bursts, sample.explosion.opacity * boundedOpacity);
      explosion.scale.setX(bursts, sample.explosion.scale);
      bursts += 1;
    }
    this.#magnumBursts = bursts;
    ring.mesh.count = bursts;
    explosion.mesh.count = bursts;
    this.#flush(ring, this.#groundRight, this.#groundUp);
    this.#flush(explosion, right, up);

    const [wave, mark, spark] = this.#provoke as [EffectGpu, EffectGpu, EffectGpu];
    const waveBaseM = PROVOKE_EFFECT_CONTRACT["effect.skill.sw.provoke.explosive_1_128"].width * 0.025;
    let cues = 0;
    let sparks = 0;
    for (const cue of this.provokePresentation.cues) {
      if (cues >= PROVOKE_CAPACITY) break;
      const sample = sampleProvoke(cue, nowMs);
      if (!sample.visible) continue;
      const xm = cue.xMm / 1000;
      const ym = cue.yMm / 1000;
      const ground = heightAt(xm, ym);
      const radiusM = Math.max(0.25, cue.radiusMm / 1000);
      this.#matrix.makeTranslation(xm, ground + sample.wave.liftM, -ym);
      wave.mesh.setMatrixAt(cues, this.#matrix);
      wave.rotation.setX(cues, sample.wave.rotation);
      wave.opacity.setX(cues, sample.wave.opacity * boundedOpacity);
      wave.scale.setX(cues, ((2 * radiusM) / waveBaseM) * sample.wave.scale);
      this.#matrix.makeTranslation(xm, ground + sample.mark.liftM, -ym);
      mark.mesh.setMatrixAt(cues, this.#matrix);
      mark.rotation.setX(cues, sample.mark.rotation);
      mark.opacity.setX(cues, sample.mark.opacity * boundedOpacity);
      mark.scale.setX(cues, sample.mark.scale);
      for (let k = 0; k < PROVOKE_SPARKS_PER_CAST; k += 1) {
        const angle = cue.phase + (k / PROVOKE_SPARKS_PER_CAST) * Math.PI * 2;
        const sx = xm + Math.cos(angle) * radiusM * sample.spark.radiusFactor;
        const sy = ym + Math.sin(angle) * radiusM * sample.spark.radiusFactor;
        this.#matrix.makeTranslation(sx, heightAt(sx, sy) + sample.spark.liftM, -sy);
        spark.mesh.setMatrixAt(sparks, this.#matrix);
        spark.rotation.setX(sparks, sample.spark.rotation);
        spark.opacity.setX(sparks, sample.spark.opacity * boundedOpacity);
        spark.scale.setX(sparks, sample.spark.scale);
        sparks += 1;
      }
      cues += 1;
    }
    this.#provokeCues = cues;
    wave.mesh.count = cues;
    mark.mesh.count = cues;
    spark.mesh.count = sparks;
    this.#flush(wave, this.#groundRight, this.#groundUp);
    this.#flush(mark, right, up);
    this.#flush(spark, right, up);
  }

  #flush(gpu: EffectGpu, right: THREE.Vector3, up: THREE.Vector3): void {
    gpu.mesh.instanceMatrix.needsUpdate = true;
    gpu.rotation.needsUpdate = true;
    gpu.opacity.needsUpdate = true;
    gpu.scale.needsUpdate = true;
    (gpu.material.uniforms.uRight as { value: THREE.Vector3 }).value.copy(right);
    (gpu.material.uniforms.uUp as { value: THREE.Vector3 }).value.copy(up);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.presentation.clear();
    this.endurePresentation.clear();
    this.bashPresentation.clear();
    this.magnumPresentation.clear();
    this.provokePresentation.clear();
    this.#bashImpacts = 0;
    this.#magnumBursts = 0;
    this.#provokeCues = 0;
    const lanes = [this.#shield, this.#endure, ...this.#bash, ...this.#magnum, ...this.#provoke];
    for (const gpu of lanes) {
      gpu.mesh.count = 0;
      this.object.remove(gpu.mesh);
    }
    for (const gpu of lanes) {
      gpu.mesh.geometry.dispose();
      gpu.material.dispose();
    }
    for (const texture of new Set(lanes.map((gpu) => gpu.texture))) texture.dispose();
  }
}
