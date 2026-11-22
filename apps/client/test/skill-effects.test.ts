import * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { DerivedSkillEffectTexture } from "@ro-survivor/asset-contracts";
import type { RunEvent } from "@ro-survivor/core-sim";
import {
  BASH_CAPACITY,
  BASH_EFFECT_CONTRACT,
  BASH_EFFECT_IDS,
  BASH_IMPACT_DURATION_MS,
  BASH_MAX_PER_CAST,
  BashPresentation,
  sampleBashImpact,
  ENDURE_CAPACITY,
  ENDURE_DURATION_MS,
  ENDURE_EFFECT_ID,
  EndurePresentation,
  OfficialSkillEffectLayer,
  sampleEndureCue,
  sampleShieldWaveCue,
  SHIELD_WAVE_CAPACITY,
  SHIELD_WAVE_EFFECT_ID,
  SHIELD_WAVE_MAX_PER_CAST,
  ShieldWavePresentation,
  type ShieldWaveCue,
} from "../src/game/formal/skillEffects.ts";
import type { FormalSceneData } from "../src/game/formal/load.ts";
import { bashEffectEntries, bashEffectMeta, bashImageEntries } from "./bash-effect-fixture.ts";

const cast = (geomId = "shield:1", tick = 10): Extract<RunEvent, { type: "skill" }> => ({
  type: "skill", tick, source: "skill.sw.shield_wave", geomId,
  origin: { xMm: 0, yMm: 0 }, direction: { x: 10_000, y: 0 },
  geometry: { shape: "sector", rangeMm: 4000, halfAngleDeg: 45 }, rank: 1,
  vfxCue: "skill.sw.shield_wave", designOrigin: "original-survivor-adaptation",
});

const hit = (geomId: string, targetId: number, xMm: number, yMm: number, tick = 10): Extract<RunEvent, { type: "hit" }> => ({
  type: "hit", tick, source: "skill.sw.shield_wave", geomId, targetId, xMm, yMm, amount: 3000,
});

const endureCast = (geomId = "endure:1", tick = 10): Extract<RunEvent, { type: "skill" }> => ({
  type: "skill", tick, source: "skill.sw.endure", geomId,
  origin: { xMm: 0, yMm: 0 }, direction: { x: 0, y: -10_000 }, geometry: null, rank: 1,
  vfxCue: "skill.sw.endure", designOrigin: "official-name-adapted",
});

const meta: DerivedSkillEffectTexture = {
  rights: "fan-local-derived", converterVersion: 3, assetId: SHIELD_WAVE_EFFECT_ID,
  source: { canonicalPath: "data\\texture\\effect\\shield_boomerang.bmp", bytes: 12344, sha256: "3".repeat(64) },
  kind: "texture", format: "bmp", width: 64, height: 64, bitsPerPixel: 24,
  alpha: { mode: "ro-color-key", keyedPixels: 1 },
  derived: { file: `${SHIELD_WAVE_EFFECT_ID}.png`, sha256: "4".repeat(64), width: 64, height: 64 }, filter: "nearest",
};

const endureMeta: DerivedSkillEffectTexture = {
  rights: "fan-local-derived", converterVersion: 3, assetId: ENDURE_EFFECT_ID,
  source: { canonicalPath: "data\\texture\\effect\\endure.tga", bytes: 16428, sha256: "5".repeat(64) },
  kind: "texture", format: "tga", width: 64, height: 64, bitsPerPixel: 32,
  alpha: { mode: "source-alpha" },
  derived: { file: `${ENDURE_EFFECT_ID}.png`, sha256: "6".repeat(64), width: 64, height: 64 }, filter: "nearest",
};

