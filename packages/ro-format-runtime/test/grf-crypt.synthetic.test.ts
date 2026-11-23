import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { bytesToHex, encodeCp949 } from "@ro-survivor/asset-contracts";
import { createTempDir, encryptGrfEntry, syntheticBytes, writeGrf, type GrfEntrySpec } from "@ro-survivor/testkit";
import { decryptEntry, desBlock, mixCycle, SHUFFLE_PAIRS } from "../src/grf-crypt.ts";
import { GRF_HEADER_SIZE, openGrf, type GrfArchive, type GrfEntry } from "../src/grf.ts";

/**
 * SYNTHETIC GRF 0x200 entry-encryption tests. Ciphertext is produced by the independent test-side
 * encryptor in @ro-survivor/testkit (BigInt implementation, no import of the production decryptor);
 * fixed external golden vectors pin both sides. No real GRF data is used.
 */
const dirs: { dispose(): void }[] = [];
afterEach(() => {
  while (dirs.length) dirs.pop()?.dispose();
});
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex").toUpperCase();
const hex = (b: Uint8Array) => Buffer.from(b).toString("hex").toUpperCase();
const name = (i: number) => encodeCp949(`data\\synthetic\\entry${i}.bin`);

function archive(entries: GrfEntrySpec[], options?: Parameters<typeof openGrf>[1]): { grf: GrfArchive; path: string; get: (i: number) => GrfEntry } {
  const d = createTempDir("grf-crypt-");
  dirs.push(d);
  const path = join(d.root, "synthetic.grf");
  writeFileSync(path, writeGrf(entries));
  const grf = openGrf(path, options);
  dirs.push({ dispose: () => grf.close() });
  return { grf, path, get: (i: number) => grf.byRawHex.get(bytesToHex(name(i))) as GrfEntry };
}

describe("golden vectors (fixed, external)", () => {
  it("one block: 0001020304050607 -> 0405071741145252 (and the transform is an involution)", () => {
    const b = Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7]);
    desBlock(b, 0);
    expect(hex(b)).toBe("0405071741145252");
    desBlock(b, 0);
    expect(hex(b)).toBe("0001020304050607");
    expect(hex(encryptGrfEntry(Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7]), "header", 8))).toBe("0405071741145252");
  });
  it("nontrivial fixed block: 0b30557a9fc4e90e -> 4b65147bcf95f91e on both sides (pins every S-box row used)", () => {
    const plain = Uint8Array.from(Buffer.from("0b30557a9fc4e90e", "hex"));
    const p = Uint8Array.from(plain);
    desBlock(p, 0);
    expect(hex(p)).toBe("4B65147BCF95F91E");
    expect(hex(encryptGrfEntry(plain, "header", 8))).toBe("4B65147BCF95F91E");
    expect(hex(decryptEntry(Uint8Array.from(Buffer.from("4b65147bcf95f91e", "hex")), "header", 8))).toBe("0B30557A9FC4E90E");
  });
  it("test-side and production DES agree on every block of a large varied buffer", () => {
    // independent cross-check of the two S-box transcriptions on many inputs (not only fixed vectors)
    const buf = Uint8Array.from({ length: 4096 * 8 }, (_, i) => (i * 167 + (i >> 3) * 59 + ((i * i) >> 5)) & 0xff);
    const prod = Uint8Array.from(buf);
    for (let b = 0; b < 4096; b += 1) desBlock(prod, b * 8);
    let kit = "";
    for (let b = 0; b < 4096; b += 1) kit += hex(encryptGrfEntry(buf.subarray(b * 8, b * 8 + 8), "header", 8));
    expect(kit).toBe(hex(prod));
  });
  it("MIXCRYPT 320-byte i & 0xff with compressedSize 100", () => {
    const a = Uint8Array.from({ length: 320 }, (_, i) => i & 0xff);
    expect(sha(decryptEntry(a, "mixcrypt", 100))).toBe("CDCDD2DE6B67F99FA4A3443236DE4336A1FAC57AEFBB735E932B84E2864CBD51");
    expect([...a]).toEqual(Array.from({ length: 320 }, (_, i) => i & 0xff)); // input untouched
  });
  it("HEADER 168-byte i & 0xff", () => {
    const a = Uint8Array.from({ length: 168 }, (_, i) => i & 0xff);
    expect(sha(decryptEntry(a, "header", 168))).toBe("291D5CBD55F15EBDD8BB5A32F2EE51A254A812F475F26420F5011017D7793ABB");
  });
});

