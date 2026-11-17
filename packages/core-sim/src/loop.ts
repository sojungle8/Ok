import { SIM_HZ } from "./sim.ts";

/**
 * Render-loop adapter: converts variable frame deltas into a whole number of fixed ticks.
 * Uses integer microseconds scaled by the tick rate so accumulation is exact. At most `maxTicksPerFrame` ticks are
 * produced per frame; excess time is dropped (and reported) instead of spiralling.
 */
export class FixedStepClock {
  /** Accumulator in units of 1/(1e6 * hz) seconds, so every rate is exact integer math. */
  #acc = 0;
  #droppedTicks = 0;

  readonly maxTicksPerFrame: number;
  readonly hz: number;

  constructor(maxTicksPerFrame = 5, hz = SIM_HZ) {
    this.maxTicksPerFrame = maxTicksPerFrame;
    this.hz = hz;
  }

  get droppedTicks(): number {
    return this.#droppedTicks;
  }

  /** Feed one rendered frame; returns how many simulation ticks to run now. */
  advance(frameMicros: number): number {
    if (!Number.isInteger(frameMicros) || frameMicros < 0) throw new RangeError("frameMicros must be a non-negative integer");
    this.#acc += frameMicros * this.hz;
    let ticks = Math.floor(this.#acc / 1_000_000);
    this.#acc -= ticks * 1_000_000;
    if (ticks > this.maxTicksPerFrame) {
      this.#droppedTicks += ticks - this.maxTicksPerFrame;
      ticks = this.maxTicksPerFrame;
    }
    return ticks;
  }
}
