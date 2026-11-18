import * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { Enemy, RunContent, RunState } from "@ro-survivor/core-sim";
import { DEFAULT_SETTINGS } from "../src/settings.ts";
import {
  CombatOverlay,
  CombatPresentationState,
  formatDamage,
  officialShadowScale,
  sharedSpriteVisualScale,
  type ActorSnapshot,
  type DamageCue,
} from "../src/game/presentation.ts";
import { BillboardBatch } from "../src/game/renderer.ts";
import type { SheetData, SpriteSheet } from "../src/game/sprites.ts";

function content(): RunContent {
  const monster = (id: string, assetRef: string, role: string, radiusMm: number) => ({ id, assetRef, role, radiusMm });
  return {
    player: { basicSkillId: "skill.sw.basic_slash" },
    monsters: {
      "monster.poring": monster("monster.poring", "monster.1002", "normal", 400),
      "elite.poring": monster("elite.poring", "monster.1002", "elite", 580),
      "monster.fabre": monster("monster.fabre", "monster.1007", "normal", 400),
      "monster.mandragora": monster("monster.mandragora", "monster.1020", "normal-ranged", 400),
      "miniboss.vocal": monster("miniboss.vocal", "monster.1088", "miniboss", 750),
    },
  } as unknown as RunContent;
}

function state(events: RunState["events"] = [], phase: RunState["phase"] = "running"): RunState {
  return {
    phase,
    events,
    runTick: 10,
    player: { x: 1000, y: 2000, moving: false, castSlot: -1, basicHitAt: -1 },
  } as unknown as RunState;
}

function enemy(id = 7): Enemy {
  return { id, stunUntil: 0 } as Enemy;
}

function actor(id = 7): ActorSnapshot {
  return { id, type: "monster.poring", assetRef: "monster.1002", xMm: 3000, yMm: 4000, fx: 0, fy: -10_000, visualScale: 1, shadowScale: 1, deathDurationMs: 600 };
}