describe("MIXCRYPT schedule", () => {
  it.each([
    [5, 1], [99, 1], [100, 4], [9999, 5], [10000, 14], [999999, 15], [1000000, 22], [10000000, 23], [123456789, 24],
  ])("compressedSize %i -> cycle %i", (size, cycle) => {
    expect(mixCycle(size)).toBe(cycle);
  });
  it("cross round-trips every cycle branch (1, 4, 5, 14, 15, 22+) with at least one shuffle block", () => {
    for (const csize of [50, 99, 100, 1000, 9999, 10000, 100000, 999999, 1000000, 10000000]) {
      const cycle = mixCycle(csize);
      const blocks = 20 + cycle * 9 + 8; // enough plain blocks to reach the 7th (shuffled) one
      const plain = Uint8Array.from({ length: blocks * 8 }, (_, i) => (i * 37 + csize) & 0xff);
      const ct = encryptGrfEntry(plain, "mixcrypt", csize);
      expect(hex(decryptEntry(ct, "mixcrypt", csize)), String(csize)).toBe(hex(plain));
    }
  });
  it("fewer than, exactly and more than 20 blocks (both modes)", () => {
    for (const blocks of [1, 19, 20, 21, 40]) {
      for (const mode of ["mixcrypt", "header"] as const) {
        const plain = syntheticBytes(blocks, blocks * 8);
        expect(hex(decryptEntry(encryptGrfEntry(plain, mode, blocks * 8), mode, blocks * 8)), `${mode} ${blocks}`).toBe(hex(plain));
      }
    }
    // header mode leaves every block after the 20th as plaintext
    const plain = syntheticBytes(7, 30 * 8);
    const ct = encryptGrfEntry(plain, "header", 240);
    expect(hex(ct.subarray(160))).toBe(hex(plain.subarray(160)));
    expect(hex(ct.subarray(0, 160))).not.toBe(hex(plain.subarray(0, 160)));
  });
  it("the shuffle block: exact byte order, DES blocks do not advance the shuffle counter", () => {
    // compressedSize 100 -> cycle 4: DES at 20, 24, 28, 32, 36; plain 21, 22, 23, 25, 26, 27, 29, 30 → the 7th
    // plain block after the 0th is block 30 (counter 7), which is de-shuffled
    const buf = new Uint8Array(40 * 8);
    buf.set([10, 11, 12, 13, 14, 15, 16, 0x41], 30 * 8);
    buf.set([1, 2, 3, 4, 5, 6, 7, 0x00], 29 * 8); // counter 6: plain, untouched
    const out = decryptEntry(buf, "mixcrypt", 100);
    expect([...out.subarray(30 * 8, 31 * 8)]).toEqual([13, 14, 16, 10, 11, 12, 15, 0x41]);
    expect([...out.subarray(29 * 8, 30 * 8)]).toEqual([1, 2, 3, 4, 5, 6, 7, 0x00]);
  });
  it("every shuffle substitution pair, both directions, and identity elsewhere", () => {
    expect(SHUFFLE_PAIRS).toHaveLength(7);
    const check = (from: number, to: number) => {
      const buf = new Uint8Array(40 * 8);
      buf[30 * 8 + 7] = from;
      expect(decryptEntry(buf, "mixcrypt", 100)[30 * 8 + 7], `0x${from.toString(16)}`).toBe(to);
    };
    for (const [a, b] of SHUFFLE_PAIRS) {
      check(a, b);
      check(b, a);
    }
    check(0x42, 0x42);
    check(0x7f, 0x7f);
  });
});

