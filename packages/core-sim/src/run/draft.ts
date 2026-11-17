import { Rng } from "../prng.ts";
import type { RunContent } from "./content.ts";

export type DraftOption =
  | { kind: "new-active"; id: string }
  | { kind: "rank-active"; id: string }
  | { kind: "new-passive"; id: string }
  | { kind: "rank-passive"; id: string }
  | { kind: "rank-basic"; id: string }
  | { kind: "keystone"; id: string }
  | { kind: "heal"; id: "heal" };

export interface BuildView {
  level: number;
  basicRank: number;
  active: { id: string; rank: number }[];
  passive: { id: string; rank: number }[];
  keystone: string | null;
  tags: string[];
  runTick: number;
  levelsSinceNewActive: number;
  levelsSinceDefense: number;
}

export const DEFENSE_IDS = new Set(["skill.sw.endure", "passive.sw.hp_recovery", "passive.sw.moving_recovery"]);
const WEIGHT: Record<DraftOption["kind"], number> = { "new-active": 30, "rank-active": 20, "new-passive": 14, "rank-passive": 10, "rank-basic": 12, keystone: 0, heal: 1 };

export function optionKey(o: DraftOption): string {
  return `${o.kind}:${o.id}`;
}

/** Shield skills are unavailable once a two-handed / weapon build disabled them. */
function shieldDisabled(content: RunContent, b: BuildView): boolean {
  if (b.keystone && content.keystones[b.keystone]?.effects.shieldSkillsDisabled) return true;
  return b.passive.some((p) => content.passives[p.id]?.disablesShieldSkills);
}

function requirementsMet(requires: readonly string[], tags: readonly string[]): boolean {
  return requires.every((t) => tags.includes(t));
}

/** Every eligible option for the current build (deterministic order). */
export function eligibleOptions(content: RunContent, b: BuildView): DraftOption[] {
  const out: DraftOption[] = [];
  const noShield = shieldDisabled(content, b);
  const owns = (id: string): boolean => b.active.some((a) => a.id === id) || b.passive.some((p) => p.id === id);
  for (const s of Object.values(content.skills).sort((x, y) => (x.id < y.id ? -1 : 1))) {
    if (s.kind !== "active") continue;
    if (noShield && s.tags.includes("shield")) continue;
    if (!requirementsMet(s.requiresTags, b.tags)) continue;
    const own = b.active.find((a) => a.id === s.id);
    if (!own && b.active.length < content.player.activeSlots) out.push({ kind: "new-active", id: s.id });
    else if (own && own.rank < s.maxRank) out.push({ kind: "rank-active", id: s.id });
  }
  for (const p of Object.values(content.passives).sort((x, y) => (x.id < y.id ? -1 : 1))) {
    if (!requirementsMet(p.requiresTags, b.tags)) continue;
    if (p.disablesShieldSkills && b.tags.includes("shield-equipped") && !b.tags.includes("two-handed-sword")) continue;
    const own = b.passive.find((x) => x.id === p.id);
    if (!own && !owns(p.id) && b.passive.length < content.player.passiveSlots) out.push({ kind: "new-passive", id: p.id });
    else if (own && own.rank < p.maxRank) out.push({ kind: "rank-passive", id: p.id });
  }
  const basic = content.skills[content.player.basicSkillId];
  if (basic && b.basicRank < basic.maxRank) out.push({ kind: "rank-basic", id: basic.id });
  return out;
}

/**
 * Generate up to `choiceCount` distinct options: forced picks first (early area-clear guarantee,
 * pity), then weighted draws from the eligible pool. Uses only the dedicated draft RNG stream.
 */
export function generateDraft(content: RunContent, b: BuildView, rng: Rng, source: "level" | "chest" | "keystone"): DraftOption[] {
  const keystoneDraft = source === "keystone" || (source === "level" && content.progression.keystoneOfferLevels.includes(b.level));
  if (keystoneDraft && b.keystone === null) return Object.keys(content.keystones).sort().map((id) => ({ kind: "keystone", id }));
  const pool = eligibleOptions(content, b);
  const picked: DraftOption[] = [];
  const take = (o: DraftOption | undefined): void => {
    if (o && !picked.some((p) => optionKey(p) === optionKey(o))) picked.push(o);
  };
  const g = content.player.guaranteedEarly;
  if (b.runTick < g.beforeTick && !b.active.some((a) => g.oneOf.includes(a.id))) {
    const early = pool.filter((o) => o.kind === "new-active" && g.oneOf.includes(o.id));
    take(early[early.length > 1 ? rng.nextInt(early.length) : 0]);
  }
  if (b.levelsSinceNewActive >= content.progression.pityNewActive) {
    const na = pool.filter((o) => o.kind === "new-active");
    take(na.length ? na[rng.nextInt(na.length)] : undefined);
  }
  if (b.levelsSinceDefense >= content.progression.pityDefense) {
    const def = pool.filter((o) => DEFENSE_IDS.has(o.id));
    take(def.length ? def[rng.nextInt(def.length)] : undefined);
  }
  const rest = pool.filter((o) => !picked.some((p) => optionKey(p) === optionKey(o)));
  while (picked.length < content.progression.choiceCount && rest.length > 0) {
    const total = rest.reduce((s, o) => s + WEIGHT[o.kind], 0);
    let roll = rng.nextInt(total);
    let idx = 0;
    for (; idx < rest.length; idx += 1) {
      roll -= WEIGHT[(rest[idx] as DraftOption).kind];
      if (roll < 0) break;
    }
    picked.push(rest.splice(Math.min(idx, rest.length - 1), 1)[0] as DraftOption);
  }
  if (picked.length === 0) picked.push({ kind: "heal", id: "heal" });
  return picked.slice(0, content.progression.choiceCount);
}

export function isAreaClear(content: RunContent, id: string): boolean {
  const s = content.skills[id];
  return !!s && (s.tags.includes("area") || s.tags.includes("front-cone"));
}