describe("event-driven combat presentation", () => {
  it("uses the shared-atlas elite ratio and original-client shadow ratios", () => {
    const c = content();
    expect(sharedSpriteVisualScale(c, "monster.poring")).toBe(1);
    expect(sharedSpriteVisualScale(c, "elite.poring")).toBeCloseTo(1.45);
    expect(sharedSpriteVisualScale(c, "miniboss.vocal")).toBe(1); // distinct atlas; do not double-scale it
    expect(officialShadowScale(c, "elite.poring")).toBeCloseTo(1.45);
    expect(officialShadowScale(c, "monster.fabre")).toBe(0.5);
    expect(officialShadowScale(c, "monster.mandragora")).toBe(0);
  });

  it("plays hit, attacker, cast and death slots; a frozen terminal event batch cannot replay", () => {
    const p = new CombatPresentationState();
    const actors = new Map([[7, actor()]]);
    p.ingest(state(), 0, actors, DEFAULT_SETTINGS, "skill.sw.basic_slash");

    const hitEvents: RunState["events"] = [{ type: "hit", tick: 10, source: "skill.sw.basic_slash", targetId: 7, amount: 1800 }];
    const hitState = state(hitEvents);
    p.ingest(hitState, 10, actors, DEFAULT_SETTINGS, "skill.sw.basic_slash");
    expect(p.enemyAnimation(enemy(), hitState, 10, 10).slot).toBe("hit");
    expect(p.damage).toHaveLength(1);
    p.ingest(hitState, 11, actors, DEFAULT_SETTINGS, "skill.sw.basic_slash");
    expect(p.damage).toHaveLength(1); // exact same events array is consumed once

    const playerHit = state([{ type: "player-hit", tick: 11, source: "monster.poring", actorId: 7, amount: 500 }]);
    p.ingest(playerHit, 200, actors, DEFAULT_SETTINGS, "skill.sw.basic_slash");
    expect(p.playerAnimation(playerHit, 200, 200).slot).toBe("hit");
    expect(p.enemyAnimation(enemy(), playerHit, 200, 200).slot).toBe("attack");

    const skill = state([{ type: "skill", tick: 12, source: "skill.sw.magnum_break", geomId: "g", origin: { xMm: 1000, yMm: 2000 }, direction: { x: 1, y: 0 }, geometry: null, rank: 1, vfxCue: "skill.sw.magnum_break", designOrigin: "official-name-adapted" }]);
    p.ingest(skill, 450, actors, DEFAULT_SETTINGS, "skill.sw.basic_slash");
    expect(p.playerAnimation(skill, 450, 450).slot).toBe("cast");

    const terminalEvents: RunState["events"] = [
      { type: "hit", tick: 13, source: "skill.sw.basic_slash", targetId: 7, amount: 1800 },
      { type: "kill", tick: 13, source: "skill.sw.basic_slash", targetId: 7 },
    ];
    const terminal = state(terminalEvents, "victory");
    terminal.player.castSlot = 0;
    terminal.player.basicHitAt = 999;
    terminal.player.moving = true;
    p.ingest(terminal, 500, new Map(), DEFAULT_SETTINGS, "skill.sw.basic_slash");
    p.ingest(terminal, 510, new Map(), DEFAULT_SETTINGS, "skill.sw.basic_slash");
    expect([...p.deaths.values()][0]).toMatchObject({ id: 7, startMs: 500, endMs: 1100 });
    expect(p.damage.at(-1)).toMatchObject({ amount: 1800, startMs: 500 });
    expect(p.playerAnimation(terminal, 510, 510).slot).toBe("idle");

    // A new run clears the previous result's presentation state before accepting new events.
    p.ingest(state(), 520, new Map(), DEFAULT_SETTINGS, "skill.sw.basic_slash");
    expect(p.deaths.size).toBe(0);
    expect(p.damage).toHaveLength(0);

    const defeated = state([], "defeat");
    defeated.player.castSlot = 0;
    defeated.player.basicHitAt = 999;
    defeated.player.moving = true;
    p.ingest(defeated, 600, new Map(), DEFAULT_SETTINGS, "skill.sw.basic_slash", 800);
    expect(p.playerAnimation(defeated, 600, 600)).toEqual({ slot: "death", timeMs: 0 });
    expect(p.playerAnimation(defeated, 1600, 1600)).toEqual({ slot: "death", timeMs: 799 });
  });

  it("settings really gate damage numbers, flash and shake", () => {
    const p = new CombatPresentationState();
    const actors = new Map([[7, actor()]]);
    const off = { ...DEFAULT_SETTINGS, damageNumbers: false, flash: false, shake: false };
    const eventState = state([{ type: "player-hit", tick: 10, source: "monster.poring", actorId: 7, amount: 900 }]);
    p.ingest(eventState, 0, actors, off, "skill.sw.basic_slash");
    expect(p.damage).toHaveLength(0);
    expect(p.flash(1, true, 1)).toBeNull();
    expect(p.shake(1, true)).toEqual({ x: 0, z: 0 });

    const onState = state([{ type: "player-hit", tick: 11, source: "monster.poring", actorId: 7, amount: 900 }]);
    p.ingest(onState, 10, actors, DEFAULT_SETTINGS, "skill.sw.basic_slash");
    expect(p.damage).toHaveLength(1);
    expect(p.flash(11, true, 1)?.kind).toBe("player");
    expect(p.flash(11, false, 1)).toBeNull();
    expect(p.shake(11, true)).not.toEqual({ x: 0, z: 0 });
    expect(p.shake(11, false)).toEqual({ x: 0, z: 0 });
    expect(formatDamage(1)).toBe("1");
    expect(formatDamage(1800)).toBe("18");
  });

  it("starts ACT during wind-up and keeps animation time continuous through resolve", () => {
    const p = new CombatPresentationState();
    const actors = new Map([[7, actor()]]);
    const basicWindup = state();
    basicWindup.runTick = 20;
    basicWindup.player.basicHitAt = 28;
    p.ingest(basicWindup, 100, actors, DEFAULT_SETTINGS, "skill.sw.basic_slash");
    expect(p.playerAnimation(basicWindup, 150, 9_000)).toEqual({ slot: "attack", timeMs: 50 });

    const basicResolve = state([{ type: "skill", tick: 28, source: "skill.sw.basic_slash", geomId: "basic", origin: { xMm: 1000, yMm: 2000 }, direction: { x: 1, y: 0 }, geometry: null, rank: 1, vfxCue: "skill.sw.basic_slash", designOrigin: "official-name-adapted" }]);
    basicResolve.runTick = 28;
    p.ingest(basicResolve, 234, actors, DEFAULT_SETTINGS, "skill.sw.basic_slash");
    expect(p.playerAnimation(basicResolve, 234, 9_000)).toEqual({ slot: "attack", timeMs: 134 });

    const castWindup = state();
    castWindup.runTick = 30;
    castWindup.player.castSlot = 0;
    castWindup.player.castEndAt = 42;
    p.ingest(castWindup, 300, actors, DEFAULT_SETTINGS, "skill.sw.basic_slash");
    expect(p.playerAnimation(castWindup, 350, 9_000)).toEqual({ slot: "cast", timeMs: 50 });

    const telegraphState = state([{ type: "telegraph", tick: 40, source: "mvp", geomId: "enemy:7:slam" }]);
    telegraphState.runTick = 40;
    telegraphState.telegraphs = [{ id: 1, geomId: "enemy:7:slam", ownerId: 7, attackId: "slam", placed: {} as never, startTick: 40, hitTick: 52, endTick: 53, damage: 100, resolved: false }];
    p.ingest(telegraphState, 500, actors, DEFAULT_SETTINGS, "skill.sw.basic_slash");
    expect(p.enemyAnimation(enemy(), telegraphState, 550, 9_000)).toEqual({ slot: "attack", timeMs: 50 });
  });

  it("bounds dense-area damage text so the DOM overlay cannot grow without limit", () => {
    const p = new CombatPresentationState();
    const actors = new Map(Array.from({ length: 140 }, (_, index) => [index + 1, actor(index + 1)]));
    p.ingest(state(), 0, actors, DEFAULT_SETTINGS, "skill.sw.basic_slash");
    p.ingest(state(Array.from({ length: 140 }, (_, index) => ({
      type: "hit" as const,
      tick: 10,
      source: "skill.sw.magnum_break",
      targetId: index + 1,
      amount: 100,
    }))), 10, actors, DEFAULT_SETTINGS, "skill.sw.basic_slash");
    expect(p.damage).toHaveLength(96);
    expect(p.damage[0]?.id).toBe(45);
  });
});

