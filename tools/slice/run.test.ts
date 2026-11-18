import { describe, expect, it } from "vitest";
import { FakeClock } from "@ro-survivor/testkit";
import {
  botCommand, checkpoint, createRun, FixedStepClock, generateDraft, eligibleOptions, optionKey, restore, Rng, runHash, stepRun, buildView, type DraftOption, type RunState,
} from "@ro-survivor/core-sim";
import { playRun, sliceConfig, sliceContent as c } from "./slice-fixture.ts";

/** Advance with the bot until `until(st)` or `limit` steps. */
function advance(st: RunState, plan: "guardian" | "weapon" | "fury", seed: number, until: (s: RunState) => boolean, limit = 60 * 60 * 15): void {
  const cfg = sliceConfig(seed, plan);
  let seq = st.lastSequence + 1;
  for (let i = 0; i < limit && !until(st); i += 1) stepRun(st, cfg, botCommand(c, st, plan, seq++, (x, y) => ({ moveX: x, moveY: y })));
}

describe("run simulation: determinism", () => {
  it("same seed + same inputs -> same hash; different seed differs", () => {
    const a = playRun(11, "fury", undefined, undefined, 60 * 90);
    const b = playRun(11, "fury", undefined, undefined, 60 * 90);
    expect(runHash(a)).toBe(runHash(b));
    expect(runHash(playRun(12, "fury", undefined, undefined, 60 * 90))).not.toBe(runHash(a));
  });

  it("15, 30 and 60 render FPS give the same 60-second hash", () => {
    const hashes = [15, 30, 60].map((fps) => {
      const cfg = sliceConfig(5, "guardian");
      const st = createRun(cfg);
      const clock = new FixedStepClock(5);
      let seq = 0;
      for (const frame of FakeClock.frameMicros(fps, 60)) {
        for (let n = clock.advance(frame); n > 0; n -= 1) stepRun(st, cfg, botCommand(c, st, "guardian", seq++, (x, y) => ({ moveX: x, moveY: y })));
      }
      expect(st.tick).toBe(3600);
      return runHash(st);
    });
    expect(new Set(hashes).size).toBe(1);
  });
});

describe("run simulation: rules", () => {
  it("an area-clear skill is offered before tick 3600 on 10 seeds", () => {
    for (let seed = 1; seed <= 10; seed += 1) {
      const st = createRun(sliceConfig(seed, "guardian"));
      advance(st, "guardian", seed, (s) => s.phase === "draft" && s.draft !== null && s.draft.options.some((o) => o.id === "skill.sw.magnum_break" || o.id === "skill.sw.shield_wave"), 3600);
      expect(st.phase).toBe("draft");
      expect(st.runTick).toBeLessThan(3600);
    }
  });

  it("automatic skills never move the player", () => {
    const cfg = sliceConfig(3, "fury");
    const st = createRun(cfg);
    st.player.active = ["skill.sw.magnum_break", "skill.sw.bash", "skill.sw.shield_wave", "skill.sw.endure"].map((id) => ({ id, rank: 3, readyAt: 0 }));
    const { x, y } = st.player;
    let fired = 0;
    const skillEvents: Extract<RunState["events"][number], { type: "skill" }>[] = [];
    for (let t = 0; t < 2400 && st.phase === "running"; t += 1) {
      stepRun(st, cfg, { tick: st.tick, sequence: t, moveX: 0, moveY: 0 });
      const events = st.events.filter((e): e is Extract<RunState["events"][number], { type: "skill" }> => e.type === "skill");
      fired += events.length;
      skillEvents.push(...events);
      expect([st.player.x, st.player.y]).toEqual([x, y]);
    }
    expect(fired).toBeGreaterThan(20);
    expect(skillEvents.some((e) => e.source === "skill.sw.endure" && e.geometry === null)).toBe(true);
    expect(skillEvents.every((e) => e.vfxCue === e.source && e.geomId.startsWith(`player:${e.source}:`))).toBe(true);
    expect(skillEvents.every((e) => Number.isInteger(e.origin.xMm) && Number.isInteger(e.origin.yMm) && Number.isInteger(e.rank))).toBe(true);
  });

  it("every telegraph / projectile hit references a geometry ID that was announced", () => {
    const announced = new Set<string>();
    const st = playRun(4, "guardian", undefined, (s) => {
      for (const e of s.events) if ((e.type === "telegraph" || e.type === "projectile") && e.geomId) announced.add(e.geomId);
    });
    expect(st.stats.telegraphHits.length).toBeGreaterThan(0);
    for (const h of st.stats.telegraphHits) expect(announced.has(h.geomId)).toBe(true);
  });

  it("spawns stay outside the camera (>= 13 m from the player)", () => {
    let checked = 0;
    playRun(6, "fury", undefined, (s) => {
      for (const e of s.events) {
        if (e.type !== "spawn" && e.type !== "boss-spawn") continue;
        if (e.source === "monster.poring" && s.enemies.some((x) => x.type === "boss.mastering")) continue; // boss summons
        const en = s.enemies.find((x) => x.id === e.targetId);
        if (!en) continue;
        checked += 1;
        expect(Math.hypot(en.x - s.player.x, en.y - s.player.y)).toBeGreaterThanOrEqual(12_900);
      }
    }, 60 * 60 * 9);
    expect(checked).toBeGreaterThan(300);
  });

  it("pause freezes gameplay time", () => {
    const cfg = sliceConfig(1, "fury");
    const st = createRun(cfg);
    for (let t = 0; t < 120; t += 1) stepRun(st, cfg, { tick: st.tick, sequence: t, moveX: 0, moveY: 0, pause: t >= 60 });
    expect(st.runTick).toBe(60);
  });
});

