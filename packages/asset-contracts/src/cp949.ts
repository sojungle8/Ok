/**
 * Strict CP949 (Windows-949 / Unified Hangul Code) codec backed by the fixed official
 * Microsoft table published by Unicode (cp949-table.generated.ts, 17,048 double-byte
 * mappings, source SHA-256 verified at generation time). No host TextDecoder is used, so
 * results are identical on every platform.
 *
 * - 0x00-0x7F: ASCII identity.
 * - 0x80, 0xFF: undefined -> throw.
 * - 0x81-0xFE: lead byte; the pair must exist in the official table, otherwise throw.
 *   Machine-local EUDC rows (C9A1-C9FE, FEA1-FEFE) are not in the table and are rejected.
 */
import { CP949_DBCS_HEX } from "./cp949-table.generated.ts";

interface Tables {
  decode: Map<number, number>;
  encode: Map<number, number>;
  pairs: [number, number][];
}
let tables: Tables | undefined;

function buildTables(): Tables {
  if (tables) return tables;
  const decode = new Map<number, number>();
  const encode = new Map<number, number>();
  const pairs: [number, number][] = [];
  for (const chunk of CP949_DBCS_HEX) {
    for (let i = 0; i < chunk.length; i += 8) {
      const code = Number.parseInt(chunk.slice(i, i + 4), 16);
      const uni = Number.parseInt(chunk.slice(i + 4, i + 8), 16);
      if (decode.has(code) || encode.has(uni)) throw new Error(`CP949 table has a duplicate entry at 0x${code.toString(16)}`);
      decode.set(code, uni);
      encode.set(uni, code);
      pairs.push([code, uni]);
    }
  }
  tables = { decode, encode, pairs };
  return tables;
}

/** Double-byte [code, unicode] pairs in source order (for golden tests). */
export function cp949DbcsPairs(): readonly (readonly [number, number])[] {
  return buildTables().pairs;
}

export function decodeCp949(bytes: Uint8Array): string {
  const { decode } = buildTables();
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) {
    const b = bytes[i] as number;
    if (b < 0x80) {
      out += String.fromCharCode(b);
      continue;
    }
    if (b === 0x80 || b === 0xff) throw new Error(`CP949: invalid byte 0x${b.toString(16).toUpperCase()} at ${i}`);
    const t = bytes[i + 1];
    if (t === undefined) throw new Error(`CP949: incomplete sequence at ${i}`);
    const code = (b << 8) | t;
    const uni = decode.get(code);
    if (uni === undefined) throw new Error(`CP949: unmapped sequence 0x${code.toString(16).toUpperCase()} at ${i}`);
    out += String.fromCharCode(uni);
    i += 1;
  }
  return out;
}

export function encodeCp949(text: string): Uint8Array {
  const { encode } = buildTables();
  const out: number[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0) as number;
    if (cp < 0x80) {
      out.push(cp);
      continue;
    }
    const code = encode.get(cp);
    if (code === undefined) throw new Error(`CP949: character U+${cp.toString(16).toUpperCase()} is not encodable`);
    out.push(code >> 8, code & 0xff);
  }
  return Uint8Array.from(out);
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || !/^[0-9A-Fa-f]*$/u.test(hex)) throw new Error("invalid hex string");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += b.toString(16).toUpperCase().padStart(2, "0");
  return s;
}
