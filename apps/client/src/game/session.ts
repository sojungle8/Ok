import { botCommand, buildRunResult, createRun, FixedStepClock, stepRun, type BuildPlan, type RunConfig, type RunContent, type RunInput, type RunState } from "@ro-survivor/core-sim";
import { InputRouter } from "@ro-survivor/input";
import type { RunRenderer } from "./runRenderer.ts";

export interface SessionCallbacks {
  onFrame(st: RunState): void;
  onEnd(st: RunState): void;
}

/**
 * Owns one run: fixed 60 Hz steps driven by requestAnimationFrame, inputs from the router (keyboard,
 * joystick, gamepad, click-to-move), draft choices queued from the UI. Test-fixture builds may let
 * the acceptance bot drive (`autoplay`) at `speed` steps per tick for end-to-end checks.
 */
export class RunSession {
  readonly cfg: RunConfig;
  readonly state: RunState;
  readonly router = new InputRouter();
  readonly #clock = new FixedStepClock(5);
  readonly #renderer: RunRenderer;
  readonly #cb: SessionCallbacks;
  readonly #autoplay: BuildPlan | null;
  readonly #manualDraft: boolean;
  readonly #speed: number;
  #queued: Partial<Pick<RunInput, "draftIndex" | "confirm" | "cancel">> = {};
  #seq = 0;
  #raf = 0;
  #last = 0;
  #start = 0;
  paused = false;

  constructor(content: RunContent, runSeed: number, renderer: RunRenderer, cb: SessionCallbacks, opts: { loadout: string[]; autoplay: BuildPlan | null; manualDraft?: boolean; speed: number; grid?: RunConfig["grid"]; start?: { x: number; y: number } }) {
    this.cfg = { content, runSeed, loadout: opts.loadout, ...(opts.grid ? { grid: opts.grid } : {}), ...(opts.start ? { start: opts.start } : {}) };
    this.state = createRun(this.cfg);
    this.#renderer = renderer;
    this.#cb = cb;
    this.#autoplay = opts.autoplay;
    this.#manualDraft = opts.manualDraft === true;
    this.#speed = Math.max(1, Math.min(60, opts.speed));
  }

  choose(index: number): void {
    this.#queued.draftIndex = index;
  }
  confirm(): void {
    this.#queued.confirm = true;
  }
  cancel(): void {
    this.#queued.cancel = true;
  }

  #pollGamepad(): void {
    const pads = typeof navigator.getGamepads === "function" ? navigator.getGamepads() : [];
    const pad = [...pads].find((p): p is Gamepad => p !== null && p.connected);
    if (!pad) {
      if (this.router.pad.connected) this.router.padDisconnected();
      return;
    }
    const b = (i: number): boolean => pad.buttons[i]?.pressed === true;
    this.router.pad = { connected: true, stickX: pad.axes[0] ?? 0, stickY: pad.axes[1] ?? 0, dpad: { up: b(12), down: b(13), left: b(14), right: b(15) } };
  }

  #command(): RunInput {
    const st = this.state;
    if (this.#autoplay && !(this.#manualDraft && st.phase !== "running")) {
      const bot = botCommand(this.cfg.content, st, this.#autoplay, this.#seq++, (x, y) => ({ moveX: x, moveY: y }));
      return st.phase === "running" && this.paused ? { ...bot, pause: true } : bot;
    }
    const axes = st.phase === "running" ? this.router.axes(st.player.x, st.player.y) : { moveX: 0, moveY: 0 };
    const cmd: RunInput = { tick: st.tick, sequence: this.#seq++, ...axes, ...this.#queued, ...(this.paused ? { pause: true } : {}) };
    this.#queued = {};
    return cmd;
  }

  start(): void {
    this.#start = performance.now();
    this.#last = this.#start;
    const frame = (now: number): void => {
      this.#raf = requestAnimationFrame(frame);
      this.#pollGamepad();
      let n = this.#clock.advance(Math.max(0, Math.round((now - this.#last) * 1000)));
      this.#last = now;
      if (this.#autoplay && !this.#manualDraft) n *= this.#speed;
      for (let i = 0; i < n; i += 1) {
        stepRun(this.state, this.cfg, this.#command());
        if (this.state.phase === "victory" || this.state.phase === "defeat") break;
      }
      this.#renderer.render(this.state, now - this.#start);
      this.#cb.onFrame(this.state);
      if (this.state.phase === "victory" || this.state.phase === "defeat") {
        this.stop();
        this.#cb.onEnd(this.state);
      }
    };
    this.#raf = requestAnimationFrame(frame);
  }

  stop(): void {
    cancelAnimationFrame(this.#raf);
  }

  result(meta: { profileId: string; runId: string; buildId: string }) {
    return buildRunResult(this.cfg.content, this.state, { ...meta, job: "job.swordsman", stage: "stage.prt_fild08.slice" });
  }
}
