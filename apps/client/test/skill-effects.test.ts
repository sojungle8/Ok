import * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { DerivedSkillEffectTexture } from "@ro-survivor/asset-contracts";
import type { RunEvent } from "@ro-survivor/core-sim";
import {
  OfficialSkillEffectLayer,
  sampleShieldWaveCue,
  SHIELD_WAVE_CAPACITY,
  SHIELD_WAVE_EFFECT_ID,
  SHIELD_WAVE_MAX_PER_CAST,
  ShieldWavePresentation,
  type ShieldWaveCue,
} from "../src/game/formal/skillEffects.ts";
import type { FormalSceneData } from "../src/game/formal/load.ts";

const cast = (geomId = "shield:1", tick = 10): Extract<RunEvent, { type: "skill" }> => ({
  type: "skill", tick, source: "skill.sw.shield_wave", geomId,
  origin: { xMm: 0, yMm: 0 }, direction: { x: 10_000, y: 0 },
  geometry: { shape: "sector", rangeMm: 4000, halfAngleDeg: 45 }, rank: 1,
  vfxCue: "skill.sw.shield_wave", designOrigin: "original-survivor-adaptation",
});

const hit = (geomId: string, targetId: number, xMm: number, yMm: number, tick = 10): Extract<RunEvent, { type: "hit" }> => ({
  type: "hit", tick, source: "skill.sw.shield_wave", geomId, targetId, xMm, yMm, amount: 3000,
});

const meta: DerivedSkillEffectTexture = {
  rights: "fan-local-derived", converterVersion: 3, assetId: SHIELD_WAVE_EFFECT_ID,
  source: { canonicalPath: "data\\texture\\effect\\shield_boomerang.bmp", bytes: 12344, sha256: "3".repeat(64) },
  kind: "texture", format: "bmp", width: 64, height: 64, bitsPerPixel: 24,
  alpha: { mode: "ro-color-key", keyedPixels: 1 },
  derived: { file: `${SHIELD_WAVE_EFFECT_ID}.png`, sha256: "4".repeat(64), width: 64, height: 64 }, filter: "nearest",
};

const data = (width = 64, height = 64): FormalSceneData => ({
  effects: new Map([[SHIELD_WAVE_EFFECT_ID, meta]]),
  effectImages: new Map([[SHIELD_WAVE_EFFECT_ID, { width, height }]]),
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

describe("official Shield Wave GPU layer", () => {
  it("uses one verified 64x64 original image and one bounded instanced draw", () => {
    const texture = new THREE.Texture();
    const layer = new OfficialSkillEffectLayer(data(), () => texture);
    const events: RunEvent[] = [cast(), hit("shield:1", 7, 1000, 0)];
    layer.ingest(events, 0);
    layer.update(80, () => 0, new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), 0.5);
    expect(layer.sourceAssetId).toBe(SHIELD_WAVE_EFFECT_ID);
    expect(layer.mesh.count).toBe(1);
    expect(layer.mesh.instanceMatrix.count).toBe(SHIELD_WAVE_CAPACITY);
    const matrix = new THREE.Matrix4();
    layer.mesh.getMatrixAt(0, matrix);
    const position = new THREE.Vector3().setFromMatrixPosition(matrix);
    expect(position.x).toBeCloseTo(0.5);
    expect(position.y).toBeCloseTo(1.25);
    expect(position.z).toBeCloseTo(0);
    expect((layer.mesh.geometry.getAttribute("aOpacity") as THREE.InstancedBufferAttribute).getX(0)).toBeCloseTo(0.5);
    expect((layer.material.uniforms.uMap as { value: THREE.Texture }).value).toBe(texture);
    let disposed = 0;
    texture.dispose = () => { disposed += 1; };
    layer.dispose();
    layer.dispose();
    expect(disposed).toBe(1);
    expect(layer.mesh.count).toBe(0);
  });

  it("fails closed instead of resizing or substituting a drifted source", () => {
    expect(() => new OfficialSkillEffectLayer(data(32, 64), (image) => new THREE.Texture(image as unknown as HTMLImageElement))).toThrow(/expected verified 64x64/u);
    const missing = { effects: new Map(), effectImages: new Map() } as unknown as FormalSceneData;
    expect(() => new OfficialSkillEffectLayer(missing, (image) => new THREE.Texture(image as unknown as HTMLImageElement))).toThrow(/metadata not loaded/u);
  });
});
