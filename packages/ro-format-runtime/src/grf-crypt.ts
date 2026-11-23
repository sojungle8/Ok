/**
 * Private GRF 0x200 entry decryption (Node-only, used by ./grf.ts; not exported from the package).
 *
 * Clean-room implementation from the behavioural specification of the GRF entry encryption:
 * - "modified DES": Gravity's keyless, single-round DES transform on one 8-byte block —
 *   initial permutation (IP), one Feistel round L ^= P(S(E(R))) with no key and no half swap, final
 *   permutation (IP⁻¹). The permutation tables and S-boxes are the public DES tables of FIPS 46-3; the
 *   transform is an involution, so the same function decrypts and encrypts.
 * - HEADER mode (flags 0x05): only the first 20 blocks are DES blocks.
 * - MIXCRYPT mode (flags 0x03): the first 20 blocks are DES blocks; after that, block i is a DES block
 *   when i % cycle === 0 (cycle from the decimal digit count of the entry's compressed size), and every
 *   7th non-DES block (counting from 0, skipping the 0th) is a "shuffle" block. DES blocks take
 *   precedence and do not advance the shuffle counter.
 *
 * Every call works on its own scratch buffers; no mutable state is shared between calls.
 */

/** FIPS 46-3 initial permutation (1-based bit positions, MSB of byte 0 = bit 1). */
const IP = [58, 50, 42, 34, 26, 18, 10, 2, 60, 52, 44, 36, 28, 20, 12, 4, 62, 54, 46, 38, 30, 22, 14, 6, 64, 56, 48, 40, 32, 24, 16, 8, 57, 49, 41, 33, 25, 17, 9, 1, 59, 51, 43, 35, 27, 19, 11, 3, 61, 53, 45, 37, 29, 21, 13, 5, 63, 55, 47, 39, 31, 23, 15, 7] as const;
/** FIPS 46-3 final permutation (IP⁻¹). */
const FP = [40, 8, 48, 16, 56, 24, 64, 32, 39, 7, 47, 15, 55, 23, 63, 31, 38, 6, 46, 14, 54, 22, 62, 30, 37, 5, 45, 13, 53, 21, 61, 29, 36, 4, 44, 12, 52, 20, 60, 28, 35, 3, 43, 11, 51, 19, 59, 27, 34, 2, 42, 10, 50, 18, 58, 26, 33, 1, 41, 9, 49, 17, 57, 25] as const;
/** FIPS 46-3 expansion E (32 → 48 bits, positions within R). */
const E = [32, 1, 2, 3, 4, 5, 4, 5, 6, 7, 8, 9, 8, 9, 10, 11, 12, 13, 12, 13, 14, 15, 16, 17, 16, 17, 18, 19, 20, 21, 20, 21, 22, 23, 24, 25, 24, 25, 26, 27, 28, 29, 28, 29, 30, 31, 32, 1] as const;
/** FIPS 46-3 permutation P (32 bits). */
const P = [16, 7, 20, 21, 29, 12, 28, 17, 1, 15, 23, 26, 5, 18, 31, 10, 2, 8, 24, 14, 32, 27, 3, 9, 19, 13, 30, 6, 22, 11, 4, 25] as const;
/** FIPS 46-3 S-boxes S1…S8, each 4 rows × 16 columns. */
const S: readonly (readonly number[])[] = [
  [14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7, 0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8, 4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0, 15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13],
  [15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10, 3, 13, 4, 7, 15, 2, 8, 14, 12, 0, 1, 10, 6, 9, 11, 5, 0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15, 13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9],
  [10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8, 13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1, 13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7, 1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12],
  [7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15, 13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9, 10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4, 3, 15, 0, 6, 10, 1, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14],
  [2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9, 14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6, 4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14, 11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3],
  [12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11, 10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8, 9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6, 4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13],
  [4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1, 13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6, 1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2, 6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12],
  [13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7, 1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2, 7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8, 2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11],
];

/** Bit `pos` (1-based, MSB first) of `bytes`. */
const bit = (bytes: Uint8Array, pos: number): number => ((bytes[(pos - 1) >> 3] as number) >> (7 - ((pos - 1) & 7))) & 1;

