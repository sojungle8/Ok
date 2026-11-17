import type { WhitelistRow } from "@ro-survivor/content-schema";
import type { AssetReader } from "@ro-survivor/asset-gateway";
import { parseAct, parseGat, parseGnd, parsePalette, parseRsw, parseSpr } from "@ro-survivor/ro-format-runtime";

export interface AuditRow {
  assetId: string;
  status: "PASS" | "FAIL";
  checks: string[];
}

const MAGIC: Record<string, string> = { spr: "SP", act: "AC", gat: "GRAT", gnd: "GRGN", rsw: "GRSW" };

/**
 * Audit every whitelist row against the verified sources: raw-hex lookup, bytes, SHA-256 when
 * listed, format magic, parser success, ACT version / action count, no undeclared rdata override.
 * Only whitelisted entries are looked up; nothing else in the archives is enumerated or extracted.
 */
export function auditWhitelist(rows: readonly WhitelistRow[], reader: AssetReader): AuditRow[] {
  return rows.map((row) => {
    const checks: string[] = [];
    let ok = true;
    const fail = (msg: string): void => {
      ok = false;
      checks.push(`FAIL ${msg}`);
    };
    try {
      const { bytes, entrySha256, container } = reader.read(row);
      checks.push(`PASS lookup ${container} raw-hex, ${bytes.length} bytes`);
      if (row.sha256 !== "") checks.push(`PASS sha256 ${entrySha256.slice(0, 16)}…`);
      if (row.source_container !== "filesystem:BGM" && row.rdata_override === "false" && reader.hasRdataOverride(row)) fail("rdata.grf has an undeclared same-name override");
      const ext = row.canonical_cp949_path.split(".").pop()?.toLowerCase() ?? "";
      const magic = MAGIC[ext];
      if (magic) {
        const got = String.fromCharCode(...bytes.subarray(0, magic.length));
        if (got === magic) checks.push(`PASS magic ${magic}`);
        else fail(`magic ${JSON.stringify(got)} != ${magic}`);
      }
      if (ext === "spr") {
        const s = parseSpr(bytes);
        checks.push(`PASS SPR ${s.version}: ${s.indexed.length} indexed, ${s.rgba.length} rgba, palette=${s.palette ? "yes" : "no"}`);
      } else if (ext === "act") {
        const a = parseAct(bytes);
        if (row.act_version !== "" && a.version !== row.act_version) fail(`ACT version ${a.version} != whitelist ${row.act_version}`);
        else if (row.act_actions !== "" && a.actions.length !== Number(row.act_actions)) fail(`ACT actions ${a.actions.length} != whitelist ${row.act_actions}`);
        else checks.push(`PASS ACT ${a.version}: ${a.actions.length} actions, ${a.sounds.length} sounds`);
        if (a.actions.length % 8 !== 0) fail(`ACT action count ${a.actions.length} is not a multiple of 8 directions`);
      } else if (ext === "pal") {
        parsePalette(bytes);
        checks.push("PASS PAL 1024 bytes");
      } else if (ext === "gat") {
        const g = parseGat(bytes);
        checks.push(`PASS GAT ${g.version}: ${g.width}x${g.height}`);
      } else if (ext === "gnd") {
        const g = parseGnd(bytes);
        checks.push(`PASS GND ${g.version}: ${g.width}x${g.height}, ${g.textures.length} textures, ${g.surfaces.length} surfaces`);
      } else if (ext === "rsw") {
        const r = parseRsw(bytes);
        checks.push(`PASS RSW ${r.version}: gnd=${r.gndFile} gat=${r.gatFile} models=${r.counts.models}`);
      } else if (ext === "mp3") {
        const id3 = bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33;
        const sync = bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0;
        if (id3 || sync) checks.push(`PASS MP3 ${id3 ? "ID3" : "frame sync"}`);
        else fail("MP3 header not recognised");
      }
    } catch (err) {
      fail(err instanceof Error ? err.message : String(err));
    }
    return { assetId: row.asset_id, status: ok ? "PASS" : "FAIL", checks };
  });
}
