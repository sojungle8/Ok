/** Manually advanced clock for tests; never reads wall time. */
export class FakeClock {
  #nowMs: number;

  constructor(startMs = 0) {
    this.#nowMs = startMs;
  }

  now(): number {
    return this.#nowMs;
  }

  advance(ms: number): number {
    if (ms < 0) throw new RangeError("FakeClock cannot go backwards");
    this.#nowMs += ms;
    return this.#nowMs;
  }

  /** Frame deltas in integer microseconds that sum exactly to `seconds` at `fps`. */
  static frameMicros(fps: number, seconds: number): number[] {
    const frames = fps * seconds;
    const out: number[] = [];
    let prev = 0;
    for (let k = 1; k <= frames; k += 1) {
      const t = Math.round((k * 1_000_000) / fps);
      out.push(t - prev);
      prev = t;
    }
    return out;
  }
}
