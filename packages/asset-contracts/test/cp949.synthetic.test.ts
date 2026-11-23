import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  bytesToHex,
  CP949_DBCS_COUNT,
  CP949_DBCS_STREAM_SHA256,
  CP949_SOURCE_SHA256,
  cp949DbcsPairs,
  decodeCp949,
  encodeCp949,
} from "../src/index.ts";

function streamSha256(pairs: readonly (readonly [number, number])[]): string {
  const buf = Buffer.alloc(pairs.length * 4);
  pairs.forEach(([c, u], i) => {
    buf.writeUInt16BE(c, i * 4);
    buf.writeUInt16BE(u, i * 4 + 2);
  });
  return createHash("sha256").update(buf).digest("hex");
}

describe("CP949 fixed official mapping (golden)", () => {
  it("has exactly 17,048 double-byte mappings with the official stream hash", () => {
    const pairs = cp949DbcsPairs();
    expect(pairs).toHaveLength(17048);
    expect(CP949_DBCS_COUNT).toBe(17048);
    expect(CP949_SOURCE_SHA256).toBe("f57e6fef9d1ed44f445e319a8e1b879ce6b6064520ab571c341e47b892e32abc");
    expect(CP949_DBCS_STREAM_SHA256).toBe("1ed8d8e4d8095248317a77a2976f4ec8e76e551b11caa1f7249476bf109961cd");
    expect(streamSha256(pairs)).toBe(CP949_DBCS_STREAM_SHA256);
  });

  it("every table entry round-trips both ways", () => {
    for (const [code, uni] of cp949DbcsPairs()) {
      const bytes = Uint8Array.from([code >> 8, code & 0xff]);
      expect(decodeCp949(bytes).codePointAt(0)).toBe(uni);
      expect(bytesToHex(encodeCp949(String.fromCodePoint(uni)))).toBe(bytesToHex(bytes));
    }
  });

  it("supports A2E6 -> € and A2E7 -> ®", () => {
    expect(decodeCp949(Uint8Array.from([0xa2, 0xe6]))).toBe("€");
    expect(decodeCp949(Uint8Array.from([0xa2, 0xe7]))).toBe("®");
    expect(bytesToHex(encodeCp949("€®"))).toBe("A2E6A2E7");
  });

  it("maps known Hangul (KS X 1001 and UHC extension)", () => {
    expect(bytesToHex(encodeCp949("몬스터"))).toBe("B8F3BDBAC5CD");
    expect(bytesToHex(encodeCp949("갂"))).toBe("8141");
    expect(bytesToHex(encodeCp949("똠"))).toBe("8C63");
    expect(bytesToHex(encodeCp949("힝"))).toBe("C8FE");
    expect(bytesToHex(encodeCp949("힣"))).toBe("C652");
  });

  it("round-trips all 11,172 precomposed Hangul syllables", () => {
    let all = "";
    for (let cp = 0xac00; cp <= 0xd7a3; cp += 1) all += String.fromCharCode(cp);
    const bytes = encodeCp949(all);
    expect(bytes.length).toBe(11172 * 2);
    expect(decodeCp949(bytes)).toBe(all);
  });

  it("rejects all 188 machine-local EUDC codes (C9A1-C9FE, FEA1-FEFE)", () => {
    let rejected = 0;
    for (const lead of [0xc9, 0xfe]) {
      for (let t = 0xa1; t <= 0xfe; t += 1) {
        expect(() => decodeCp949(Uint8Array.from([lead, t]))).toThrow(/unmapped/u);
        rejected += 1;
      }
    }
    expect(rejected).toBe(188);
    expect(() => encodeCp949("")).toThrow(/not encodable/u);
  });

  it("throws on invalid and incomplete sequences (no silent byte loss)", () => {
    expect(() => decodeCp949(Uint8Array.from([0x80]))).toThrow(/invalid/u);
    expect(() => decodeCp949(Uint8Array.from([0xff]))).toThrow(/invalid/u);
    expect(() => decodeCp949(Uint8Array.from([0x8c]))).toThrow(/incomplete/u);
    expect(() => decodeCp949(Uint8Array.from([0x41, 0xb8]))).toThrow(/incomplete/u);
    expect(() => decodeCp949(Uint8Array.from([0xc6, 0x53]))).toThrow(/unmapped/u);
    expect(() => decodeCp949(Uint8Array.from([0x81, 0x20]))).toThrow(/unmapped/u);
    expect(() => encodeCp949("😀")).toThrow(/not encodable/u);
  });

  it("decodes ASCII as identity", () => {
    const ascii = Uint8Array.from(Array.from({ length: 128 }, (_, i) => i));
    expect(decodeCp949(ascii)).toBe(String.fromCharCode(...ascii));
  });
});
