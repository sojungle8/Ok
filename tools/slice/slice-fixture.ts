import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { compileSliceContent } from "@ro-survivor/content-schema";
import { botCommand, createRun, stepRun, type BuildPlan, type RunConfig, type RunContent, type RunInput, type RunState } from "@ro-survivor/core-sim";

const root = resolve(import.meta.dirname, "../..");
export const sliceContent: RunContent = compileSliceContent(JSON.parse(readFileSync(resolve(root, "docs/product-plan/handoff/vertical-slice-content-seed.json"), "utf8")));

export type Adapt = (x: number, y: number) => { moveX: number; moveY: number };
export const analog: Adapt = (x, y) => ({ moveX: x, moveY: y });

export function sliceConfig(seed: number, plan: BuildPlan, extra: Partial<RunConfig> = {}): RunConfig {
  return { content: sliceContent, runSeed: seed, loadout: sliceContent.buildLoadouts[plan] ?? sliceContent.standardLoadout, ...extra };
}

/** Play a whole run with the bot through an input adapter; optional per-step observer. */
export function playRun(seed: number, plan: BuildPlan, adapt: Adapt = analog, observe?: (st: RunState, input: RunInput) => void, maxTicks = 60 * 60 * 20): RunState {
  const cfg = sliceConfig(seed, plan);
  const st = createRun(cfg);
  let seq = 0;
  while (st.phase !== "victory" && st.phase !== "defeat" && st.tick < maxTicks) {
    const input = botCommand(sliceContent, st, plan, seq++, adapt);
    stepRun(st, cfg, input);
    observe?.(st, input);
  }
  return st;
}
