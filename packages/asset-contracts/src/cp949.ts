/**
 * Strict CP949 (Windows-949 / Unified Hangul Code) codec.
 *
 * Why not TextDecoder("euc-kr")? Node's ICU converter only implements plain EUC-KR: it does
 * not know the UHC extension (e.g. 0x8C63 "똠") and, even with { fatal: true }, silently drops
 * an unknown lead byte. GRF lookups must never be lossy, so this module:
 *  - takes the KS X 1001 (lead/trail 0xA1-0xFE) table from the platform EUC-KR decoder, one
 *    pair at a time, and
 *  - derives the 8,822 UHC extension syllables algorithmically: every precomposed Hangul
 *    syllable missing from KS X 1001, in Unicode order, fills lead 0x81-0xA0 (trails
 *    41-5A, 61-7A, 81-FE) then lead 0xA1-0xC6 (trails 41-5A, 61-7A, 81-A0).
 * Decoding is strict: unknown sequences throw.
 */
interface Tables {
  decode: Map<number, string>;
  encode: Map<string, number>;
}
let tables: Tables | undefined;

function uhcTrails(lead: number): number[] {
  const out: number[] = [];
  for (let t = 0x41; t <= 0x5a; t += 1) out.push(t);
  for (let t = 0x61; t <= 0x7a; t += 1) out.push(t);
  const last = lead <= 0xa0 ? 0xfe : 0xa0;
  for (let t = 0x81; t <= last; t += 1) out.push(t);
  return out;
}

function buildTables(): Tables {
  if (tables) return tables;
  const decode = new Map<number, string>();
  const encode = new Map<string, number>();
  const decoder = new TextDecoder("euc-kr");
  const pair = new Uint8Array(2);
  for (let lead = 0xa1; lead <= 0xfe; lead += 1) {
    for (let trail = 0xa1; trail <= 0xfe; trail += 1) {
      pair[0] = lead;
      pair[1] = trail;
      const ch = decoder.decode(pair);
      if ([...ch].length !== 1 || ch === "�" || (ch.codePointAt(0) as number) < 0x80) continue;
      const code = (lead << 8) | trail;
      decode.set(code, ch);
      if (!encode.has(ch)) encode.set(ch, code);
    }
  }
  const missing: string[] = [];
  for (let cp = 0xac00; cp <= 0xd7a3; cp += 1) {
    const ch = String.fromCharCode(cp);
    if (!encode.has(ch)) missing.push(ch);
  }
  let i = 0;
  for (let lead = 0x81; lead <= 0xc6 && i < missing.length; lead += 1) {
    for (const trail of uhcTrails(lead)) {
      if (i >= missing.length) break;
      const ch = missing[i] as string;
      const code = (lead << 8) | trail;
      decode.set(code, ch);
      encode.set(ch, code);
      i += 1;
    }
  }
  if (missing.length !== 8822 || i !== 8822) {
    throw new Error(`CP949 table build failed: expected 8822 UHC syllables, got ${missing.length}/${i}`);
  }
  tables = { decode, encode };
  return tables;
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
    const t = bytes[i + 1];
    if (b < 0x81 || b > 0xfe || t === undefined) throw new Error(`CP949: invalid byte 0x${b.toString(16)} at ${i}`);
    const ch = decode.get((b << 8) | t);
    if (ch === undefined) throw new Error(`CP949: unmapped sequence 0x${((b << 8) | t).toString(16).toUpperCase()} at ${i}`);
    out += ch;
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
    const code = encode.get(ch);
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
