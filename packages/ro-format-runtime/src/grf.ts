// Node-only: GRF 0x200 archive reader. Imported via "@ro-survivor/ro-format-runtime/grf".
import { closeSync, fstatSync, openSync, readSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { bytesToHex, decodeCp949 } from "@ro-survivor/asset-contracts";
import { FormatError } from "./binary.ts";
import { decryptEntry, type GrfCryptMode } from "./grf-crypt.ts";

export const GRF_HEADER_SIZE = 46;
const FLAG_FILE = 0x01;
/** The only entry flag values `read()` accepts: plain, FILE|MIXCRYPT, FILE|HEADER (DES on the first 20 blocks). */
const ENTRY_MODES: ReadonlyMap<number, GrfCryptMode | "plain"> = new Map([
  [0x01, "plain"],
  [0x03, "mixcrypt"],
  [0x05, "header"],
]);

export interface GrfEntry {
  /** Raw CP949 name bytes as uppercase hex (primary lookup key). */
  rawHex: string;
  name: string;
  compressedSize: number;
  alignedSize: number;
  realSize: number;
  flags: number;
  offset: number;
}
export interface GrfArchive {
  version: number;
  fileCount: number;
  size: number;
  byRawHex: ReadonlyMap<string, GrfEntry>;
  read(entry: GrfEntry): Uint8Array;
  close(): void;
}

/**
 * Open a GRF 0x200 archive read-only. Only the header and the file table are read eagerly; entry data
 * is read on demand by `read(entry)`, which accepts only archive-owned entries with flags exactly 0x01
 * (plain), 0x03 (FILE|MIXCRYPT) or 0x05 (FILE|HEADER). For encrypted entries the full aligned span is
 * read and decrypted, then exactly `compressedSize` bytes are kept (padding never reaches zlib).
 * `realSize === compressedSize` means stored bytes; otherwise the data is inflated with an output
 * limit of `realSize`. Every failure is a FormatError naming the entry, its flags and the stage.
 */
export function openGrf(path: string, options: { maxTableBytes?: number; maxEntryBytes?: number } = {}): GrfArchive {
  const fd = openSync(path, "r");
  try {
    const size = fstatSync(fd).size;
    const readAt = (offset: number, length: number): Uint8Array => {
      if (offset < 0 || length < 0 || offset + length > size) throw new FormatError("GRF", `read out of bounds at ${offset} (+${length})`);
      const buf = Buffer.alloc(length);
      let done = 0;
      while (done < length) {
        const n = readSync(fd, buf, done, length - done, offset + done);
        if (n === 0) throw new FormatError("GRF", "short read");
        done += n;
      }
      return buf;
    };
    const header = readAt(0, GRF_HEADER_SIZE);
    const sig = Buffer.from(header.subarray(0, 15)).toString("latin1");
    if (sig !== "Master of Magic") throw new FormatError("GRF", "bad signature");
    const dv = new DataView(header.buffer, header.byteOffset, header.byteLength);
    const tableOffset = dv.getUint32(30, true);
    const seed = dv.getUint32(34, true);
    const rawCount = dv.getUint32(38, true);
    const version = dv.getUint32(42, true);
    if (version !== 0x200) throw new FormatError("GRF", `unsupported version 0x${version.toString(16)} (only 0x200)`);
    const fileCount = rawCount - seed - 7;
    const tableHeader = readAt(GRF_HEADER_SIZE + tableOffset, 8);
    const th = new DataView(tableHeader.buffer, tableHeader.byteOffset, 8);
    const tableCompressed = th.getUint32(0, true);
    const tableReal = th.getUint32(4, true);
    const maxTable = options.maxTableBytes ?? 256 * 1024 * 1024;
    // bounded before allocation: the packed table must fit the file and the limit, and inflate may not
    // produce more than the declared real size (no decompression bomb)
    if (tableReal > maxTable) throw new FormatError("GRF", `file table too large (${tableReal} bytes)`);
    if (tableCompressed > maxTable || GRF_HEADER_SIZE + tableOffset + 8 + tableCompressed > size) throw new FormatError("GRF", `packed file table (${tableCompressed} bytes) exceeds the limit or the file`);
    let table: Buffer;
    try {
      table = inflateSync(readAt(GRF_HEADER_SIZE + tableOffset + 8, tableCompressed), { maxOutputLength: Math.max(tableReal, 1) });
    } catch (err) {
      throw new FormatError("GRF", `file table [inflate]: ${(err as Error).message}`);
    }
    if (table.length !== tableReal) throw new FormatError("GRF", `file table inflated to ${table.length}, expected ${tableReal}`);
    const tv = new DataView(table.buffer, table.byteOffset, table.byteLength);
    const byRawHex = new Map<string, GrfEntry>();
    // private registry of parser-owned entries: `byRawHex` is handed out (a Map at runtime), so identity
    // is decided here, never by a lookup the caller could have rewritten
    const owned = new WeakSet<GrfEntry>();
    let p = 0;
    let parsed = 0;
    while (p < table.length) {
      const end = table.indexOf(0, p);
      if (end < 0 || end + 17 + 1 > table.length + 1) throw new FormatError("GRF", `truncated file table at ${p}`);
      const nameBytes = table.subarray(p, end);
      p = end + 1;
      const compressedSize = tv.getUint32(p, true);
      const alignedSize = tv.getUint32(p + 4, true);
      const realSize = tv.getUint32(p + 8, true);
      const flags = tv.getUint8(p + 12);
      const offset = tv.getUint32(p + 13, true);
      p += 17;
      parsed += 1;
      if ((flags & FLAG_FILE) === 0) continue;
      const rawHex = bytesToHex(nameBytes);
      let name: string;
      try {
        name = decodeCp949(nameBytes);
      } catch {
        name = `<undecodable:${rawHex}>`;
      }
      // frozen: the archive owns its entries, so a caller cannot repoint offset / sizes after lookup
      const entry: GrfEntry = Object.freeze({ rawHex, name, compressedSize, alignedSize, realSize, flags, offset });
      owned.add(entry);
      byRawHex.set(rawHex, entry);
    }
    if (parsed !== fileCount) throw new FormatError("GRF", `file table has ${parsed} entries, header says ${fileCount}`);
    const maxEntry = options.maxEntryBytes ?? 64 * 1024 * 1024;
    // Entry data must lie inside the file after the header and must not overlap the file-table bytes.
    // (Real patched archives store data after the table, so "before the table" is not a valid rule.)
    const tableStart = GRF_HEADER_SIZE + tableOffset;
    const tableEnd = tableStart + 8 + tableCompressed;
    return {
      version,
      fileCount,
      size,
      byRawHex,
      read(entry: GrfEntry): Uint8Array {
        const e = entry as Partial<GrfEntry> | null | undefined;
        const label = `entry ${String(e?.name)} (raw ${String(e?.rawHex)}, flags 0x${typeof e?.flags === "number" ? e.flags.toString(16).padStart(2, "0") : "??"})`;
        const fail = (stage: string, message: string): FormatError => new FormatError("GRF", `${label} [${stage}]: ${message}`);
        // 1. identity: only frozen entries this archive parsed (callers cannot forge offset / sizes, even
        //    after rewriting the exposed byRawHex map)
        if (typeof entry !== "object" || entry === null || !owned.has(entry)) throw fail("identity", "not an entry of this archive");
        // 2. exact flags (0x07, a missing FILE bit and unknown bits are refused here, lazily)
        const mode = ENTRY_MODES.get(entry.flags);
        if (mode === undefined) throw fail("flags", "unsupported entry flags (only 0x01, 0x03, 0x05)");
        // 3. sizes, bounded before any allocation
        const { compressedSize, alignedSize, realSize, offset } = entry;
        if (realSize > maxEntry) throw fail("size", `real size ${realSize} exceeds ${maxEntry} bytes`);
        if (compressedSize > maxEntry || alignedSize > maxEntry) throw fail("size", `packed size ${compressedSize} / aligned ${alignedSize} exceeds ${maxEntry} bytes`);
        if (mode === "plain") {
          if (alignedSize !== compressedSize) throw fail("size", `plain entry aligned size ${alignedSize} != compressed size ${compressedSize}`);
        } else {
          if (compressedSize > alignedSize) throw fail("size", `compressed size ${compressedSize} > aligned size ${alignedSize}`);
          if (alignedSize % 8 !== 0) throw fail("size", `encrypted aligned size ${alignedSize} is not a multiple of 8`);
          if (alignedSize !== Math.ceil(compressedSize / 8) * 8) throw fail("size", `encrypted aligned size ${alignedSize} != ceil(${compressedSize} / 8) * 8`);
        }
        // 4. the aligned span lies inside the file, after the header, and does not overlap the file table
        const start = GRF_HEADER_SIZE + offset;
        const end = start + alignedSize;
        if (start < tableEnd && end > tableStart) throw fail("bounds", `data [${offset}, +${alignedSize}) overlaps the file table at ${tableOffset}`);
        if (end > size) throw fail("bounds", `data [${offset}, +${alignedSize}) runs past the end of the archive`);
        // 5. read exactly the aligned span; decrypt it whole; keep exactly compressedSize bytes
        let span: Uint8Array;
        try {
          span = readAt(GRF_HEADER_SIZE + offset, alignedSize);
        } catch (err) {
          throw fail("read", (err as Error).message);
        }
        let packed: Uint8Array;
        try {
          packed = (mode === "plain" ? span : decryptEntry(span, mode, compressedSize)).subarray(0, compressedSize);
        } catch (err) {
          throw fail("decrypt", (err as Error).message);
        }
        // 6. explicit size semantics: stored when realSize === compressedSize, otherwise inflate (bounded)
        let data: Uint8Array;
        if (realSize === compressedSize) data = packed;
        else {
          try {
            data = inflateSync(packed, { maxOutputLength: Math.max(realSize, 1) });
          } catch (err) {
            throw fail("inflate", (err as Error).message);
          }
        }
        if (data.length !== realSize) throw fail("length", `decoded to ${data.length} bytes, expected ${realSize}`);
        return data;
      },
      close(): void {
        closeSync(fd);
      },
    };
  } catch (err) {
    closeSync(fd);
    throw err;
  }
}
