/**
 * Deterministic, platform-independent PRNG (sfc32 seeded through splitmix32).
 * Only 32-bit integer ops are used, so results are identical in every JS engine.
 * Math.random must never decide combat, drafts, spawns or loot.
 */
export interface RngState {
  a: number;
  b: number;
  c: number;
  d: number;
}

export function fnv1a32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function splitmix32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
}

export class Rng {
  #s: RngState;

  private constructor(state: RngState) {
    this.#s = { ...state };
  }

  static fromSeed(seed: number): Rng {
    const sm = splitmix32(seed);
    const rng = new Rng({ a: sm(), b: sm(), c: sm(), d: sm() });
    for (let i = 0; i < 12; i += 1) rng.nextU32();
    return rng;
  }

  /** Independent named stream (e.g. "spawn", "draft", "loot", "boss"). */
  static stream(runSeed: number, name: string): Rng {
    return Rng.fromSeed((runSeed ^ fnv1a32(name)) >>> 0);
  }

  static restore(state: RngState): Rng {
    return new Rng(state);
  }

  snapshot(): RngState {
    return { ...this.#s };
  }

  nextU32(): number {
    const s = this.#s;
    const t = (((s.a + s.b) >>> 0) + s.d) >>> 0;
    s.d = (s.d + 1) >>> 0;
    s.a = s.b ^ (s.b >>> 9);
    s.b = (s.c + (s.c << 3)) >>> 0;
    s.c = ((s.c << 21) | (s.c >>> 11)) >>> 0;
    s.c = (s.c + t) >>> 0;
    return t;
  }

  /** Uniform integer in [0, maxExclusive) without modulo bias. */
  nextInt(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > 0x100000000) {
      throw new RangeError(`nextInt bound out of range: ${maxExclusive}`);
    }
    const limit = 0x100000000 - (0x100000000 % maxExclusive);
    let x = this.nextU32();
    while (x >= limit) x = this.nextU32();
    return x % maxExclusive;
  }

  /** Inclusive integer range. */
  range(min: number, max: number): number {
    return min + this.nextInt(max - min + 1);
  }
}
