/**
 * Rules for rights:check. Path rules apply to every path we can see (index, untracked,
 * Git history, dist). Content rules apply wherever bytes are available.
 */
export type FindingCode =
  | "blocked-extension"
  | "blocked-audio"
  | "secret-or-local-config"
  | "credentials-file"
  | "ro-magic"
  | "audio-magic"
  | "large-unknown-binary";

export interface Finding {
  where: "index" | "untracked" | "worktree" | "history" | "dist";
  path: string;
  code: FindingCode;
  detail: string;
}

/** RO client containers / formats (docs/product-plan/02 .gitignore list + palette + effect). */
export const BLOCKED_RO_EXTENSIONS = [
  ".grf", ".gpf", ".rgz", ".thor",
  ".spr", ".act", ".rsm", ".rsm2", ".gnd", ".gat", ".rsw", ".str", ".pal", ".imf",
] as const;

/** Raw audio is treated as RO-origin until a manifest proves otherwise. */
export const BLOCKED_AUDIO_EXTENSIONS = [".wav", ".mp3", ".ogg", ".bgm", ".flac", ".m4a"] as const;

export const DEFAULT_MAX_UNKNOWN_BINARY_BYTES = 512 * 1024;

function lowerExt(path: string): string {
  const base = path.split(/[\\/]/u).pop() ?? path;
  const dot = base.lastIndexOf(".");
  return dot <= 0 ? "" : base.slice(dot).toLowerCase();
}

export function basenameOf(path: string): string {
  return path.split(/[\\/]/u).pop() ?? path;
}

export function checkPath(path: string): { code: FindingCode; detail: string } | null {
  const ext = lowerExt(path);
  const base = basenameOf(path);
  const lowerBase = base.toLowerCase();
  if ((BLOCKED_RO_EXTENSIONS as readonly string[]).includes(ext)) {
    return { code: "blocked-extension", detail: `RO client format ${ext}` };
  }
  if ((BLOCKED_AUDIO_EXTENSIONS as readonly string[]).includes(ext)) {
    return { code: "blocked-audio", detail: `raw audio ${ext}` };
  }
  const dataLike = ["", ".txt", ".json", ".csv", ".ini", ".cfg", ".conf", ".yml", ".yaml", ".xml", ".md"].includes(ext);
  if (base.includes("登入資料") || (dataLike && /(^|[._-])(credentials?|passwords?|secrets?)([._-]|$)/iu.test(base))) {
    return { code: "credentials-file", detail: "credentials / login data file" };
  }
  if (lowerBase === ".env" || (lowerBase.startsWith(".env.") && lowerBase !== ".env.example")) {
    return { code: "secret-or-local-config", detail: "environment file with real values" };
  }
  if (
    lowerBase === "source-lock.local.json" ||
    lowerBase === "local-asset-lock.json" ||
    [".pem", ".key", ".p12", ".pfx"].includes(ext) ||
    /^id_(rsa|ed25519|ecdsa|dsa)$/u.test(lowerBase)
  ) {
    return { code: "secret-or-local-config", detail: "private key or local lock with absolute paths" };
  }
  if (path.split(/[\\/]/u).some((seg) => seg === ".local-assets" || seg === "local-assets" || seg === "asset-cache")) {
    return { code: "blocked-extension", detail: "derived local asset cache directory" };
  }
  return null;
}

function startsWith(bytes: Uint8Array, ascii: string, offset = 0): boolean {
  if (bytes.length < offset + ascii.length) return false;
  for (let i = 0; i < ascii.length; i += 1) if (bytes[offset + i] !== ascii.charCodeAt(i)) return false;
  return true;
}

export function isBinary(bytes: Uint8Array): boolean {
  const n = Math.min(bytes.length, 8000);
  for (let i = 0; i < n; i += 1) if (bytes[i] === 0) return true;
  return false;
}

/** Detect RO formats and raw audio by magic, so renamed files are still caught. */
export function checkContent(bytes: Uint8Array): { code: FindingCode; detail: string } | null {
  if (startsWith(bytes, "Master of Magic")) return { code: "ro-magic", detail: "GRF archive magic" };
  for (const m of ["GRSW", "GRGN", "GRAT", "GRSM", "GRSG", "STRM"]) {
    if (startsWith(bytes, m)) return { code: "ro-magic", detail: `${m} magic` };
  }
  // SPR: "SP" + minor + major (major 1 or 2); ACT: "AC" + minor + major (major 2).
  if (bytes.length >= 6 && startsWith(bytes, "SP") && (bytes[3] === 1 || bytes[3] === 2) && (bytes[2] ?? 0) <= 9 && isBinary(bytes)) {
    return { code: "ro-magic", detail: "SPR magic" };
  }
  if (bytes.length >= 6 && startsWith(bytes, "AC") && bytes[3] === 2 && (bytes[2] ?? 0) <= 9 && isBinary(bytes)) {
    return { code: "ro-magic", detail: "ACT magic" };
  }
  if (startsWith(bytes, "RIFF") && startsWith(bytes, "WAVE", 8)) return { code: "audio-magic", detail: "WAV audio" };
  if (startsWith(bytes, "ID3")) return { code: "audio-magic", detail: "MP3 (ID3) audio" };
  if (startsWith(bytes, "OggS")) return { code: "audio-magic", detail: "Ogg audio" };
  if (startsWith(bytes, "fLaC")) return { code: "audio-magic", detail: "FLAC audio" };
  if (bytes.length >= 4 && bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0 && ((bytes[1] ?? 0) & 0x06) !== 0 && isBinary(bytes)) {
    // MPEG audio frame sync without ID3 header; only flag when the frame header is plausible.
    const bitrateIdx = (bytes[2] ?? 0) >> 4;
    const srIdx = ((bytes[2] ?? 0) >> 2) & 0x3;
    if (bitrateIdx !== 0 && bitrateIdx !== 0xf && srIdx !== 3) return { code: "audio-magic", detail: "MPEG audio frame" };
  }
  return null;
}
