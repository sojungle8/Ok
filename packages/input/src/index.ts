/**
 * Input adapters (04 §2.2). Every device ends as integer axes in [-1000, 1000] (+y = north); the
 * simulation alone decides speed and collision. Pure functions + small state holders; DOM wiring
 * lives in the client.
 */
export interface Axes {
  moveX: number;
  moveY: number;
}

export const ZERO: Axes = { moveX: 0, moveY: 0 };
const clamp = (v: number): number => Math.max(-1000, Math.min(1000, Math.round(v)));

function normalise(x: number, y: number, magnitude = 1): Axes {
  const len = Math.sqrt((x) ** 2 + (y) ** 2);
  if (len === 0) return ZERO;
  const m = Math.min(1, magnitude);
  return { moveX: clamp((x / len) * 1000 * m), moveY: clamp((y / len) * 1000 * m) };
}

// ---------------------------------------------------------------- keyboard
export interface KeyState { up: boolean; down: boolean; left: boolean; right: boolean }

/** 8 directions; opposite keys cancel; diagonals keep unit speed (±707). */
export function keyboardAxes(k: KeyState): Axes {
  const x = (k.right ? 1 : 0) - (k.left ? 1 : 0);
  const y = (k.up ? 1 : 0) - (k.down ? 1 : 0);
  return normalise(x, y);
}

// ---------------------------------------------------------------- joysticks
export interface JoystickConfig {
  mode: "fixed" | "floating";
  radius: number;
  /** Fraction of the radius ignored around the centre. */
  deadzone: number;
  /** Output resolution per axis (e.g. 50 steps). */
  steps: number;
}
export const DEFAULT_JOYSTICK: JoystickConfig = { mode: "floating", radius: 60, deadzone: 0.12, steps: 50 };

export class Joystick {
  readonly cfg: JoystickConfig;
  #centre: { x: number; y: number } | null = null;
  #pointer: number | null = null;
  #axes: Axes = ZERO;

  constructor(cfg: JoystickConfig = DEFAULT_JOYSTICK, fixedCentre?: { x: number; y: number }) {
    this.cfg = cfg;
    if (cfg.mode === "fixed") this.#centre = fixedCentre ?? { x: 0, y: 0 };
  }