const data = (shieldWidth = 64, shieldHeight = 64, endureWidth = 64, endureHeight = 64): FormalSceneData => ({
  effects: new Map([[SHIELD_WAVE_EFFECT_ID, meta], [ENDURE_EFFECT_ID, endureMeta], ...bashEffectEntries()]),
  effectImages: new Map<string, { width: number; height: number }>([
    [SHIELD_WAVE_EFFECT_ID, { width: shieldWidth, height: shieldHeight }],
    [ENDURE_EFFECT_ID, { width: endureWidth, height: endureHeight }],
    ...bashImageEntries((width, height) => ({ width, height })),
  ]),
} as unknown as FormalSceneData);

describe("Shield Wave presentation cues", () => {
  it("pairs one original-RO projectile with every authoritative target and consumes an event array once", () => {
    const p = new ShieldWavePresentation();
    const events: RunEvent[] = [cast(), hit("shield:1", 1, 1000, 0), hit("shield:1", 2, 2000, 300), hit("shield:1", 3, 3000, -400)];
    p.ingest(events, 1000);
    expect(p.cues.map((cue) => [cue.targetId, cue.toXmm, cue.toYmm])).toEqual([[1, 1000, 0], [2, 2000, 300], [3, 3000, -400]]);
    p.ingest(events, 1010);
    expect(p.cues).toHaveLength(3);
  });

  it("caps each cast at ten and the global queue at 32, then prunes expired cues", () => {
    const p = new ShieldWavePresentation();
    const events: RunEvent[] = [];
    for (let c = 0; c < 4; c += 1) {
      const geomId = `shield:${c}`;
      events.push(cast(geomId, 10 + c));
      for (let i = 0; i < 15; i += 1) events.push(hit(geomId, c * 100 + i, 1000 + i * 10, c * 100, 10 + c));
    }
    p.ingest(events, 1000);
    expect(SHIELD_WAVE_MAX_PER_CAST).toBe(10);
    expect(p.cues).toHaveLength(SHIELD_WAVE_CAPACITY);
    expect(p.cues.filter((cue) => cue.geomId === "shield:0")).toHaveLength(2);
    p.prune(2000);
    expect(p.cues).toHaveLength(0);
  });

  it("uses exactly one authoritative direction/range fallback when no positioned hit exists", () => {
    const p = new ShieldWavePresentation();
    p.ingest([cast()], 0);
    expect(p.cues).toHaveLength(1);
    expect(p.cues[0]).toMatchObject({ targetId: null, fromXmm: 0, fromYmm: 0, toXmm: 4000, toYmm: 0 });
  });

  it("samples a bounded flight, arc, spin and fade without changing simulation state", () => {
    const cue: ShieldWaveCue = { id: 1, geomId: "g", targetId: 1, fromXmm: 0, fromYmm: 0, toXmm: 4000, toYmm: 2000, startMs: 100, endMs: 300, spinPhase: 0 };
    expect(sampleShieldWaveCue(cue, 100)).toMatchObject({ xMm: 0, yMm: 0, arcM: 0, opacity: 1, visible: true });
    expect(sampleShieldWaveCue(cue, 200)).toMatchObject({ xMm: 2000, yMm: 1000, arcM: 0.35, opacity: 1, visible: true });
    expect(sampleShieldWaveCue(cue, 300)).toMatchObject({ xMm: 4000, yMm: 2000, arcM: 0, opacity: 0, visible: false });
    expect(sampleShieldWaveCue(cue, 200).rotation).toBeCloseTo(Math.PI * 2);
  });
});

