import { describe, expect, it } from "vitest";
import { hashState } from "../src/index.ts";

describe("hashState", () => {
  it("is key-order independent and 16 hex chars", () => {
    const h = hashState({ a: 1, b: [2, "x"] });
    expect(h).toMatch(/^[0-9a-f]{16}$/u);
    expect(hashState({ b: [2, "x"], a: 1 })).toBe(h);
  });
  it("distinguishes values", () => {
    expect(hashState({ a: 1 })).not.toBe(hashState({ a: 2 }));
    expect(hashState(["1"])).not.toBe(hashState([1]));
  });
  it("rejects floats so hashes cannot drift", () => {
    expect(() => hashState({ x: 0.1 })).toThrow(/safe integers/u);
  });
});