describe("GRF archive with encrypted entries", () => {
  it("exact 0x01 / 0x03 / 0x05 multi-entry round-trip (deflated and stored)", () => {
    const datas = [syntheticBytes(1, 5000), syntheticBytes(2, 12345), syntheticBytes(3, 333), syntheticBytes(4, 64), syntheticBytes(5, 100000), syntheticBytes(6, 9)];
    const flags = [0x01, 0x03, 0x05, 0x03, 0x03, 0x05];
    const { grf, get } = archive(datas.map((data, i) => ({ rawName: name(i), data, flags: flags[i] as number, store: i % 2 === 1 })));
    datas.forEach((data, i) => {
      expect(hex(grf.read(get(i))), String(i)).toBe(hex(data));
    });
  });
  it("padding 0–7 for every flag; the next entry's offset advances by the aligned size", () => {
    const specs: GrfEntrySpec[] = [];
    const datas: Uint8Array[] = [];
    for (let pad = 0; pad < 8; pad += 1) {
      for (const flags of [0x03, 0x05]) {
        const data = syntheticBytes(100 + pad * 2 + flags, 64 + ((8 - pad) % 8));
        datas.push(data);
        specs.push({ rawName: name(datas.length - 1), data, flags, store: true, pad: 0xa5 });
      }
    }
    const { grf, get } = archive(specs);
    let offset = 0;
    datas.forEach((data, i) => {
      const e = get(i);
      expect(e.offset, String(i)).toBe(offset);
      expect(e.alignedSize - e.compressedSize).toBe((8 - (data.length % 8)) % 8);
      expect(hex(grf.read(e)), String(i)).toBe(hex(data));
      offset += e.alignedSize;
    });
  });
  it("representative real-shaped entries (ACT 0x05, SPR / BMP / PAL / RSM / JPG / WAV 0x03) round-trip", () => {
    const kinds = ["act", "spr", "bmp", "pal", "rsm", "jpg", "wav"];
    const datas = kinds.map((_, i) => syntheticBytes(50 + i, 3000 + i * 1111));
    const { grf, get } = archive(datas.map((data, i) => ({ rawName: name(i), data, flags: kinds[i] === "act" ? 0x05 : 0x03 })));
    datas.forEach((data, i) => {
      expect(hex(grf.read(get(i))), kinds[i]).toBe(hex(data));
    });
  });
});

