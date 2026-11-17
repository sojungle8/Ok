import { describe, expect, it } from "vitest";
import { FlowError, flowTransition, resumeFlow, type FlowEvent, type FlowState } from "../src/index.ts";

const run = { job: "job.swordsman", stage: "stage.prt_fild08.slice", runSeed: 7 };

describe("flow state machine", () => {
  it("walks Boot -> Title -> CharacterSelect -> StageSelect -> Loading -> Running -> Draft -> BossIntro -> Victory -> Results", () => {
    const steps: [FlowEvent, FlowState["screen"]][] = [
      [{ type: "booted" }, "title"],
      [{ type: "start" }, "character-select"],
      [{ type: "choose-character", job: run.job }, "stage-select"],
      [{ type: "choose-stage", stage: run.stage, runSeed: 7 }, "loading"],
      [{ type: "loaded" }, "running"],
      [{ type: "run-phase", phase: "draft" }, "draft-paused"],
      [{ type: "run-phase", phase: "keystone-confirm" }, "draft-paused"],
      [{ type: "run-phase", phase: "running" }, "running"],
      [{ type: "run-phase", phase: "boss-intro" }, "boss-intro"],
      [{ type: "run-phase", phase: "running" }, "running"],
      [{ type: "run-phase", phase: "victory" }, "victory"],
      [{ type: "show-results" }, "results"],
      [{ type: "settled" }, "results"],
      [{ type: "continue" }, "stage-select"],
    ];
    let s: FlowState = { screen: "boot" };
    for (const [e, screen] of steps) {
      s = flowTransition(s, e);
      expect(s.screen).toBe(screen);
    }
  });

  it("defeat, back navigation and load failure", () => {
    expect(flowTransition({ screen: "running", ...run }, { type: "run-phase", phase: "defeat" }).screen).toBe("defeat");
    expect(flowTransition({ screen: "defeat", ...run }, { type: "show-results" })).toMatchObject({ screen: "results", outcome: "defeat", settled: false });
    expect(flowTransition({ screen: "character-select" }, { type: "back" }).screen).toBe("title");
    expect(flowTransition({ screen: "stage-select", job: run.job }, { type: "back" }).screen).toBe("character-select");
    expect(flowTransition({ screen: "loading", ...run }, { type: "load-failed" }).screen).toBe("stage-select");
  });

  it("rejects invalid transitions (e.g. continue before settlement, start mid-run)", () => {
    expect(() => flowTransition({ screen: "results", ...run, outcome: "victory", settled: false }, { type: "continue" })).toThrow(FlowError);
    expect(() => flowTransition({ screen: "running", ...run }, { type: "start" })).toThrow(FlowError);
    expect(() => flowTransition({ screen: "title" }, { type: "loaded" })).toThrow(FlowError);
    expect(() => flowTransition({ screen: "boot" }, { type: "show-results" })).toThrow(FlowError);
  });

  it("resume after reload never reopens a half-open draft", () => {
    expect(resumeFlow({ screen: "draft-paused", ...run }).screen).toBe("running");
    expect(resumeFlow({ screen: "boss-intro", ...run }).screen).toBe("running");
    expect(resumeFlow({ screen: "loading", ...run }).screen).toBe("title");
    expect(resumeFlow({ screen: "results", ...run, outcome: "victory", settled: false })).toMatchObject({ screen: "results", settled: false });
  });
});
