/** Keyboard (WASD / arrows) + on-screen joystick -> quantised axes in [-1000, 1000] (+y = north). */
export class InputState {
  #keys = new Set<string>();
  #stick = { x: 0, y: 0 };
  #dispose: (() => void)[] = [];

  attachKeyboard(target: Window): void {
    const down = (e: KeyboardEvent): void => {
      if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        this.#keys.add(e.code);
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent): void => {
      this.#keys.delete(e.code);
    };
    const blur = (): void => this.#keys.clear();
    target.addEventListener("keydown", down);
    target.addEventListener("keyup", up);
    target.addEventListener("blur", blur);
    this.#dispose.push(() => {
      target.removeEventListener("keydown", down);
      target.removeEventListener("keyup", up);
      target.removeEventListener("blur", blur);
    });
  }

  /** Virtual joystick on an element: drag inside the base; releases reset to centre. */
  attachJoystick(base: HTMLElement, knob: HTMLElement): void {
    let active: number | null = null;
    const move = (e: PointerEvent): void => {
      if (e.pointerId !== active) return;
      const r = base.getBoundingClientRect();
      const radius = r.width / 2;
      let dx = e.clientX - (r.left + radius);
      let dy = e.clientY - (r.top + radius);
      const len = Math.hypot(dx, dy);
      if (len > radius) {
        dx = (dx / len) * radius;
        dy = (dy / len) * radius;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.#stick = { x: dx / radius, y: -dy / radius };
    };
    const end = (e: PointerEvent): void => {
      if (e.pointerId !== active) return;
      active = null;
      knob.style.transform = "translate(0px, 0px)";
      this.#stick = { x: 0, y: 0 };
    };
    const start = (e: PointerEvent): void => {
      active = e.pointerId;
      base.setPointerCapture(e.pointerId);
      move(e);
    };
    base.addEventListener("pointerdown", start);
    base.addEventListener("pointermove", move);
    base.addEventListener("pointerup", end);
    base.addEventListener("pointercancel", end);
    this.#dispose.push(() => {
      base.removeEventListener("pointerdown", start);
      base.removeEventListener("pointermove", move);
      base.removeEventListener("pointerup", end);
      base.removeEventListener("pointercancel", end);
    });
  }

  axes(): { moveX: number; moveY: number } {
    let x = 0;
    let y = 0;
    if (this.#keys.has("KeyA") || this.#keys.has("ArrowLeft")) x -= 1;
    if (this.#keys.has("KeyD") || this.#keys.has("ArrowRight")) x += 1;
    if (this.#keys.has("KeyW") || this.#keys.has("ArrowUp")) y += 1;
    if (this.#keys.has("KeyS") || this.#keys.has("ArrowDown")) y -= 1;
    if (x === 0 && y === 0) {
      x = this.#stick.x;
      y = this.#stick.y;
    }
    const q = (v: number): number => Math.max(-1000, Math.min(1000, Math.round(v * 1000)));
    return { moveX: q(x), moveY: q(y) };
  }

  dispose(): void {
    for (const d of this.#dispose) d();
  }
}
