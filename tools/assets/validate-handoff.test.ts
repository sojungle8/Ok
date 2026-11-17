import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateHandoff } from "./validate-handoff-lib.ts";

describe("handoff package re-validation", () => {
  it("all content checks pass on this checkout", () => {
    const checks = validateHandoff(resolve(import.meta.dirname, "../.."));
    expect(checks.filter((c) => c.status === "FAIL")).toEqual([]);
    expect(checks.length).toBeGreaterThan(10);
  });
});
