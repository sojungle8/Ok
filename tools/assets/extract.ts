import { join, relative } from "node:path";
import { createAssetReader, derivedDirFor } from "@ro-survivor/asset-gateway";
import { writeJson } from "./verify-sources-lib.ts";
import { loadLocalContext, repoRoot } from "./local-context.ts";
import { runExtraction } from "./extract-run.ts";

const args = process.argv.slice(2);
const profile = args[args.indexOf("--profile") + 1];
if (!args.includes("--profile") || profile !== "fan-local") {
  console.error("usage: pnpm assets:extract --profile fan-local   (only the fan-local profile may read RO sources)");
  process.exit(2);
}
const { lock, whitelist } = loadLocalContext();
const reader = createAssetReader(lock);
try {
  const outDir = derivedDirFor(repoRoot, lock.sources["data.grf"].sha256);
  const manifest = runExtraction(whitelist.rows(), reader, outDir);
  for (const s of manifest.sprites) console.log(`sprite ${s.id}: ${s.composedFrames} frames, ${s.uniqueImages} images, ${s.mirrorDeduped} mirror-deduped, fallbacks=[${s.fallbacks.join(", ")}]`);
  if (manifest.map) console.log(`map prt_fild08: reachable ${manifest.map.flood.reachableFromSpawn}/${manifest.map.flood.walkable} walkable cells; deps textures=${manifest.map.dependencies.textures} models=${manifest.map.dependencies.models}`);
  writeJson(join(repoRoot, "reports/local/extract-summary.json"), { at: new Date().toISOString(), outDir: relative(repoRoot, outDir), ...manifest });
  console.log(`assets:extract wrote ${manifest.outputs.length} files to ${relative(repoRoot, outDir)} (git-ignored). Review contact-sheets/*.png, then run pnpm rights:check.`);
} finally {
  reader.close();
}