class FakeStyle {
  display = "";
  left = "";
  top = "";
  opacity = "";
}

class FakeElement {
  className = "";
  textContent: string | null = null;
  readonly style = new FakeStyle();
  readonly children: FakeElement[] = [];
  parent: FakeElement | null = null;
  removed = false;
  append(...nodes: FakeElement[]): void {
    for (const node of nodes) {
      node.parent = this;
      this.children.push(node);
    }
  }
  remove(): void {
    this.removed = true;
    if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = null;
  }
}

describe("combat overlay lifecycle", () => {
  it("creates text-only damage nodes and dispose removes the complete overlay", () => {
    const host = new FakeElement();
    const doc = { createElement: () => new FakeElement() };
    const overlay = new CombatOverlay(host as unknown as HTMLElement, doc as unknown as Pick<Document, "createElement">);
    const cue: DamageCue = { id: 1, kind: "enemy", amount: 1234, xMm: 0, yMm: 0, visualScale: 1, startMs: 0, endMs: 720 };
    overlay.syncDamage([cue], 10, true, () => ({ x: 20, y: 30, visible: true }));
    expect(overlay.damageNodeCount).toBe(1);
    expect((overlay.root as unknown as FakeElement).children.at(-1)?.textContent).toBe("13");
    overlay.syncDamage([cue], 20, false, () => ({ x: 20, y: 30, visible: true }));
    expect(overlay.damageNodeCount).toBe(0);
    overlay.dispose();
    overlay.dispose();
    expect(overlay.disposed).toBe(true);
    expect(host.children).toHaveLength(0);
  });
});

describe("billboard instance visual scale", () => {
  it("stores a per-instance scale without changing the world position", () => {
    const directions = Array.from({ length: 8 }, () => ({ frames: [0], delayMs: 100 }));
    const slots = Object.fromEntries(["idle", "walk", "attack", "hit", "death", "cast"].map((slot) => [slot, { directions }])) as SheetData["slots"];
    const sheet: SpriteSheet = {
      data: { atlas: { width: 8, height: 8 }, slots, frames: [{ x: 0, y: 0, w: 8, h: 8, originX: 4, originY: 8, flipX: false }] },
      texture: new THREE.Texture(), pxToWorld: 0.025, source: "fan-local", textureBytes: 256,
    };
    const batch = new BillboardBatch(sheet, 2);
    batch.set(0, 3, 4, 5, "walk", 0, 0, 1.45);
    expect(batch.scale.getX(0)).toBeCloseTo(1.45);
    const matrix = new THREE.Matrix4();
    batch.mesh.getMatrixAt(0, matrix);
    expect(new THREE.Vector3().setFromMatrixPosition(matrix).toArray()).toEqual([3, 4, 5]);
  });
});
