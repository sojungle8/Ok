import { decodeCp949 } from "@ro-survivor/asset-contracts";

export class FormatError extends Error {
  constructor(format: string, message: string) {
    super(`${format}: ${message}`);
    this.name = "FormatError";
  }
}

/** Bounds-checked little-endian reader. Every read past the end throws a FormatError. */
export class BinaryReader {
  readonly view: DataView;
  readonly bytes: Uint8Array;
  offset = 0;
  readonly format: string;

  constructor(bytes: Uint8Array, format: string) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.format = format;
  }

  get remaining(): number {
    return this.bytes.length - this.offset;
  }

  #need(n: number): void {
    if (n < 0 || this.offset + n > this.bytes.length) {
      throw new FormatError(this.format, `unexpected end of data at offset ${this.offset} (need ${n}, have ${this.remaining})`);
    }
  }

  u8(): number {
    this.#need(1);
    return this.view.getUint8(this.offset++);
  }
  u16(): number {
    this.#need(2);
    const v = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return v;
  }
  i16(): number {
    this.#need(2);
    const v = this.view.getInt16(this.offset, true);
    this.offset += 2;
    return v;
  }
  u32(): number {
    this.#need(4);
    const v = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return v;
  }
  i32(): number {
    this.#need(4);
    const v = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return v;
  }
  f32(): number {
    this.#need(4);
    const v = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return v;
  }
  take(n: number): Uint8Array {
    this.#need(n);
    const out = this.bytes.subarray(this.offset, this.offset + n);
    this.offset += n;
    return out;
  }
  skip(n: number): void {
    this.#need(n);
    this.offset += n;
  }
  ascii(n: number): string {
    let s = "";
    for (const b of this.take(n)) s += String.fromCharCode(b);
    return s;
  }
  /** Fixed-length, NUL-terminated CP949 string (bytes after the first NUL are ignored). */
  cstring(n: number): string {
    const raw = this.take(n);
    const end = raw.indexOf(0);
    return decodeCp949(end < 0 ? raw : raw.subarray(0, end));
  }
  /** Raw bytes of a fixed-length NUL-terminated string (for raw-hex lookups). */
  cstringBytes(n: number): Uint8Array {
    const raw = this.take(n);
    const end = raw.indexOf(0);
    return raw.slice(0, end < 0 ? raw.length : end);
  }
}

export function expectMagic(r: BinaryReader, magic: string): void {
  const got = r.ascii(magic.length);
  if (got !== magic) throw new FormatError(r.format, `bad magic ${JSON.stringify(got)}, expected ${JSON.stringify(magic)}`);
}