/** Apply a 1-based permutation table to `src`, writing `table.length` bits into a fresh buffer. */
function permute(src: Uint8Array, table: readonly number[]): Uint8Array {
  const out = new Uint8Array(table.length >> 3);
  for (let i = 0; i < table.length; i += 1) if (bit(src, table[i] as number)) out[i >> 3] = (out[i >> 3] as number) | (0x80 >> (i & 7));
  return out;
}

/** S-box k (0-based) on a 6-bit input: row = outer bits, column = inner four bits. */
function sbox(k: number, six: number): number {
  const row = ((six >> 4) & 0x02) | (six & 0x01);
  const col = (six >> 1) & 0x0f;
  return (S[k] as readonly number[])[row * 16 + col] as number;
}

/** Gravity's keyless one-round modified DES on the 8 bytes at `buf[at…at+8)`, in place (an involution). */
export function desBlock(buf: Uint8Array, at: number): void {
  const block = permute(buf.subarray(at, at + 8), IP);
  const right = block.subarray(4, 8);
  const expanded = permute(right, E); // 48 bits
  const sOut = new Uint8Array(4);
  for (let k = 0; k < 8; k += 1) {
    let six = 0;
    for (let b = 0; b < 6; b += 1) six = (six << 1) | bit(expanded, k * 6 + b + 1);
    sOut[k >> 1] = (sOut[k >> 1] as number) | (sbox(k, six) << ((k & 1) === 0 ? 4 : 0));
  }
  const f = permute(sOut, P);
  for (let i = 0; i < 4; i += 1) block[i] = (block[i] as number) ^ (f[i] as number);
  buf.set(permute(block, FP), at);
}

/** The shuffle substitution (an involution): the seven byte pairs swapped in shuffle blocks. */
export const SHUFFLE_PAIRS: readonly (readonly [number, number])[] = [
  [0x00, 0x2b],
  [0x01, 0x68],
  [0x48, 0x77],
  [0x60, 0xff],
  [0x6c, 0x80],
  [0xb9, 0xc0],
  [0xeb, 0xfe],
];
function substitute(b: number): number {
  for (const [x, y] of SHUFFLE_PAIRS) {
    if (b === x) return y;
    if (b === y) return x;
  }
  return b;
}

/** Undo the shuffle of the 8 bytes at `buf[at…at+8)`, in place. */
function unshuffleBlock(buf: Uint8Array, at: number): void {
  const s = buf.slice(at, at + 8);
  buf[at] = s[3] as number;
  buf[at + 1] = s[4] as number;
  buf[at + 2] = s[6] as number;
  buf[at + 3] = s[0] as number;
  buf[at + 4] = s[1] as number;
  buf[at + 5] = s[2] as number;
  buf[at + 6] = s[5] as number;
  buf[at + 7] = substitute(s[7] as number);
}

/** MIXCRYPT DES cycle from the decimal digit count of the entry's compressed size. */
export function mixCycle(compressedSize: number): number {
  const digits = String(Math.trunc(compressedSize)).length;
  if (digits < 3) return 1;
  if (digits < 5) return digits + 1;
  if (digits < 7) return digits + 9;
  return digits + 15;
}

export type GrfCryptMode = "mixcrypt" | "header";

/**
 * Decrypt an encrypted entry's full aligned buffer (length a multiple of 8) and return a new buffer;
 * the input is not modified. `compressedSize` selects the MIXCRYPT cycle.
 */
export function decryptEntry(aligned: Uint8Array, mode: GrfCryptMode, compressedSize: number): Uint8Array {
  if (aligned.length % 8 !== 0) throw new RangeError(`encrypted entry length ${aligned.length} is not a multiple of 8`);
  const out = Uint8Array.from(aligned);
  const blocks = out.length / 8;
  for (let i = 0; i < 20 && i < blocks; i += 1) desBlock(out, i * 8);
  if (mode === "header") return out;
  const cycle = mixCycle(compressedSize);
  let plain = -1;
  for (let i = 20; i < blocks; i += 1) {
    if (i % cycle === 0) {
      desBlock(out, i * 8);
      continue;
    }
    plain += 1;
    if (plain % 7 === 0 && plain !== 0) unshuffleBlock(out, i * 8);
  }
  return out;
}