describe("Endure presentation cue", () => {
  it("keeps one bounded cue, consumes an event array once and preserves an empty frame", () => {
    const p = new EndurePresentation();
    const events: RunEvent[] = [endureCast("endure:1", 10), endureCast("endure:2", 12), endureCast("endure:3", 11)];
    p.ingest(events, 1000);
    expect(ENDURE_CAPACITY).toBe(1);
    expect(p.cue).toMatchObject({ geomId: "endure:2", startMs: 1000, endMs: 1000 + ENDURE_DURATION_MS });
    p.ingest(events, 1010);
    expect(p.cue?.startMs).toBe(1000);
    p.ingest([], 1020);
    expect(p.cue?.geomId).toBe("endure:2");
  });

  it("refreshes on a later cast and prunes exactly at the presentation deadline", () => {
    const p = new EndurePresentation();
    p.ingest([endureCast("endure:1")], 100);
    p.ingest([endureCast("endure:2")], 500);
    expect(p.cue).toMatchObject({ geomId: "endure:2", startMs: 500, endMs: 500 + ENDURE_DURATION_MS });
    p.prune(500 + ENDURE_DURATION_MS - 1);
    expect(p.cue).not.toBeNull();
    p.prune(500 + ENDURE_DURATION_MS);
    expect(p.cue).toBeNull();
  });

  it("samples a bounded pulse and fade independent from the gameplay buff duration", () => {
    const cue = { geomId: "endure:1", startMs: 100, endMs: 1000 };
    expect(sampleEndureCue(cue, 100)).toMatchObject({ opacity: 0, scale: 0.85, visible: true });
    expect(sampleEndureCue(cue, 550).visible).toBe(true);
    expect(sampleEndureCue(cue, 550).scale).toBeCloseTo(1.05);
    expect(sampleEndureCue(cue, 1000)).toMatchObject({ opacity: 0, scale: 0.85, visible: false });
  });
});

