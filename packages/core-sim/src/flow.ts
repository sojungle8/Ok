import type { RunPhase } from "./run/run.ts";

/** Screen-level state machine (04 §2.1). Pure: (state, event) -> state; invalid events are rejected. */
export type FlowState =
  | { screen: "boot" }
  | { screen: "title" }
  | { screen: "character-select" }
  | { screen: "stage-select"; job: string }
  | { screen: "loading"; job: string; stage: string; runSeed: number }
  | { screen: "running" | "draft-paused" | "boss-intro"; job: string; stage: string; runSeed: number }
  | { screen: "victory" | "defeat"; job: string; stage: string; runSeed: number }
  | { screen: "results"; job: string; stage: string; runSeed: number; outcome: "victory" | "defeat"; settled: boolean };

export type FlowEvent =
  | { type: "booted" }
  | { type: "start" }
  | { type: "back" }
  | { type: "choose-character"; job: string }
  | { type: "choose-stage"; stage: string; runSeed: number }
  | { type: "loaded" }
  | { type: "load-failed" }
  | { type: "run-phase"; phase: RunPhase }
  | { type: "show-results" }
  | { type: "settled" }
  | { type: "continue" };

export class FlowError extends Error {
  constructor(state: FlowState, event: FlowEvent) {
    super(`invalid flow transition: ${event.type} in ${state.screen}`);
    this.name = "FlowError";
  }
}

const RUN_SCREEN: Record<RunPhase, "running" | "draft-paused" | "boss-intro" | "victory" | "defeat"> = {
  running: "running",
  draft: "draft-paused",
  "keystone-confirm": "draft-paused",
  "boss-intro": "boss-intro",
  victory: "victory",
  defeat: "defeat",
};

export function flowTransition(s: FlowState, e: FlowEvent): FlowState {
  switch (s.screen) {
    case "boot":
      if (e.type === "booted") return { screen: "title" };
      break;
    case "title":
      if (e.type === "start") return { screen: "character-select" };
      break;
    case "character-select":
      if (e.type === "choose-character") return { screen: "stage-select", job: e.job };
      if (e.type === "back") return { screen: "title" };
      break;
    case "stage-select":
      if (e.type === "choose-stage") return { screen: "loading", job: s.job, stage: e.stage, runSeed: e.runSeed };
      if (e.type === "back") return { screen: "character-select" };
      break;
    case "loading":
      if (e.type === "loaded") return { ...s, screen: "running" };
      if (e.type === "load-failed") return { screen: "stage-select", job: s.job };
      break;
    case "running":
    case "draft-paused":
    case "boss-intro":
      if (e.type === "run-phase") return { ...s, screen: RUN_SCREEN[e.phase] };
      break;
    case "victory":
    case "defeat":
      if (e.type === "show-results") return { screen: "results", job: s.job, stage: s.stage, runSeed: s.runSeed, outcome: s.screen, settled: false };
      if (e.type === "run-phase" && RUN_SCREEN[e.phase] === s.screen) return s;
      break;
    case "results":
      if (e.type === "settled") return { ...s, settled: true };
      if (e.type === "continue" && s.settled) return { screen: "stage-select", job: s.job };
      break;
  }
  throw new FlowError(s, e);
}

/**
 * After a reload, a run resumes only from a running-phase checkpoint, so the flow re-enters
 * `running` — never a half-open draft. Unsettled results resume at `results` (settlement retries).
 */
export function resumeFlow(saved: FlowState): FlowState {
  if (saved.screen === "results") return saved;
  if (saved.screen === "running" || saved.screen === "draft-paused" || saved.screen === "boss-intro") return { ...saved, screen: "running" };
  if (saved.screen === "loading" || saved.screen === "victory" || saved.screen === "defeat") return { screen: "title" };
  return saved;
}