describe("malformed / hostile entries fail closed with context", () => {
  const one = (spec: Partial<GrfEntrySpec>, options?: Parameters<typeof openGrf>[1]) => {
    const a = archive([{ rawName: name(0), data: syntheticBytes(9, 4000), flags: 0x03, ...spec }, { rawName: name(1), data: syntheticBytes(8, 50) }], options);
    return () => a.grf.read(a.get(0));
  };
  it.each([0x07, 0x09, 0x0b, 0x11, 0x81, 0xff])("flags 0x%s are refused at read [flags]", (flags) => {
    expect(one({ override: { flags } })).toThrow(/\[flags\]/u);
  });
  it("entries without the FILE bit are not readable entries at all", () => {
    const a = archive([{ rawName: name(0), data: syntheticBytes(9, 40), override: { flags: 0x02 } }, { rawName: name(1), data: syntheticBytes(8, 50) }]);
    expect(a.get(0)).toBeUndefined();
  });
  it("encrypted size rules: compressed > aligned, non-8 alignment, wrong padding span; plain aligned != compressed", () => {
    expect(one({ store: true, override: { alignedSize: 3992 } })).toThrow(/compressed size 4000 > aligned size 3992 \[?|\[size\]/u);
    expect(one({ store: true, data: syntheticBytes(9, 4001), override: { alignedSize: 4001 } })).toThrow(/not a multiple of 8/u);
    expect(one({ store: true, data: syntheticBytes(9, 4001), override: { alignedSize: 4016 } })).toThrow(/!= ceil/u);
    expect(one({ flags: 0x01, store: true, override: { alignedSize: 4008 } })).toThrow(/plain entry aligned size/u);
  });
  it("data past the end of the archive fails [bounds]", () => {
    expect(one({ override: { offset: 1_000_000 } })).toThrow(/\[bounds\].*past the end/u);
  });
  describe("entry spans relative to the file table (real patched archives store data after the table)", () => {
    const d0 = Uint8Array.from({ length: 3000 }, (_, i) => (i * 13) % 251);
    const d1 = syntheticBytes(8, 50);
    /** Build with entry 0 relocated to `relocate(L, tableOffset)` (offsets are fixed-width: layout stable). */
    /** `appendBlob`: append entry 0's blob after the table (true), only its first N bytes (number), or nothing. */
    const build = (relocate: (len: number, tableOffset: number) => number, appendBlob: boolean | number) => {
      const specs = (offset?: number): GrfEntrySpec[] => [
        { rawName: name(0), data: d0, flags: 0x03, ...(offset === undefined ? {} : { override: { offset } }) },
        { rawName: name(1), data: d1 },
      ];
      const g0 = writeGrf(specs());
      const tableOffset = new DataView(g0.buffer, g0.byteOffset).getUint32(30, true);
      const blob = g0.subarray(46, 46 + Math.ceil(deflatedLength(g0) / 8) * 8);
      const g1 = writeGrf(specs(relocate(g0.length, tableOffset)));
      const tail = appendBlob === true ? blob : typeof appendBlob === "number" ? blob.subarray(0, appendBlob) : new Uint8Array(0);
      const bytes = Uint8Array.from([...g1, ...tail]);
      const dir = createTempDir("grf-span-");
      dirs.push(dir);
      const path = join(dir.root, "span.grf");
      writeFileSync(path, bytes);
      const grf = openGrf(path);
      dirs.push({ dispose: () => grf.close() });
      return { grf, e0: grf.byRawHex.get(bytesToHex(name(0))) as GrfEntry, tableOffset };
    };
    /** compressedSize of entry 0, read back from the table of a plain build. */
    function deflatedLength(g: Uint8Array): number {
      const dir = createTempDir("grf-len-");
      dirs.push(dir);
      const path = join(dir.root, "len.grf");
      writeFileSync(path, g);
      const grf = openGrf(path);
      const n = (grf.byRawHex.get(bytesToHex(name(0))) as GrfEntry).compressedSize;
      grf.close();
      return n;
    }
    it("data stored after the table reads (PASS)", () => {
      const { grf, e0, tableOffset } = build((len) => len - 46, true);
      expect(e0.offset).toBeGreaterThan(tableOffset); // entry 0 now lives after the file table
      expect(hex(grf.read(e0))).toBe(hex(d0));
    });
    it("data overlapping the file table fails [bounds]", () => {
      const { grf, e0 } = build((_len, tableOffset) => tableOffset, false);
      expect(() => grf.read(e0)).toThrow(/\[bounds\].*overlaps the file table/u);
      const { grf: g2, e0: e2 } = build((_len, tableOffset) => tableOffset - 8, false);
      expect(() => g2.read(e2)).toThrow(/\[bounds\].*overlaps the file table/u);
    });
    it("data after the table that runs past EOF fails [bounds]", () => {
      // starts right after the table (no overlap) but only part of its aligned span exists
      const { grf, e0, tableOffset } = build((len) => len - 46, 8);
      expect(e0.offset).toBeGreaterThan(tableOffset);
      expect(() => grf.read(e0)).toThrow(/\[bounds\].*past the end/u);
    });
    it("data can never start inside the header (offsets are unsigned)", () => {
      const { grf, e0 } = build(() => 0, false);
      expect(GRF_HEADER_SIZE + e0.offset).toBeGreaterThanOrEqual(GRF_HEADER_SIZE);
      expect(hex(grf.read(e0))).toBe(hex(d0)); // offset 0 is the first data byte, right after the header
    });
  });
  it("corrupt compressed ciphertext fails at [inflate]; a wrong realSize fails at [inflate] or [length]", () => {
    // compressible data, so the entry really is deflated + encrypted (compressedSize < realSize)
    const compressible = Uint8Array.from({ length: 4000 }, (_, i) => i % 7);
    const a = archive([{ rawName: name(0), data: compressible, flags: 0x03 }, { rawName: name(1), data: syntheticBytes(8, 50) }]);
    expect(a.get(0).compressedSize).toBeLessThan(a.get(0).realSize);
    expect(one({ data: compressible, mutateBlob: (b) => b.map((x, i) => (i < 16 ? x ^ 0x5a : x)) })).toThrow(/\[inflate\]/u);
    expect(one({ data: compressible, override: { realSize: 4001 } })).toThrow(/\[length\]/u);
    expect(one({ data: compressible, override: { realSize: 3999 } })).toThrow(/\[inflate\]/u);
  });
  it("corruption of a stored (raw) entry is not detectable at the GRF layer — integrity is the whitelist SHA's job", () => {
    const data = syntheticBytes(9, 4000); // incompressible → stored: compressedSize === realSize
    const a = archive([{ rawName: name(0), data, flags: 0x03, mutateBlob: (b) => b.map((x, i) => (i === 3000 ? x ^ 0xff : x)) }, { rawName: name(1), data: syntheticBytes(8, 50) }]);
    expect(a.get(0).compressedSize).toBe(a.get(0).realSize);
    const out = a.grf.read(a.get(0));
    expect(out).toHaveLength(4000);
    expect(hex(out)).not.toBe(hex(data)); // bytes differ, no GRF-level error: the SHA-256 audit catches it
  });
  it("oversized packed / real sizes are refused before allocation [size]", () => {
    expect(one({}, { maxEntryBytes: 3000 })).toThrow(/real size 4000 exceeds 3000/u);
    expect(one({ store: true, data: syntheticBytes(9, 4000), override: { realSize: 100 } }, { maxEntryBytes: 1000 })).toThrow(/packed size .* exceeds 1000/u);
  });
  it("forged entries fail at [identity] — copies, plain objects, and after rewriting the exposed map", () => {
    const a = archive([{ rawName: name(0), data: syntheticBytes(9, 4000), flags: 0x03 }, { rawName: name(1), data: syntheticBytes(8, 50) }]);
    const real = a.get(0);
    expect(Object.isFrozen(real)).toBe(true);
    expect(() => {
      (real as { offset: number }).offset = 1;
    }).toThrow(TypeError);
    const forged: GrfEntry = { ...real, offset: a.get(1).offset };
    expect(() => a.grf.read(forged)).toThrow(/\[identity\]/u);
    // the exposed map is a Map at runtime: rewriting it does not make a forged entry readable
    (a.grf.byRawHex as Map<string, GrfEntry>).set(forged.rawHex, forged);
    expect(a.grf.byRawHex.get(forged.rawHex)).toBe(forged);
    expect(() => a.grf.read(forged)).toThrow(/\[identity\]/u);
    expect(() => a.grf.read(null as unknown as GrfEntry)).toThrow(/\[identity\]/u);
    // the genuine entry still reads
    expect(a.grf.read(real)).toHaveLength(4000);
  });
  it("the file table is bounded: declared real size enforced during inflate; packed size within the file", () => {
    const d = createTempDir("grf-table-");
    dirs.push(d);
    const p = join(d.root, "t.grf");
    const g = writeGrf([{ rawName: name(0), data: syntheticBytes(1, 2000) }, { rawName: name(1), data: syntheticBytes(2, 2000) }]);
    const tableAt = 46 + new DataView(g.buffer, g.byteOffset).getUint32(30, true);
    const smaller = Uint8Array.from(g);
    new DataView(smaller.buffer).setUint32(tableAt + 4, 8, true); // claims an 8-byte table: inflate must stop
    writeFileSync(p, smaller);
    expect(() => openGrf(p)).toThrow(/file table \[inflate\]|inflated to/u);
    const huge = Uint8Array.from(g);
    new DataView(huge.buffer).setUint32(tableAt, 0x7fffffff, true); // packed size beyond the file
    writeFileSync(p, huge);
    expect(() => openGrf(p)).toThrow(/packed file table/u);
    expect(readFileSync(p).length).toBe(huge.length);
  });
});

