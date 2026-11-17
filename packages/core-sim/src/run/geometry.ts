import { COS_DEG, TRIG_SCALE } from "../trig.ts";
import type { Geometry } from "./content.ts";

/**
 * Integer geometry shared by telegraph drawing and hit tests (one object, one ID — 03 §預警與傷害共用資料).
 * Directions are unit vectors scaled by TRIG_SCALE. Only +, -, *, / and Math.sqrt are used.
 */
export interface Placed {
  shape: Geometry;
  ox: number;
  oy: number;
  /** Facing unit vector ×10_000 (ignored by circles). */
  dx: number;
  dy: number;
}

export function unitToward(fromX: number, fromY: number, toX: number, toY: number, fallback: [number, number] = [0, -TRIG_SCALE]): [number, number] {
  const vx = toX - fromX;
  const vy = toY - fromY;
  const d = Math.sqrt(vx * vx + vy * vy);
  if (d === 0) return fallback;
  return [Math.trunc((vx * TRIG_SCALE) / d), Math.trunc((vy * TRIG_SCALE) / d)];
}

/** Does a circle (px, py, r) intersect the placed geometry? */
export function hits(g: Placed, px: number, py: number, r: number): boolean {
  const vx = px - g.ox;
  const vy = py - g.oy;
  const s = g.shape;
  if (s.shape === "circle") {
    const rr = s.radiusMm + r;
    return vx * vx + vy * vy <= rr * rr;
  }
  if (s.shape === "sector") {
    const rr = s.rangeMm + r;
    const d2 = vx * vx + vy * vy;
    if (d2 > rr * rr) return false;
    if (d2 <= r * r) return true; // overlapping the origin
    const d = Math.sqrt(d2);
    // angle test: dot(v, dir) >= |v| * cos(half), all scaled by TRIG_SCALE.
    const half = Math.max(0, Math.min(180, s.halfAngleDeg));
    const dot = vx * g.dx + vy * g.dy;
    return dot >= d * (COS_DEG[half] as number);
  }
  // capsule: segment from origin along dir with length rangeMm, radius radiusMm.
  const t = (vx * g.dx + vy * g.dy) / TRIG_SCALE; // projection in mm
  const clamped = Math.max(0, Math.min(s.rangeMm, t));
  const cx = g.ox + Math.trunc((g.dx * clamped) / TRIG_SCALE);
  const cy = g.oy + Math.trunc((g.dy * clamped) / TRIG_SCALE);
  const ex = px - cx;
  const ey = py - cy;
  const rr = s.radiusMm + r;
  return ex * ex + ey * ey <= rr * rr;
}

/** Reach of a geometry from its origin (for target acquisition). */
export function reachMm(g: Geometry): number {
  return g.shape === "circle" ? g.radiusMm : g.rangeMm;
}