  /** Screen coordinates (y down). Floating sticks re-centre on the touch-down point. */
  down(pointerId: number, x: number, y: number): void {
    if (this.#pointer !== null) return;
    this.#pointer = pointerId;
    if (this.cfg.mode === "floating") this.#centre = { x, y };
    this.move(pointerId, x, y);
  }

  move(pointerId: number, x: number, y: number): void {
    if (pointerId !== this.#pointer || !this.#centre) return;
    this.#axes = joystickAxes(x - this.#centre.x, -(y - this.#centre.y), this.cfg);
  }

  /** Release and touch-cancel both clear movement. */
  up(pointerId: number): void {
    if (pointerId !== this.#pointer) return;
    this.#pointer = null;
    this.#axes = ZERO;
    if (this.cfg.mode === "floating") this.#centre = null;
  }

  cancel(): void {
    this.#pointer = null;
    this.#axes = ZERO;
    if (this.cfg.mode === "floating") this.#centre = null;
  }

  axes(): Axes {
    return this.#axes;
  }
}

/** Offset (dx right, dy up) -> axes with deadzone rescale and quantisation. */
export function joystickAxes(dx: number, dy: number, cfg: JoystickConfig = DEFAULT_JOYSTICK): Axes {
  const len = Math.sqrt((dx) ** 2 + (dy) ** 2);
  const r = Math.min(1, len / cfg.radius);
  if (r <= cfg.deadzone) return ZERO;
  const m = (r - cfg.deadzone) / (1 - cfg.deadzone);
  const q = (v: number): number => (Math.round(((v / len) * m * cfg.steps)) * 1000) / cfg.steps;
  return { moveX: clamp(q(dx)), moveY: clamp(q(dy)) };
}

// ---------------------------------------------------------------- gamepad
export interface PadState { connected: boolean; stickX: number; stickY: number; dpad: KeyState }
export const PAD_DEADZONE = 0.15;

/** Radial deadzone with rescale; stick y is down-positive (Gamepad API) and is flipped; d-pad wins. */
export function gamepadAxes(p: PadState, deadzone = PAD_DEADZONE): Axes {
  if (!p.connected) return ZERO;
  const d = keyboardAxes(p.dpad);
  if (d.moveX !== 0 || d.moveY !== 0) return d;
  const x = p.stickX;
  const y = -p.stickY;
  const len = Math.sqrt((x) ** 2 + (y) ** 2);
  if (len <= deadzone) return ZERO;
  return normalise(x, y, (Math.min(1, len) - deadzone) / (1 - deadzone));
}

// ---------------------------------------------------------------- click / tap to move
/** A world target becomes a direction each tick (never screen coordinates in the simulation). */
export class ClickToMove {
  #target: { x: number; y: number } | null = null;
  readonly arriveMm: number;

  constructor(arriveMm = 300) {
    this.arriveMm = arriveMm;
  }

  set(worldX: number, worldY: number): void {
    this.#target = { x: worldX, y: worldY };
  }

  clear(): void {
    this.#target = null;
  }

  axes(playerX: number, playerY: number): Axes {
    if (!this.#target) return ZERO;
    const dx = this.#target.x - playerX;
    const dy = this.#target.y - playerY;
    if (Math.sqrt((dx) ** 2 + (dy) ** 2) <= this.arriveMm) {
      this.#target = null;
      return ZERO;
    }
    return normalise(dx, dy);
  }
}

// ---------------------------------------------------------------- combined + bot simulation
/** Priority: keyboard > gamepad > joystick > click-to-move. Blur clears everything. */
export class InputRouter {
  keys: KeyState = { up: false, down: false, left: false, right: false };
  pad: PadState = { connected: false, stickX: 0, stickY: 0, dpad: { up: false, down: false, left: false, right: false } };
  readonly stick: Joystick;
  readonly click = new ClickToMove();

  constructor(stick: Joystick = new Joystick()) {
    this.stick = stick;
  }

  blur(): void {
    this.keys = { up: false, down: false, left: false, right: false };
    this.stick.cancel();
    this.click.clear();
  }

  padDisconnected(): void {
    this.pad = { ...this.pad, connected: false, stickX: 0, stickY: 0 };
  }

  axes(playerX: number, playerY: number): Axes {
    const k = keyboardAxes(this.keys);
    if (k.moveX !== 0 || k.moveY !== 0) {
      this.click.clear();
      return k;
    }
    const g = gamepadAxes(this.pad);
    if (g.moveX !== 0 || g.moveY !== 0) return g;
    const s = this.stick.axes();
    if (s.moveX !== 0 || s.moveY !== 0) return s;
    return this.click.axes(playerX, playerY);
  }
}

/**
 * Turn a desired direction (bot intent, [-1000,1000]) into what each device can physically express:
 * keyboard -> 8 directions, touch -> quantised analogue stick, gamepad -> 8-bit stick through the
 * radial deadzone. Used by acceptance runs so every adapter is proven to finish a run.
 */
export type DeviceKind = "keyboard" | "touch" | "gamepad";

export function intentThroughDevice(kind: DeviceKind, x: number, y: number): Axes {
  if (x === 0 && y === 0) return ZERO;
  if (kind === "keyboard") {
    // Integer octant test (tan 22.5° ≈ 0.41421), identical on every engine.
    const ax = Math.abs(x);
    const ay = Math.abs(y);
    const horizontal = ay * 1000 <= ax * 414;
    const vertical = ax * 1000 <= ay * 414;
    return keyboardAxes({ up: !horizontal && y > 0, down: !horizontal && y < 0, left: !vertical && x < 0, right: !vertical && x > 0 });
  }
  if (kind === "touch") {
    const cfg = DEFAULT_JOYSTICK;
    return joystickAxes((x / 1000) * cfg.radius, (y / 1000) * cfg.radius, cfg);
  }
  const q = (v: number): number => Math.round((v / 1000) * 127) / 127;
  return gamepadAxes({ connected: true, stickX: q(x), stickY: -q(y), dpad: { up: false, down: false, left: false, right: false } });
}
