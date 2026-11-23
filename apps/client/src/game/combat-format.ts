/**
 * The deterministic simulation stores damage in centi-points, so a 28-point hit already travels as
 * the integer 2800. The RO presentation keeps that integer scale: it matches the reference game's
 * readable thousands cadence without changing HP, balance, RNG, settlement or replay hashes.
 */
export const COMBAT_DISPLAY_SCALE = 1;

export type DamageEmphasis = "normal" | "heavy" | "lethal";

export function scaleCombatValue(amount: number): number {
  return Math.max(1, Math.round(amount * COMBAT_DISPLAY_SCALE));
}

export function formatDamage(amount: number): string {
  return String(scaleCombatValue(amount));
}

export function damageEmphasis(amount: number, lethal = false): DamageEmphasis {
  if (lethal) return "lethal";
  return amount >= 4_000 ? "heavy" : "normal";
}
