import { resolve } from "node:path";
import { validateReferencePack } from "./validate-lib.ts";

const root = resolve(import.meta.dirname, "../..");
const result = validateReferencePack(root);
if (result.errors.length > 0) {
  for (const error of result.errors) console.error(`FAIL  ${error}`);
  process.exitCode = 1;
} else {
  console.log(`reference:validate PASS: snapshots=${result.stats.snapshots} ledger-segments=${result.stats.ledgerSegments} observations=${result.stats.observations} active=${result.stats.activeSnapshotId}`);
}