describe("drafts", () => {
  const view = (st: RunState) => buildView(st);

  it("options are distinct, eligible, and use only the draft RNG stream", () => {
    const st = createRun(sliceConfig(1, "guardian"));
    for (let seed = 1; seed <= 200; seed += 1) {
      const opts = generateDraft(c, { ...view(st), runTick: 5000 }, Rng.fromSeed(seed), "level");
      expect(new Set(opts.map(optionKey)).size).toBe(opts.length);
      const eligible = new Set(eligibleOptions(c, view(st)).map(optionKey));
      for (const o of opts) expect(eligible.has(optionKey(o))).toBe(true);
    }
  });

  it("two-handed builds are never offered shield skills", () => {
    const st = createRun(sliceConfig(1, "weapon"));
    const ids = eligibleOptions(c, view(st)).map((o) => o.id);
    expect(ids).not.toContain("skill.sw.shield_wave");
    expect(ids).toContain("passive.sw.twohand_mastery");
  });

  it("pity forces a new active skill and a defense option", () => {
    const st = createRun(sliceConfig(1, "guardian"));
    st.player.active = [{ id: "skill.sw.bash", rank: 1, readyAt: 0 }];
    const opts = generateDraft(c, { ...view(st), runTick: 99999, levelsSinceNewActive: 3, levelsSinceDefense: 5 }, Rng.fromSeed(1), "level");
    expect(opts.some((o) => o.kind === "new-active")).toBe(true);
    expect(opts.some((o) => ["skill.sw.endure", "passive.sw.hp_recovery", "passive.sw.moving_recovery"].includes(o.id))).toBe(true);
  });

  it("keystones need explicit confirmation; cancel returns to the draft", () => {
    const cfg = sliceConfig(2, "fury");
    const st = createRun(cfg);
    st.player.level = 6;
    st.pendingDrafts.push("keystone");
    stepRun(st, cfg, { tick: st.tick, sequence: 0, moveX: 0, moveY: 0 });
    expect(st.phase).toBe("draft");
    expect(st.draft?.options.every((o: DraftOption) => o.kind === "keystone")).toBe(true);
    stepRun(st, cfg, { tick: st.tick, sequence: 1, moveX: 0, moveY: 0, draftIndex: 1 });
    expect(st.phase).toBe("keystone-confirm");
    stepRun(st, cfg, { tick: st.tick, sequence: 2, moveX: 0, moveY: 0, cancel: true });
    expect(st.phase).toBe("draft");
    expect(st.player.keystone).toBeNull();
    stepRun(st, cfg, { tick: st.tick, sequence: 3, moveX: 0, moveY: 0, draftIndex: 1 });
    stepRun(st, cfg, { tick: st.tick, sequence: 4, moveX: 0, moveY: 0, confirm: true });
    expect(st.phase).toBe("running");
    expect(st.player.keystone).toBe(st.draft === null ? "keystone.guardian" : null);
  });
});

describe("checkpoints", () => {
  it("are only taken while running and resume to the identical hash", () => {
    const cfg = sliceConfig(8, "guardian");
    const a = createRun(cfg);
    advance(a, "guardian", 8, (s) => s.runTick >= 1800 && s.phase === "running");
    const cp = checkpoint(a);
    expect(cp).not.toBeNull();
    const b = restore(cp as string);
    advance(a, "guardian", 8, (s) => s.tick >= 5400);
    advance(b, "guardian", 8, (s) => s.tick >= 5400);
    expect(runHash(b)).toBe(runHash(a));
    advance(a, "guardian", 8, (s) => s.phase === "draft");
    expect(checkpoint(a)).toBeNull();
    expect(() => restore(JSON.stringify({ ...JSON.parse(cp as string), phase: "draft" }))).toThrow(/running/u);
  });
});

describe("boss", () => {
  it("Mastering: intro at 10:00, enrage at 12:00, harden at 70%/40%, bounce ring keeps a safe gap", () => {
    let intro = false;
    let enrage = -1;
    let hardenSeen = 0;
    const ringGaps: number[] = [];
    const st = playRun(2, "fury", undefined, (s) => {
      if (s.phase === "boss-intro") intro = true;
      if (s.events.some((e) => e.type === "enrage")) enrage = s.runTick;
      const boss = s.enemies.find((e) => e.id === s.bossId);
      if (boss && boss.hardenUsed > hardenSeen) hardenSeen = boss.hardenUsed;
      for (const e of s.events) {
        if (e.type === "telegraph" && e.source === "bounce-ring") ringGaps.push(12 - s.projectiles.filter((p) => p.geomId === e.geomId).length);
      }
    });
    expect(st.stats.bossSpawnTick).toBe(36000);
    expect(intro).toBe(true);
    expect(st.phase).toBe("victory");
    expect(hardenSeen).toBe(2);
    if (st.stats.bossKillTick > 43200) expect(enrage).toBe(43201);
    expect(ringGaps.length).toBeGreaterThan(0);
    expect(ringGaps.every((g) => g === 2)).toBe(true);
  }, 60_000);
});
