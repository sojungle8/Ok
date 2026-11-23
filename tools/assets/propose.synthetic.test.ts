import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AssetWhitelist, checkWhitelistRoundTrips, encodeCp949 } from "@ro-survivor/asset-contracts";
import { openGrf } from "@ro-survivor/ro-format-runtime/grf";
import { writeAct, writeGrf, writeWav, syntheticBytes } from "@ro-survivor/testkit";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { propose, rowsToCsv, validateCandidates, type CandidateFile } from "./propose-lib.ts";

const root = resolve(import.meta.dirname, "../..");
const mage = JSON.parse(readFileSync(resolve(root, "tools/assets/candidates/mage.json"), "utf8")) as CandidateFile;
const whitelist = AssetWhitelist.fromCsv(readFileSync(resolve(root, "docs/product-plan/handoff/fan-local-asset-whitelist.csv"), "utf8"));

function archive(entries: [string, Uint8Array][]): string {
  const dir = mkdtempSync(join(tmpdir(), "propose-"));
  const path = join(dir, "a.grf");
  writeFileSync(path, writeGrf(entries.map(([name, data]) => ({ rawName: encodeCp949(name), data }))));
  return path;
}

describe("whitelist proposal (synthetic GRF)", () => {
  it("the Mage candidate file is well formed and adds only new IDs", () => {
    expect(validateCandidates(mage, new Set(whitelist.rows().map((r) => r.asset_id)))).toEqual([]);
    expect(mage.candidates.length).toBeGreaterThanOrEqual(20);
  });

  it("rejects duplicates, existing IDs, non-archive paths and bad patterns", () => {
    const bad: CandidateFile = {
      job: "x", description: "", discover: [{ label: "b", pattern: "(" }],
      candidates: [
        { asset_id: "player.swordsman.male.body.spr", category: "player_body", canonical_cp949_path: "data\\a.spr", notes: "n" },
        { asset_id: "x.y", category: "c", canonical_cp949_path: "C:\\evil", notes: "n" },
        { asset_id: "x.y", category: "c", canonical_cp949_path: "data\\..\\b", notes: "" },
      ],
    };
    expect(validateCandidates(bad, new Set(whitelist.rows().map((r) => r.asset_id))).join("\n")).toMatch(/already in the canonical[\s\S]*data\\ archive path[\s\S]*duplicate[\s\S]*notes required[\s\S]*invalid pattern/u);
  });

  it("resolves case-insensitively, hashes the exact entry, flags rdata overrides, reports missing and discovers names", () => {
    const body = "data\\sprite\\인간족\\몸통\\남\\마법사_남.act";
    const act = writeAct({ version: "2.5", actions: [{ frames: [{ layers: [] }] }, { frames: [{ layers: [] }] }] });
    const wav = writeWav(syntheticBytes(3, 64));
    const dataPath = archive([[body.replace("data", "Data"), act], ["data\\wav\\effect\\ef_firebolt.wav", wav], ["data\\wav\\effect\\ef_bash.wav", wav]]);
    const rdataPath = archive([["data\\wav\\effect\\ef_firebolt.wav", wav]]);
    const data = openGrf(dataPath);
    const rdata = openGrf(rdataPath);
    try {
      const file: CandidateFile = {
        job: "t", description: "",
        candidates: [
          { asset_id: "player.mage.male.body.act", category: "player_body", canonical_cp949_path: body, notes: "body" },
          { asset_id: "audio.skill.mg.firebolt", category: "skill_sound", canonical_cp949_path: "data\\wav\\effect\\ef_firebolt.wav", notes: "wav" },
          { asset_id: "ui.skill.mg_firebolt.icon", category: "ui_skill_icon", canonical_cp949_path: "data\\texture\\x\\mg_firebolt.bmp", notes: "icon" },
        ],
        discover: [{ label: "wav", pattern: "^data\\\\wav\\\\.*fire" }],
      };
      const r = propose({ "data.grf": data, "rdata.grf": rdata }, file);
      expect(r.rows.map((x) => x.row.asset_id)).toEqual(["player.mage.male.body.act", "audio.skill.mg.firebolt"]);
      const [bodyRow, wavRow] = r.rows;
      expect(bodyRow?.row).toMatchObject({ canonical_cp949_path: "Data\\sprite\\인간족\\몸통\\남\\마법사_남.act", bytes: String(act.length), act_version: "2.5", act_actions: "2", rdata_override: "false" });
      expect(bodyRow?.row.sha256).toMatch(/^[0-9A-F]{64}$/u);
      expect(bodyRow?.row.notes).toMatch(/^PROPOSED/u);
      expect(wavRow?.overriddenByRdata).toBe(true);
      expect(r.missing).toEqual([{ asset_id: "ui.skill.mg_firebolt.icon", canonical_cp949_path: "data\\texture\\x\\mg_firebolt.bmp", reason: "not found in data.grf" }]);
      expect(r.discovered.wav).toEqual(["data\\wav\\effect\\ef_firebolt.wav"]);
      const csv = rowsToCsv(r.rows);
      const parsed = AssetWhitelist.fromCsv(csv);
      expect(checkWhitelistRoundTrips(parsed)).toEqual([]);
    } finally {
      data.close();
      rdata.close();
    }
  });
});
