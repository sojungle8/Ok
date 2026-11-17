import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Minimal dotenv reader for `.env.local` (never committed). Real process env wins.
 * Values are never logged by callers; only variable names are reported.
 */
export function parseDotenv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export function loadLocalEnv(root: string, env: NodeJS.ProcessEnv = process.env): Record<string, string | undefined> {
  const file = join(root, ".env.local");
  const fromFile = existsSync(file) ? parseDotenv(readFileSync(file, "utf8")) : {};
  return { ...fromFile, ...env };
}
