import type * as THREE from "three";
import type { RunEvent } from "@ro-survivor/core-sim";
import type { GroundData } from "./renderer.ts";

export interface WorldSkillEffectLayer {
  readonly sourceAssetId: string;
  readonly sourceAssetIds: readonly string[];
  readonly object: THREE.Object3D;
  readonly activeCount: number;
  readonly shieldWaveActiveCount: number;
  readonly endureActiveCount: number;
  readonly bashActiveCount: number;
  readonly magnumBreakActiveCount: number;
  readonly provokeActiveCount: number;
  ingest(events: readonly RunEvent[], nowMs: number): void;
  update(nowMs: number, playerXmm: number, playerYmm: number, heightAt: (xm: number, ym: number) => number, right: THREE.Vector3, up: THREE.Vector3, effectOpacity: number): void;
  dispose(): void;
}

/** Height lookup from the GAT walk grid (RO units × 0.2 m, up positive). Not a visual: used by both worlds. */
export function gatHeightAt(data: GroundData): (xm: number, ym: number) => number {
  const { width: w, height: h } = data;
  return (xm, ym) => {
    const x = Math.max(0, Math.min(w - 1, Math.floor(xm)));
    const y = Math.max(0, Math.min(h - 1, Math.floor(ym)));
    return -(data.cellHeights[y * w + x] ?? 0) * 0.2;
  };
}

/** What the run renderer draws the world with. Formal (original RO assets) and fixture worlds are separate modules. */
export interface WorldLayer {
  readonly kind: "formal" | "fixture";
  readonly object: THREE.Object3D;
  /** Formal worlds expose original-RO skill effects; fixture worlds deliberately omit them. */
  readonly skillEffects?: WorldSkillEffectLayer;
  heightAt(xm: number, ym: number): number;
  update(timeMs: number): void;
  setDebugOverlay(on: boolean): void;
  dispose(): void;
}
