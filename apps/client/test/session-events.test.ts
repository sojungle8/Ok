import { describe, expect, it } from "vitest";
import type { RunEvent } from "@ro-survivor/core-sim";
import { accumulateFrameEvents } from "../src/game/session.ts";

const event = (tick: number): RunEvent => ({ type: "boss-warning", tick });

describe("render-frame simulation event accumulator", () => {
  it("keeps events from every fixed step in order", () => {
    const state = { events: [] as RunEvent[] };
    accumulateFrameEvents(state, 3, (index) => {
      state.events = [event(index + 1)];
    });
    expect(state.events.map((e) => e.tick)).toEqual([1, 2, 3]);
  });

  it("clears stale events on a zero-step frame and stops after a terminal step", () => {
    const state = { events: [event(99)] };
    accumulateFrameEvents(state, 0, () => undefined);
    expect(state.events).toEqual([]);
    accumulateFrameEvents(state, 5, (index) => {
      state.events = [event(index + 1)];
      return index < 1;
    });
    expect(state.events.map((e) => e.tick)).toEqual([1, 2]);
  });
});
