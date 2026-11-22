/**
 * Opt-in performance HUD data (Phase 3.2.5). Off by default; enabled only with `?perf=1`.
 * Pure aggregation over a bounded ring of frame intervals.
 */
export const PERF_WINDOW = 240;

export interface PerfSummary {
  frames: number;
  fpsP50: number;
  fpsP05: number;
  frameMsP95: number;
}

export class FrameTimes {
  readonly #ring = new Float64Array(PERF_WINDOW);
  #count = 0;
  #next = 0;
  #last: number | null = null;

  /** Record a frame timestamp (ms). Gaps over 1 s (tab hidden, pause) are ignored. */
  tick(nowMs: number): void {
    if (this.#last !== null) {
      const dt = nowMs - this.#last;
      if (dt > 0 && dt <= 1000) {
        this.#ring[this.#next] = dt;
        this.#next = (this.#next + 1) % PERF_WINDOW;
        this.#count = Math.min(PERF_WINDOW, this.#count + 1);
      }
    }
    this.#last = nowMs;
  }

  summary(): PerfSummary {
    const values = Array.from(this.#ring.subarray(0, this.#count)).sort((a, b) => a - b);
    if (values.length === 0) return { frames: 0, fpsP50: 0, fpsP05: 0, frameMsP95: 0 };
    const at = (p: number): number => values[Math.min(values.length - 1, Math.floor((values.length - 1) * p))] ?? 0;
    const round1 = (n: number): number => Math.round(n * 10) / 10;
    return { frames: values.length, fpsP50: round1(1000 / at(0.5)), fpsP05: round1(1000 / at(0.95)), frameMsP95: round1(at(0.95)) };
  }
}

export function perfEnabled(search: string): boolean {
  return new URLSearchParams(search).get("perf") === "1";
}
