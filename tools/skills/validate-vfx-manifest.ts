import { resolve } from "node:path";
import { validateSkillVfxManifest } from "./vfx-manifest-lib.ts";

const result = validateSkillVfxManifest(resolve(import.meta.dirname, "../.."));
if (result.errors.length > 0) {
  for (const error of result.errors) console.error(`FAIL ${error}`);
  process.exitCode = 1;
} else {
  console.log(`PASS skill VFX manifest (${result.manifest?.entries.length ?? 0} approved entries)`);
}
