import { describe, expect, it } from "vitest";
import { ClickToMove, gamepadAxes, InputRouter, intentThroughDevice, Joystick, joystickAxes, keyboardAxes } from "../src/index.ts";

const none = { up: false, down: false, left: false, right: false };

describe("input adapters", () => {
  it("keyboard: 8 directions, diagonals at unit speed, opposite keys cancel", () => {
    expect(keyboardAxes({ ...none, up: true })).toEqual({ moveX: 0, moveY: 1000 });
    expect(keyboardAxes({ ...none, up: true, right: true })).toEqual({ moveX: 707, moveY: 707 });
    expect(keyboardAxes({ ...none, left: true, right: true })).toEqual({ moveX: 0, moveY: 0 });
  });

  it("joystick: deadzone, rescale, quantisation; floating re-centres; release / cancel clear", () => {
    expect(joystickAxes(3, 0)).toEqual({ moveX: 0, moveY: 0 });
    expect(joystickAxes(60, 0)).toEqual({ moveX: 1000, moveY: 0 });
    const s = new Joystick();
    s.down(1, 100, 100);
    s.move(1, 100, 40); // drag up 60 px
    expect(s.axes()).toEqual({ moveX: 0, moveY: 1000 });
    s.move(2, 0, 0); // other pointers ignored
    expect(s.axes().moveY).toBe(1000);
    s.up(1);
    expect(s.axes()).toEqual({ moveX: 0, moveY: 0 });
    const fixed = new Joystick({ mode: "fixed", radius: 60, deadzone: 0.12, steps: 50 }, { x: 0, y: 0 });
    fixed.down(1, 60, 0);
    expect(fixed.axes().moveX).toBe(1000);
    fixed.cancel();
    expect(fixed.axes()).toEqual({ moveX: 0, moveY: 0 });
  });

  it("gamepad: radial deadzone, flipped y, d-pad priority, disconnect clears", () => {
    const pad = { connected: true, stickX: 0.1, stickY: -0.05, dpad: none };
    expect(gamepadAxes(pad)).toEqual({ moveX: 0, moveY: 0 });
    expect(gamepadAxes({ ...pad, stickX: 0, stickY: -1 })).toEqual({ moveX: 0, moveY: 1000 });
    expect(gamepadAxes({ ...pad, dpad: { ...none, left: true } })).toEqual({ moveX: -1000, moveY: 0 });
    const r = new InputRouter();
    r.pad = { connected: true, stickX: 1, stickY: 0, dpad: none };
    expect(r.axes(0, 0).moveX).toBe(1000);
    r.padDisconnected();
    expect(r.axes(0, 0)).toEqual({ moveX: 0, moveY: 0 });
  });

  it("click-to-move yields a direction until arrival; blur clears all devices", () => {
    const c = new ClickToMove();
    c.set(10_000, 0);
    expect(c.axes(0, 0)).toEqual({ moveX: 1000, moveY: 0 });
    expect(c.axes(9_900, 0)).toEqual({ moveX: 0, moveY: 0 });
    const r = new InputRouter();
    r.keys = { ...none, up: true };
    r.stick.down(1, 0, 0);
    r.stick.move(1, 60, 0);
    r.click.set(0, 5000);
    r.blur();
    expect(r.axes(0, 0)).toEqual({ moveX: 0, moveY: 0 });
  });

  it("device simulation for bots stays within each device's expressive range", () => {
    expect(intentThroughDevice("keyboard", 900, 300)).toEqual({ moveX: 1000, moveY: 0 }); // 18° -> east
    expect(intentThroughDevice("keyboard", 600, 600)).toEqual({ moveX: 707, moveY: 707 });
    const t = intentThroughDevice("touch", 600, 800);
    expect(Math.abs(t.moveX % 20)).toBe(0);
    const g = intentThroughDevice("gamepad", 1000, 0);
    expect(g.moveX).toBe(1000);
    expect(intentThroughDevice("gamepad", 50, 0)).toEqual({ moveX: 0, moveY: 0 });
  });
});