describe("official Shield Wave GPU layer", () => {
  it("uses one verified 64x64 original image and one bounded instanced draw", () => {
    const textures = Array.from({ length: 2 + BASH_EFFECT_IDS.length }, () => new THREE.Texture());
    const layer = new OfficialSkillEffectLayer(data(), () => textures.shift() as THREE.Texture);
    const events: RunEvent[] = [cast(), hit("shield:1", 7, 1000, 0)];
    layer.ingest(events, 0);
    layer.update(80, 0, 0, () => 0, new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), 0.5);
    expect(layer.sourceAssetId).toBe(SHIELD_WAVE_EFFECT_ID);
    expect(layer.sourceAssetIds).toEqual([SHIELD_WAVE_EFFECT_ID, ENDURE_EFFECT_ID, ...BASH_EFFECT_IDS]);
    expect(layer.mesh.count).toBe(1);
    expect(layer.mesh.instanceMatrix.count).toBe(SHIELD_WAVE_CAPACITY);
    const matrix = new THREE.Matrix4();
    layer.mesh.getMatrixAt(0, matrix);
    const position = new THREE.Vector3().setFromMatrixPosition(matrix);
    expect(position.x).toBeCloseTo(0.5);
    expect(position.y).toBeCloseTo(1.25);
    expect(position.z).toBeCloseTo(0);
    expect((layer.mesh.geometry.getAttribute("aOpacity") as THREE.InstancedBufferAttribute).getX(0)).toBeCloseTo(0.5);
    expect((layer.material.uniforms.uMap as { value: THREE.Texture }).value).toBeDefined();
    layer.dispose();
    layer.dispose();
    expect(layer.mesh.count).toBe(0);
    expect(layer.endureMesh.count).toBe(0);
  });

  it("binds the Endure billboard to the current player position, then expires it", () => {
    const layer = new OfficialSkillEffectLayer(data(), () => new THREE.Texture());
    const events: RunEvent[] = [endureCast()];
    layer.ingest(events, 100);
    const heightAt = (xm: number, ym: number): number => xm - ym;
    layer.update(550, 2500, -1500, heightAt, new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), 0.75);
    expect(layer.endureMesh.count).toBe(1);
    expect(layer.activeCount).toBe(1);
    const matrix = new THREE.Matrix4();
    layer.endureMesh.getMatrixAt(0, matrix);
    const firstPosition = new THREE.Vector3().setFromMatrixPosition(matrix);
    expect(firstPosition.x).toBeCloseTo(2.5);
    expect(firstPosition.y).toBeCloseTo(4.9);
    expect(firstPosition.z).toBeCloseTo(1.5);
    layer.update(600, 5000, 1000, heightAt, new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), 1);
    layer.endureMesh.getMatrixAt(0, matrix);
    const secondPosition = new THREE.Vector3().setFromMatrixPosition(matrix);
    expect(secondPosition.x).toBeCloseTo(5);
    expect(secondPosition.y).toBeCloseTo(4.9);
    expect(secondPosition.z).toBeCloseTo(-1);
    layer.update(1000, 5000, 1000, heightAt, new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), 1);
    expect(layer.endureMesh.count).toBe(0);
  });

  it("fails closed instead of resizing or substituting a drifted source", () => {
    expect(() => new OfficialSkillEffectLayer(data(32, 64), (image) => new THREE.Texture(image as unknown as HTMLImageElement))).toThrow(/expected verified 64x64/u);
    expect(() => new OfficialSkillEffectLayer(data(64, 64, 32, 64), (image) => new THREE.Texture(image as unknown as HTMLImageElement))).toThrow(/effect\.skill\.sw\.endure: expected verified 64x64/u);
    const noEndure = data();
    noEndure.effects.delete(ENDURE_EFFECT_ID);
    expect(() => new OfficialSkillEffectLayer(noEndure, () => new THREE.Texture())).toThrow(/verified TGA metadata not loaded/u);
    const noEndureImage = data();
    noEndureImage.effectImages.delete(ENDURE_EFFECT_ID);
    expect(() => new OfficialSkillEffectLayer(noEndureImage, () => new THREE.Texture())).toThrow(/expected verified 64x64/u);
    const wrongEndureFormat = data();
    wrongEndureFormat.effects.set(ENDURE_EFFECT_ID, { ...endureMeta, format: "bmp" });
    expect(() => new OfficialSkillEffectLayer(wrongEndureFormat, () => new THREE.Texture())).toThrow(/verified TGA metadata not loaded/u);
    const wrongEndure = data();
    wrongEndure.effects.set(ENDURE_EFFECT_ID, { ...endureMeta, bitsPerPixel: 24, alpha: { mode: "ro-color-key", keyedPixels: 1 } });
    expect(() => new OfficialSkillEffectLayer(wrongEndure, () => new THREE.Texture())).toThrow(/verified 32-bit source-alpha/u);
    const missing = { effects: new Map(), effectImages: new Map() } as unknown as FormalSceneData;
    expect(() => new OfficialSkillEffectLayer(missing, (image) => new THREE.Texture(image as unknown as HTMLImageElement))).toThrow(/metadata not loaded/u);
  });

  it("releases the first GPU allocation if the second texture factory call fails", () => {
    const first = new THREE.Texture();
    let disposed = 0;
    first.dispose = () => { disposed += 1; };
    let calls = 0;
    expect(() => new OfficialSkillEffectLayer(data(), () => {
      calls += 1;
      if (calls === 2) throw new Error("endure texture failed");
      return first;
    })).toThrow(/endure texture failed/u);
    expect(disposed).toBe(1);
  });

  it("disposes both bounded GPU lanes exactly once", () => {
    const shieldTexture = new THREE.Texture();
    const endureTexture = new THREE.Texture();
    const fixture = data();
    const endureImage = fixture.effectImages.get(ENDURE_EFFECT_ID);
    const layer = new OfficialSkillEffectLayer(fixture, (image) => image === endureImage ? endureTexture : shieldTexture);
    const counts = { shieldTexture: 0, endureTexture: 0, shieldGeometry: 0, endureGeometry: 0, shieldMaterial: 0, endureMaterial: 0 };
    shieldTexture.dispose = () => { counts.shieldTexture += 1; };
    endureTexture.dispose = () => { counts.endureTexture += 1; };
    layer.mesh.geometry.dispose = () => { counts.shieldGeometry += 1; };
    layer.endureMesh.geometry.dispose = () => { counts.endureGeometry += 1; };
    layer.material.dispose = () => { counts.shieldMaterial += 1; };
    layer.endureMaterial.dispose = () => { counts.endureMaterial += 1; };
    layer.dispose();
    layer.dispose();
    expect(counts).toEqual({ shieldTexture: 1, endureTexture: 1, shieldGeometry: 1, endureGeometry: 1, shieldMaterial: 1, endureMaterial: 1 });
    expect(layer.object.children).toHaveLength(0);
  });
});

