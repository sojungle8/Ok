// Maintenance command only (pnpm maint:cp949-generate). Never run by build, test, ci:local or CI.
//   pnpm maint:cp949-generate                  # download from unicode.org, verify, write table
//   pnpm maint:cp949-generate --source <file>  # use a local copy instead (still verified)
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { CP949_SOURCE_URL, parseVerifiedCp949, renderTableModule } from "./generate-lib.ts";

const root = resolve(import.meta.dirname, "../..");
const out = resolve(root, "packages/asset-contracts/src/cp949-table.generated.ts");
const args = process.argv.slice(2);
const srcIdx = args.indexOf("--source");

let source: Uint8Array;
if (srcIdx >= 0) {
  const p = args[srcIdx + 1];
  if (!p) throw new Error("--source needs a path");
  source = readFileSync(p);
} else {
  console.log(`downloading ${CP949_SOURCE_URL}`);
  const res = await fetch(CP949_SOURCE_URL);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  source = new Uint8Array(await res.arrayBuffer());
}

const table = parseVerifiedCp949(source); // throws before anything is written
writeFileSync(out, renderTableModule(table));
console.log(`wrote ${out} (${table.pairs.length} double-byte mappings, source and stream SHA-256 verified)`);
