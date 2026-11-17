import { createHash } from "node:crypto";

/** Official Microsoft cp949 table published by Unicode, Inc. */
export const CP949_SOURCE_URL = "https://www.unicode.org/Public/MAPPINGS/VENDORS/MICSFT/WINDOWS/CP949.TXT";
export const CP949_SOURCE_SHA256 = "f57e6fef9d1ed44f445e319a8e1b879ce6b6064520ab571c341e47b892e32abc";
/** SHA-256 of the double-byte stream: per entry, CP949 code (u16 BE) then Unicode (u16 BE), in file order. */
export const CP949_DBCS_STREAM_SHA256 = "1ed8d8e4d8095248317a77a2976f4ec8e76e551b11caa1f7249476bf109961cd";
export const CP949_DBCS_COUNT = 17048;
export const GENERATOR_VERSION = 1;

export interface Cp949Table {
  /** [cp949Code, unicodeCodePoint] pairs, double-byte only, in source order. */
  pairs: [number, number][];
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function dbcsStream(pairs: readonly (readonly [number, number])[]): Uint8Array {
  const out = new Uint8Array(pairs.length * 4);
  pairs.forEach(([code, uni], i) => {
    out[i * 4] = code >> 8;
    out[i * 4 + 1] = code & 0xff;
    out[i * 4 + 2] = uni >> 8;
    out[i * 4 + 3] = uni & 0xff;
  });
  return out;
}

/**
 * Parse and verify the official CP949.TXT. Throws (and nothing may be written) unless the
 * source SHA-256, single-byte ASCII identity, double-byte count and stream hash all match.
 */
export function parseVerifiedCp949(source: Uint8Array): Cp949Table {
  const actual = sha256Hex(source);
  if (actual !== CP949_SOURCE_SHA256) {
    throw new Error(`CP949.TXT SHA-256 mismatch: expected ${CP949_SOURCE_SHA256}, got ${actual}`);
  }
  const text = new TextDecoder("ascii", { fatal: true }).decode(source);
  const pairs: [number, number][] = [];
  const singles = new Map<number, number>();
  for (const [n, line] of text.split(/\r?\n/u).entries()) {
    if (line === "" || line.startsWith("#")) continue;
    const m = /^0x([0-9A-F]{2}|[0-9A-F]{4})\t(?:0x([0-9A-F]{4}))?\s*\t#/u.exec(line);
    if (!m) throw new Error(`CP949.TXT line ${n + 1} is not Format A: ${JSON.stringify(line)}`);
    if (m[2] === undefined) continue;
    const code = Number.parseInt(m[1] as string, 16);
    const uni = Number.parseInt(m[2], 16);
    if ((m[1] as string).length === 2) singles.set(code, uni);
    else pairs.push([code, uni]);
  }
  for (let b = 0; b < 0x80; b += 1) {
    if (singles.get(b) !== b) throw new Error(`single byte 0x${b.toString(16)} is not ASCII identity`);
  }
  if (singles.size !== 0x80) throw new Error(`unexpected single-byte mappings: ${singles.size}`);
  if (pairs.length !== CP949_DBCS_COUNT) throw new Error(`expected ${CP949_DBCS_COUNT} double-byte mappings, got ${pairs.length}`);
  const stream = sha256Hex(dbcsStream(pairs));
  if (stream !== CP949_DBCS_STREAM_SHA256) throw new Error(`double-byte stream SHA-256 mismatch: ${stream}`);
  return { pairs };
}

/** Render the committed TypeScript table module (deterministic output). */
export function renderTableModule(table: Cp949Table): string {
  const hex = table.pairs.map(([c, u]) => c.toString(16).toUpperCase().padStart(4, "0") + u.toString(16).toUpperCase().padStart(4, "0"));
  const lines: string[] = [];
  for (let i = 0; i < hex.length; i += 16) lines.push(`  "${hex.slice(i, i + 16).join("")}",`);
  return `// GENERATED FILE — do not edit. Regenerate with: pnpm maint:cp949-generate
// Source: ${CP949_SOURCE_URL}
// Source SHA-256: ${CP949_SOURCE_SHA256}
// Copyright © 1991-2026 Unicode, Inc. Licensed under the Unicode License v3
// (see licenses/UNICODE-LICENSE-V3.txt). Transformed by tools/cp949/generate.ts v${GENERATOR_VERSION}:
// double-byte rows only, each entry is 8 hex digits = CP949 code (4) + Unicode BMP code point (4).
// Single bytes 0x00-0x7F are ASCII identity; 0x80 and 0xFF are undefined; lead bytes are 0x81-0xFE.

export const CP949_SOURCE_SHA256 = "${CP949_SOURCE_SHA256}";
export const CP949_DBCS_STREAM_SHA256 = "${CP949_DBCS_STREAM_SHA256}";
export const CP949_DBCS_COUNT = ${table.pairs.length};

export const CP949_DBCS_HEX: readonly string[] = [
${lines.join("\n")}
];
`;
}