const bashCast = (geomId = "player:skill.sw.bash:1", tick = 10, rank = 1): Extract<RunEvent, { type: "skill" }> => ({
  type: "skill", tick, source: "skill.sw.bash", geomId,
  origin: { xMm: 1000, yMm: 2000 }, direction: { x: 0, y: -10_000 },
  geometry: { shape: "capsule", rangeMm: 2400, radiusMm: 650 }, rank,
  vfxCue: "skill.sw.bash", designOrigin: "official-name-adapted",
});
const bashHit = (geomId: string, targetId: number | undefined, xMm: number | undefined, yMm: number | undefined, tick = 10): Extract<RunEvent, { type: "hit" }> => ({
  type: "hit", tick, source: "skill.sw.bash", geomId, amount: 50,
  ...(targetId === undefined ? {} : { targetId }), ...(xMm === undefined ? {} : { xMm }), ...(yMm === undefined ? {} : { yMm }),
});

describe("Bash impact presentation", () => {
  it("anchors one impact on a single authoritative positioned hit", () => {
    const p = new BashPresentation();
    p.ingest([bashCast(), bashHit("player:skill.sw.bash:1", 7, 1100, 800)], 1000);
    expect(p.cues).toHaveLength(1);
    expect(p.cues[0]).toMatchObject({ targetId: 7, xMm: 1100, yMm: 800, startMs: 1000, endMs: 1000 + BASH_IMPACT_DURATION_MS });
  });

  it("draws both rank-3 targets, never only the first", () => {
    const p = new BashPresentation();
    p.ingest([bashCast("g", 10, 3), bashHit("g", 1, 900, 700), bashHit("g", 2, 1300, 600)], 0);
    expect(p.cues.map((c) => [c.targetId, c.xMm, c.yMm])).toEqual([[1, 900, 700], [2, 1300, 600]]);
  });

  it("never replays a geomId + target pair for the same array, a retained copy or a duplicated hit", () => {
    const p = new BashPresentation();
    const events: RunEvent[] = [bashCast("g"), bashHit("g", 1, 0, 0), bashHit("g", 1, 0, 0)];
    p.ingest(events, 0);
    p.ingest(events, 10);
    p.ingest([...events], 20);
    expect(p.cues).toHaveLength(1);
    p.prune(BASH_IMPACT_DURATION_MS + 50);
    p.ingest([...events], BASH_IMPACT_DURATION_MS + 60);
    expect(p.cues).toHaveLength(0);
  });

  it("preserves event order across multiple fixed steps in one render frame and offsets older ticks", () => {
    const p = new BashPresentation();
    p.ingest([bashCast("a", 10), bashHit("a", 1, 10, 0, 10), bashCast("b", 12), bashHit("b", 2, 20, 0, 12)], 1000);
    expect(p.cues.map((c) => c.geomId)).toEqual(["a", "b"]);
    expect(p.cues[0]?.startMs).toBeCloseTo(1000 - 2 * (1000 / 60));
    expect(p.cues[1]?.startMs).toBe(1000);
  });

  it("uses exactly one bounded fallback only when no positioned hit exists", () => {
    const p = new BashPresentation();
    p.ingest([bashCast("g"), bashHit("g", 3, undefined, undefined), bashHit("other", 4, 5, 5)], 0);
    expect(p.cues).toHaveLength(1);
    expect(p.cues[0]).toMatchObject({ targetId: null, xMm: 1000, yMm: 2000 - 2400 });
    p.ingest([bashCast("g")], 5);
    expect(p.cues).toHaveLength(1);
  });

  it("bounds per-cast anchors and the global queue, then expires every cue", () => {
    const p = new BashPresentation();
    const events: RunEvent[] = [];
    for (let c = 0; c < 6; c += 1) {
      events.push(bashCast(`g${c}`, 10));
      for (let t = 0; t < 6; t += 1) events.push(bashHit(`g${c}`, c * 10 + t, t, c));
    }
    p.ingest(events, 0);
    expect(BASH_MAX_PER_CAST).toBe(4);
    expect(p.cues).toHaveLength(BASH_CAPACITY);
    expect(p.cues.filter((c) => c.geomId === "g5")).toHaveLength(4);
    p.prune(BASH_IMPACT_DURATION_MS - 1);
    expect(p.cues).toHaveLength(BASH_CAPACITY);
    p.prune(BASH_IMPACT_DURATION_MS);
    expect(p.cues).toHaveLength(0);
  });

  it("ignores other skills, unknown cues and an empty frame", () => {
    const p = new BashPresentation();
    p.ingest([cast(), endureCast(), { ...bashCast(), source: "skill.sw.unknown" }], 0);
    p.ingest([], 1);
    expect(p.cues).toHaveLength(0);
  });

  it("samples four bounded planes that fade out by the deadline", () => {
    const cue = { id: 1, geomId: "g", targetId: 1, xMm: 0, yMm: 0, startMs: 0, endMs: 360, phase: 0 };
    const start = sampleBashImpact(cue, 0);
    expect(start.visible).toBe(true);
    expect(start.planes).toHaveLength(4);
    expect(start.planes[0].opacity).toBe(1);
    const mid = sampleBashImpact(cue, 40);
    expect(mid.planes[1].opacity).toBeGreaterThan(0);
    expect(mid.planes[2].opacity).toBeGreaterThan(0);
    const end = sampleBashImpact(cue, 360);
    expect(end.visible).toBe(false);
    for (const plane of end.planes) {
      expect(plane.opacity).toBe(0);
      expect(plane.scale).toBeGreaterThan(0);
    }
  });
});

