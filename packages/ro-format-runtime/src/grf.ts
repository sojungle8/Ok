// Node-only: GRF 0x200 archive reader. Imported via "@ro-survivor/ro-format-runtime/grf".
import { closeSync, fstatSync, openSync, readSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { bytesToHex, decodeCp949 } from "@ro-survivor/asset-contracts";
import { FormatError } from "./binary.ts";

export const GRF_HEADER_SIZE = 46;
const FLAG_FILE = 0x01;
const FLAG_MIXCRYPT = 0x02;
const FLAG_DES = 0x04;

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
 * Open a GRF 0x200 archive read-only. Only the header and the file table are read eagerly;
 * entry data is read on demand. Encrypted entries (MIXCRYPT / DES) are refused explicitly.
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
    if (tableReal > maxTable) throw new FormatError("GRF", `file table too large (${tableReal} bytes)`);
    const table = inflateSync(readAt(GRF_HEADER_SIZE + tableOffset + 8, tableCompressed));
    if (table.length !== tableReal) throw new FormatError("GRF", `file table inflated to ${table.length}, expected ${tableReal}`);
    const tv = new DataView(table.buffer, table.byteOffset, table.byteLength);
    const byRawHex = new Map<string, GrfEntry>();
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
      byRawHex.set(rawHex, { rawHex, name, compressedSize, alignedSize, realSize, flags, offset });
    }
    if (parsed !== fileCount) throw new FormatError("GRF", `file table has ${parsed} entries, header says ${fileCount}`);
    const maxEntry = options.maxEntryBytes ?? 64 * 1024 * 1024;
    return {
      version,
      fileCount,
      size,
      byRawHex,
      read(entry: GrfEntry): Uint8Array {
        if (entry.flags & (FLAG_MIXCRYPT | FLAG_DES)) {
          throw new FormatError("GRF", `entry ${entry.name} is encrypted (flags 0x${entry.flags.toString(16)}); decryption is not implemented`);
        }
        if (entry.realSize > maxEntry) throw new FormatError("GRF", `entry ${entry.name} exceeds ${maxEntry} bytes`);
        const packed = readAt(GRF_HEADER_SIZE + entry.offset, entry.compressedSize);
        const data = entry.compressedSize === entry.realSize && !(packed[0] === 0x78) ? packed : inflateSync(packed);
        if (data.length !== entry.realSize) throw new FormatError("GRF", `entry ${entry.name} inflated to ${data.length}, expected ${entry.realSize}`);
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
