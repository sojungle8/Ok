import { arenaHash, createArena, FixedStepClock, stepArena, toRenderSnapshot, type ArenaState, type InputCommand, type WalkGrid } from "@ro-survivor/core-sim";
import type { ArenaRenderer } from "./renderer.ts";
import type { InputState } from "./input.ts";

export interface LoopStats {
  fps: number;
  tickMsP95: number;
  enemies: number;
  drawCalls: number;
  triangles: number;
  tick: number;
  hash: string;
}

export interface BenchResult {
  enemies: number;
  seconds: number;
  frames: number;
  fpsP50: number;
  fpsP95Low: number;
  frameMsP50: number;
  frameMsP95: number;
  tickMsP95: number;
  tickMsMax: number;
  drawCalls: number;
  triangles: number;
  jsHeapMb: number | null;
  textureMbEstimate: number;
  droppedTicks: number;
  finalTick: number;
  stateHash: string;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((s.length - 1) * p))] as number;
}

export interface LoopOptions {
  runSeed: number;
  initialEnemies: number;
  spawnEveryTicks: number;
  grid: WalkGrid | null;
  start?: { x: number; y: number };
  /** Bench: scripted circular movement, fixed duration, no keyboard. */
  bench?: { seconds: number; onDone: (r: BenchResult) => void };
  /** Render at most this many frames per second (the simulation stays 60 Hz). */
  fpsCap?: number;
}

/** requestAnimationFrame drives rendering only; the simulation advances in fixed 60 Hz ticks. */
export class GameLoop {
  readonly state: ArenaState;
  readonly #clock = new FixedStepClock(5);
  readonly #renderer: ArenaRenderer;
  readonly #input: InputState;
  readonly #opts: LoopOptions;
  #raf = 0;
  #last = 0;
  #lastRendered = 0;
  #seq = 0;
  #frameMs: number[] = [];
  #tickMs: number[] = [];
  #startedAt = 0;
  #recent: number[] = [];
  #recentTick: number[] = [];
  onStats: ((s: LoopStats) => void) | null = null;
  #statsAt = 0;

  constructor(renderer: ArenaRenderer, input: InputState, opts: LoopOptions) {
    this.#renderer = renderer;
    this.#input = input;
    this.#opts = opts;
    this.state = createArena({ runSeed: opts.runSeed, initialEnemies: opts.initialEnemies, spawnEveryTicks: opts.spawnEveryTicks, grid: opts.grid, ...(opts.start ? { start: opts.start } : {}) });
  }

  #command(): InputCommand {
    let axes = this.#input.axes();
    if (this.#opts.bench) {
      const phase = Math.floor(this.state.tick / 90) % 8;
      const table: [number, number][] = [[1000, 0], [707, 707], [0, 1000], [-707, 707], [-1000, 0], [-707, -707], [0, -1000], [707, -707]];
      const [moveX, moveY] = table[phase] as [number, number];
      axes = { moveX, moveY };
    }
    return { tick: this.state.tick, sequence: this.#seq++, ...axes };
  }

  start(): void {
    this.#startedAt = performance.now();
    this.#last = this.#startedAt;
    const frame = (now: number): void => {
      this.#raf = requestAnimationFrame(frame);
      if (this.#opts.fpsCap && now - this.#lastRendered < 1000 / this.#opts.fpsCap - 1) return;
      this.#lastRendered = now;
      const dtMicros = Math.max(0, Math.round((now - this.#last) * 1000));
      this.#last = now;
      const n = this.#clock.advance(dtMicros);
      const t0 = performance.now();
      for (let i = 0; i < n; i += 1) stepArena(this.state, this.#command());
      const tickMs = n > 0 ? (performance.now() - t0) / n : 0;
      this.#renderer.render(toRenderSnapshot(this.state), now - this.#startedAt);
      const frameMs = dtMicros / 1000;
      if (n > 0) {
        this.#tickMs.push(tickMs);
        this.#recentTick.push(tickMs);
      }
      if (frameMs > 0) {
        this.#frameMs.push(frameMs);
        this.#recent.push(frameMs);
      }
      if (now - this.#statsAt > 250 && this.onStats) {
        this.#statsAt = now;
        const info = this.#renderer.renderer.info.render;
        const avg = this.#recent.reduce((a, b) => a + b, 0) / Math.max(1, this.#recent.length);
        this.onStats({ fps: avg > 0 ? 1000 / avg : 0, tickMsP95: percentile(this.#recentTick, 0.95), enemies: this.state.enemies.length, drawCalls: info.calls, triangles: info.triangles, tick: this.state.tick, hash: arenaHash(this.state) });
        this.#recent = [];
        this.#recentTick = [];
      }
      const bench = this.#opts.bench;
      if (bench && now - this.#startedAt >= bench.seconds * 1000) {
        this.stop();
        const info = this.#renderer.renderer.info.render;
        const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
        const frames = this.#frameMs.slice(5);
        bench.onDone({
          enemies: this.state.enemies.length,
          seconds: bench.seconds,
          frames: frames.length,
          fpsP50: 1000 / percentile(frames, 0.5),
          fpsP95Low: 1000 / percentile(frames, 0.95),
          frameMsP50: percentile(frames, 0.5),
          frameMsP95: percentile(frames, 0.95),
          tickMsP95: percentile(this.#tickMs, 0.95),
          tickMsMax: Math.max(0, ...this.#tickMs),
          drawCalls: info.calls,
          triangles: info.triangles,
          jsHeapMb: mem ? Math.round((mem.usedJSHeapSize / 1048576) * 10) / 10 : null,
          textureMbEstimate: Math.round((this.#renderer.textureBytes / 1048576) * 100) / 100,
          droppedTicks: this.#clock.droppedTicks,
          finalTick: this.state.tick,
          stateHash: arenaHash(this.state),
        });
      }
    };
    this.#raf = requestAnimationFrame(frame);
  }

  stop(): void {
    cancelAnimationFrame(this.#raf);
  }
}