describe("official Bash GPU lanes", () => {
  it("draws every impact with four verified sources in four bounded lanes, then expires to 0", () => {
    const layer = new OfficialSkillEffectLayer(data(), () => new THREE.Texture());
    expect(layer.bashMeshes.map((m) => [(m.userData as { sourceAssetId: string }).sourceAssetId, m.instanceMatrix.count])).toEqual(BASH_EFFECT_IDS.map((id) => [id, BASH_CAPACITY]));
    layer.ingest([bashCast("g", 10, 3), bashHit("g", 1, 2000, -1000), bashHit("g", 2, 3000, -1000)], 0);
    layer.update(40, 0, 0, () => 0, new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), 1);
    expect(layer.bashActiveCount).toBe(2);
    expect(layer.activeCount).toBe(2);
    for (const mesh of layer.bashMeshes) expect(mesh.count).toBe(2);
    const matrix = new THREE.Matrix4();
    layer.bashMeshes[1]?.getMatrixAt(1, matrix);
    const position = new THREE.Vector3().setFromMatrixPosition(matrix);
    expect([position.x, position.z]).toEqual([3, 1]);
    const size = (layer.bashMaterials[2]?.uniforms.uSize as { value: THREE.Vector2 }).value;
    expect([size.x, size.y]).toEqual([32 * 0.025, 128 * 0.025]);
    layer.update(BASH_IMPACT_DURATION_MS, 0, 0, () => 0, new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), 1);
    expect(layer.bashActiveCount).toBe(0);
    for (const mesh of layer.bashMeshes) expect(mesh.count).toBe(0);
    layer.dispose();
  });

  it.each(BASH_EFFECT_IDS)("fails closed when %s is missing, drifted or not source-alpha", (id) => {
    const c = BASH_EFFECT_CONTRACT[id];
    const make = (mutate: (d: FormalSceneData) => void): (() => OfficialSkillEffectLayer) => () => {
      const d = data();
      mutate(d);
      return new OfficialSkillEffectLayer(d, () => new THREE.Texture());
    };
    expect(make((d) => d.effects.delete(id))).toThrow(/verified TGA metadata not loaded/u);
    expect(make((d) => d.effectImages.delete(id))).toThrow(new RegExp(`expected verified ${c.width}x${c.height}`, "u"));
    expect(make((d) => d.effectImages.set(id, { width: c.width, height: c.height + 1 }))).toThrow(/expected verified/u);
    expect(make((d) => d.effects.set(id, { ...bashEffectMeta(id), format: "bmp" }))).toThrow(/verified TGA metadata not loaded/u);
    expect(make((d) => d.effects.set(id, { ...bashEffectMeta(id), bitsPerPixel: 24 }))).toThrow(/verified 32-bit source-alpha/u);
    expect(make((d) => d.effects.set(id, { ...bashEffectMeta(id), alpha: { mode: "ro-color-key", keyedPixels: 1 } }))).toThrow(/verified 32-bit source-alpha/u);
    expect(make((d) => d.effects.set(id, { ...bashEffectMeta(id), derived: { ...bashEffectMeta(id).derived, width: 1 } }))).toThrow(/derived 1x/u);
    expect(make((d) => d.effects.set(id, { ...bashEffectMeta(id), derived: { ...bashEffectMeta(id).derived, sha256: "" } }))).toThrow(/SHA-256 contract missing/u);
    expect(make((d) => d.effects.set(id, { ...bashEffectMeta(id), source: { ...bashEffectMeta(id).source, canonicalPath: "data\\texture\\effect\\other.tga" } }))).toThrow(/source data/u);
    expect(make((d) => d.effects.set(id, { ...bashEffectMeta(id), source: { ...bashEffectMeta(id).source, bytes: 1 } }))).toThrow(/source 1 bytes/u);
  });

  it("releases every earlier lane when a later Bash lane fails to construct", () => {
    const disposed: number[] = [];
    let calls = 0;
    expect(() => new OfficialSkillEffectLayer(data(), () => {
      calls += 1;
      if (calls === 5) throw new Error("lens1 texture failed");
      const t = new THREE.Texture();
      const n = calls;
      t.dispose = () => { disposed.push(n); };
      return t;
    })).toThrow(/lens1 texture failed/u);
    expect(disposed.sort()).toEqual([1, 2, 3, 4]);
  });

  it("disposes all six lanes exactly once and ignores later frames", () => {
    const textures: THREE.Texture[] = [];
    const layer = new OfficialSkillEffectLayer(data(), () => {
      const t = new THREE.Texture();
      textures.push(t);
      return t;
    });
    const counts = { texture: 0, geometry: 0, material: 0 };
    for (const t of textures) t.dispose = () => { counts.texture += 1; };
    for (const m of [layer.mesh, layer.endureMesh, ...layer.bashMeshes]) {
      m.geometry.dispose = () => { counts.geometry += 1; };
      (m.material as THREE.ShaderMaterial).dispose = () => { counts.material += 1; };
    }
    layer.dispose();
    layer.dispose();
    layer.ingest([bashCast("g"), bashHit("g", 1, 0, 0)], 0);
    layer.update(10, 0, 0, () => 0, new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), 1);
    expect(counts).toEqual({ texture: 6, geometry: 6, material: 6 });
    expect(layer.bashActiveCount).toBe(0);
    expect(layer.object.children).toHaveLength(0);
  });
});
