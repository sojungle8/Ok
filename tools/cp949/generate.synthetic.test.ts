import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { cp949DbcsPairs } from "@ro-survivor/asset-contracts";
import { parseVerifiedCp949, renderTableModule } from "./generate-lib.ts";

describe("CP949 table generator (offline)", () => {
  it("refuses a source whose SHA-256 is not the official one, before parsing", () => {
    const fake = new TextEncoder().encode("0x00\t0x0000\t#NULL\n");
    expect(() => parseVerifiedCp949(fake)).toThrow(/SHA-256 mismatch/u);
  });

  it("the committed table module is exactly the generator's deterministic output", () => {
    const committed = readFileSync(resolve(import.meta.dirname, "../../packages/asset-contracts/src/cp949-table.generated.ts"), "utf8");
    const pairs = cp949DbcsPairs().map(([c, u]) => [c, u] as [number, number]);
    expect(renderTableModule({ pairs })).toBe(committed);
  });
});
