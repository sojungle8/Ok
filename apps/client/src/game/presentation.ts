import type { Enemy, RunContent, RunState } from "@ro-survivor/core-sim";
import type { Settings } from "../settings.ts";
import { damageEmphasis, formatDamage, type DamageEmphasis } from "./combat-format.ts";
import type { Slot, SpriteSheet } from "./sprites.ts";
import "./presentation.css";

export { COMBAT_DISPLAY_SCALE, damageEmphasis, formatDamage } from "./combat-format.ts";

const HIT_MS = 180;
const ATTACK_MS = 220;
const CAST_FOLLOW_MS = 220;
const DAMAGE_MS = 820;
const MAX_DAMAGE_CUES = 96;
const TICK_MS = 1000 / 60;

interface Pulse {
  startMs: number;
  endMs: number;
}

export interface ActorSnapshot {
  id: number;
  type: string;
  assetRef: string;
  xMm: number;
  yMm: number;
  fx: number;
  fy: number;
  visualScale: number;
  shadowScale: number;
  deathDurationMs: number;
}

export interface DeathCue extends ActorSnapshot {
  startMs: number;
  endMs: number;
}

export interface DamageCue {
  id: number;
  kind: "enemy" | "player";
  emphasis: DamageEmphasis;
  amount: number;
  xMm: number;
  yMm: number;
  visualScale: number;
  startMs: number;
  endMs: number;
}

export interface ActorAnimation {
  slot: Slot;
  timeMs: number;
}

function live(pulse: Pulse | undefined, nowMs: number): boolean {
  return pulse !== undefined && nowMs < pulse.endMs;
}

function elapsed(pulse: Pulse | undefined, nowMs: number, fallback: number): number {
  return pulse === undefined ? fallback : Math.max(0, nowMs - pulse.startMs);
}

/**
 * Elite variants share the normal monster atlas. Their seed `size` multiplier already changes the
 * authoritative collision radius; this makes the same multiplier visible without scaling distinct
 * Vocal / Mastering atlases a second time.
 */
export function sharedSpriteVisualScale(content: RunContent, type: string): number {
  const def = content.monsters[type];
  if (!def) return 1;
  const base = Object.values(content.monsters).find((m) => m.assetRef === def.assetRef && m.role.startsWith("normal"));
  if (!base || base.id === def.id || base.radiusMm <= 0) return 1;
  return Math.max(0.5, Math.min(3, def.radiusMm / base.radiusMm));
}

/** Original client shadow-size table subset for the vertical slice, multiplied by shared-atlas size. */
export function officialShadowScale(content: RunContent, type: string): number {
  const ref = content.monsters[type]?.assetRef ?? "";
  if (ref === "monster.1020") return 0; // Mandragora: no shadow in the original table.
  const small = ref === "monster.1007" || ref === "monster.1063" || ref === "monster.1011" || ref === "monster.1167";
  return (small ? 0.5 : 1) * sharedSpriteVisualScale(content, type);
}

export function animationDuration(sheet: SpriteSheet, slot: Slot, direction: number): number {
  const animation = sheet.data.slots[slot].directions[direction] ?? sheet.data.slots[slot].directions[0];
  const frames = Math.max(1, animation?.frames.length ?? 1);
  return Math.max(240, Math.min(1600, frames * Math.max(1, animation?.delayMs ?? 100)));
}

/**
 * Presentation-only state. It consumes each `events` array by identity exactly once: the results
 * screen may redraw one frozen RunState forever, but its terminal events can never be replayed.
 */
export class CombatPresentationState {
  readonly enemyHits = new Map<number, Pulse>();
  readonly enemyAttacks = new Map<number, Pulse>();
  readonly deaths = new Map<number, DeathCue>();
  readonly damage: DamageCue[] = [];
  #actors = new Map<number, ActorSnapshot>();
  #lastEvents: RunState["events"] | null = null;
  #playerHit: Pulse | undefined;
  #playerAttack: Pulse | undefined;
  #playerCast: Pulse | undefined;
  #playerDeath: Pulse | undefined;
  #basicHitTick = -1;
  #castEndTick = -1;
  #flash: (Pulse & { kind: "player" | "skill"; strength: number }) | undefined;
  #shake: (Pulse & { strength: number }) | undefined;
  #nextDamageId = 1;
  #wasTerminal = false;

  ingest(st: RunState, nowMs: number, actors: ReadonlyMap<number, ActorSnapshot>, settings: Settings, basicSkillId: string, playerDeathDurationMs = 1000): void {
    const terminal = st.phase === "victory" || st.phase === "defeat";
    // A renderer can be reused for another run. Clear the completed run only when a new run starts;
    // do not clear on the terminal frame itself, because that frame carries the final hit / kill.
    if (!terminal && this.#wasTerminal) {
      this.clearTransient();
      this.#lastEvents = null;
      this.#actors.clear();
    }
    if (st.phase === "defeat" && !this.#wasTerminal) {
      this.#playerDeath = { startMs: nowMs, endMs: nowMs + Math.max(1, playerDeathDurationMs) };
    }
    this.#wasTerminal = terminal;

    // Begin the ACT on simulation wind-up, not when damage resolves. Keeping the same pulse through
    // the hit event prevents attack/cast animations from jumping back to frame zero at impact.
    if (st.phase === "running" && st.player.basicHitAt >= 0 && st.player.basicHitAt !== this.#basicHitTick) {
      this.#basicHitTick = st.player.basicHitAt;
      this.#playerAttack = {
        startMs: nowMs,
        endMs: nowMs + Math.max(0, st.player.basicHitAt - st.runTick) * TICK_MS + ATTACK_MS,
      };
    }
    if (st.phase === "running" && st.player.castSlot >= 0 && st.player.castEndAt !== this.#castEndTick) {
      this.#castEndTick = st.player.castEndAt;
      this.#playerCast = {
        startMs: nowMs,
        endMs: nowMs + Math.max(0, st.player.castEndAt - st.runTick) * TICK_MS + CAST_FOLLOW_MS,
      };
    }
    if (this.#lastEvents === st.events) {
      this.prune(nowMs);
      return;
    }
    this.#lastEvents = st.events;
    const actor = (id: number | undefined): ActorSnapshot | undefined => id === undefined ? undefined : actors.get(id) ?? this.#actors.get(id);
    const pulse = (duration: number): Pulse => ({ startMs: nowMs, endMs: nowMs + duration });
    const shake = (strength: number, duration: number): void => {
      if (!settings.shake) return;
      if (!this.#shake || strength >= this.#shake.strength || nowMs >= this.#shake.endMs) this.#shake = { ...pulse(duration), strength };
    };
    const flash = (kind: "player" | "skill", strength: number, duration: number): void => {
      if (!settings.flash) return;
      if (!this.#flash || strength >= this.#flash.strength || nowMs >= this.#flash.endMs) this.#flash = { ...pulse(duration), kind, strength };
    };
    const addDamage = (kind: DamageCue["kind"], amount: number | undefined, at: Pick<ActorSnapshot, "xMm" | "yMm" | "visualScale">, lethal = false): void => {
      if (!settings.damageNumbers || amount === undefined) return;
      this.damage.push({ id: this.#nextDamageId++, kind, emphasis: damageEmphasis(amount, lethal), amount, xMm: at.xMm, yMm: at.yMm, visualScale: at.visualScale, startMs: nowMs, endMs: nowMs + DAMAGE_MS });
      if (this.damage.length > MAX_DAMAGE_CUES) this.damage.splice(0, this.damage.length - MAX_DAMAGE_CUES);
    };

    for (const event of st.events) {
      if (event.type === "hit") {
        const target = actor(event.targetId);
        if (!target) continue;
        this.enemyHits.set(target.id, pulse(HIT_MS));
        addDamage("enemy", event.amount, target, event.lethal);
      } else if (event.type === "player-hit") {
        this.#playerHit = pulse(HIT_MS);
        const attacker = actor(event.actorId);
        if (attacker) {
          const current = this.enemyAttacks.get(attacker.id);
          this.enemyAttacks.set(attacker.id, current && live(current, nowMs)
            ? { startMs: current.startMs, endMs: Math.max(current.endMs, nowMs + ATTACK_MS) }
            : pulse(ATTACK_MS));
        }
        addDamage("player", event.amount, { xMm: st.player.x, yMm: st.player.y, visualScale: 1 }, event.lethal);
        shake(0.2, 180);
        flash("player", 0.2, 120);
      } else if (event.type === "kill") {
        const killed = actor(event.targetId);
        if (killed && !this.deaths.has(killed.id)) this.deaths.set(killed.id, { ...killed, startMs: nowMs, endMs: nowMs + killed.deathDurationMs });
      } else if (event.type === "skill") {
        if (event.source === basicSkillId) {
          this.#playerAttack = this.#playerAttack && live(this.#playerAttack, nowMs)
            ? { startMs: this.#playerAttack.startMs, endMs: Math.max(this.#playerAttack.endMs, nowMs + ATTACK_MS) }
            : pulse(ATTACK_MS);
        }
        else {
          this.#playerCast = this.#playerCast && live(this.#playerCast, nowMs)
            ? { startMs: this.#playerCast.startMs, endMs: Math.max(this.#playerCast.endMs, nowMs + CAST_FOLLOW_MS) }
            : pulse(CAST_FOLLOW_MS);
          shake(0.08, 130);
          flash("skill", 0.08, 90);
        }
      } else if (event.type === "telegraph" && event.geomId) {
        const telegraph = st.telegraphs.find((candidate) => candidate.geomId === event.geomId);
        const attacker = actor(telegraph?.ownerId);
        if (telegraph && attacker) {
          this.enemyAttacks.set(attacker.id, {
            startMs: nowMs,
            endMs: nowMs + Math.max(0, telegraph.hitTick - st.runTick) * TICK_MS + ATTACK_MS,
          });
        }
      }
    }
    this.#actors = new Map(actors);
    this.prune(nowMs);
  }

  playerAnimation(st: RunState, nowMs: number, globalTimeMs: number): ActorAnimation {
    if (st.phase === "victory") return { slot: "idle", timeMs: globalTimeMs };
    if (st.phase === "defeat") {
      const death = this.#playerDeath;
      const duration = death ? Math.max(1, death.endMs - death.startMs) : 1;
      return { slot: "death", timeMs: death ? Math.max(0, Math.min(duration - 1, nowMs - death.startMs)) : 0 };
    }
    if (live(this.#playerHit, nowMs)) return { slot: "hit", timeMs: elapsed(this.#playerHit, nowMs, globalTimeMs) };
    const advancing = st.phase === "running";
    if ((advancing && st.player.castSlot >= 0) || live(this.#playerCast, nowMs)) return { slot: "cast", timeMs: elapsed(this.#playerCast, nowMs, globalTimeMs) };
    if ((advancing && st.player.basicHitAt >= 0) || live(this.#playerAttack, nowMs)) return { slot: "attack", timeMs: elapsed(this.#playerAttack, nowMs, globalTimeMs) };
    return { slot: advancing && st.player.moving ? "walk" : "idle", timeMs: globalTimeMs };
  }

  enemyAnimation(enemy: Enemy, st: RunState, nowMs: number, globalTimeMs: number): ActorAnimation {
    const hit = this.enemyHits.get(enemy.id);
    if (st.runTick < enemy.stunUntil || live(hit, nowMs)) return { slot: "hit", timeMs: elapsed(hit, nowMs, globalTimeMs) };
    const attack = this.enemyAttacks.get(enemy.id);
    if (live(attack, nowMs)) return { slot: "attack", timeMs: elapsed(attack, nowMs, globalTimeMs) };
    return { slot: "walk", timeMs: globalTimeMs + enemy.id * 37 };
  }

  shake(nowMs: number, enabled: boolean): { x: number; z: number } {
    const s = this.#shake;
    if (!enabled || !live(s, nowMs) || !s) return { x: 0, z: 0 };
    const duration = Math.max(1, s.endMs - s.startMs);
    const fade = (s.endMs - nowMs) / duration;
    return { x: Math.sin((nowMs - s.startMs) * 0.19) * s.strength * fade, z: Math.cos((nowMs - s.startMs) * 0.13) * s.strength * 0.7 * fade };
  }

  flash(nowMs: number, enabled: boolean, effectOpacity: number): { kind: "player" | "skill"; opacity: number } | null {
    const f = this.#flash;
    if (!enabled || !live(f, nowMs) || !f) return null;
    const fade = (f.endMs - nowMs) / Math.max(1, f.endMs - f.startMs);
    const opacity = f.strength * fade * (f.kind === "skill" ? effectOpacity : 1);
    return { kind: f.kind, opacity };
  }

  prune(nowMs: number): void {
    const pruneMap = (map: Map<number, Pulse>): void => {
      for (const [id, value] of map) if (nowMs >= value.endMs) map.delete(id);
    };
    pruneMap(this.enemyHits);
    pruneMap(this.enemyAttacks);
    for (const [id, cue] of this.deaths) if (nowMs >= cue.endMs) this.deaths.delete(id);
    for (let i = this.damage.length - 1; i >= 0; i -= 1) if (nowMs >= (this.damage[i]?.endMs ?? 0)) this.damage.splice(i, 1);
    if (this.#playerHit && nowMs >= this.#playerHit.endMs) this.#playerHit = undefined;
    if (this.#playerAttack && nowMs >= this.#playerAttack.endMs) this.#playerAttack = undefined;
    if (this.#playerCast && nowMs >= this.#playerCast.endMs) this.#playerCast = undefined;
    if (this.#flash && nowMs >= this.#flash.endMs) this.#flash = undefined;
    if (this.#shake && nowMs >= this.#shake.endMs) this.#shake = undefined;
  }

  clearTransient(): void {
    this.enemyHits.clear();
    this.enemyAttacks.clear();
    this.deaths.clear();
    this.damage.splice(0);
    this.#playerHit = undefined;
    this.#playerAttack = undefined;
    this.#playerCast = undefined;
    this.#playerDeath = undefined;
    this.#basicHitTick = -1;
    this.#castEndTick = -1;
    this.#flash = undefined;
    this.#shake = undefined;
  }
}

export interface ProjectedPoint {
  x: number;
  y: number;
  visible: boolean;
}

/** Text / flash only; no bitmap is created or substituted. */
export class CombatOverlay {
  readonly root: HTMLDivElement;
  readonly flashNode: HTMLDivElement;
  readonly #nodes = new Map<number, HTMLSpanElement>();
  readonly #doc: Pick<Document, "createElement">;
  #disposed = false;

  constructor(host: HTMLElement, doc: Pick<Document, "createElement"> = document) {
    this.#doc = doc;
    this.root = doc.createElement("div");
    this.root.className = "combat-presentation";
    this.flashNode = doc.createElement("div");
    this.flashNode.className = "combat-flash";
    this.root.append(this.flashNode);
    host.append(this.root);
  }

  get damageNodeCount(): number {
    return this.#nodes.size;
  }

  get disposed(): boolean {
    return this.#disposed;
  }

  syncDamage(cues: readonly DamageCue[], nowMs: number, enabled: boolean, project: (cue: DamageCue) => ProjectedPoint): void {
    const liveIds = new Set(enabled ? cues.map((cue) => cue.id) : []);
    for (const [id, node] of this.#nodes) {
      if (liveIds.has(id)) continue;
      node.remove();
      this.#nodes.delete(id);
    }
    if (!enabled || this.#disposed) return;
    for (const cue of cues) {
      let node = this.#nodes.get(cue.id);
      if (!node) {
        node = this.#doc.createElement("span");
        node.className = `combat-damage combat-damage--${cue.kind} combat-damage--${cue.emphasis}`;
        node.textContent = formatDamage(cue.amount);
        this.root.append(node);
        this.#nodes.set(cue.id, node);
      }
      const point = project(cue);
      const progress = Math.min(1, Math.max(0, (nowMs - cue.startMs) / Math.max(1, cue.endMs - cue.startMs)));
      node.style.display = point.visible ? "block" : "none";
      node.style.left = `${Math.round(point.x)}px`;
      node.style.top = `${Math.round(point.y - progress * 30)}px`;
      node.style.opacity = String(progress < 0.68 ? 1 : Math.max(0, (1 - progress) / 0.32));
    }
  }

  setFlash(value: { kind: "player" | "skill"; opacity: number } | null): void {
    this.flashNode.className = value ? `combat-flash combat-flash--${value.kind}` : "combat-flash";
    this.flashNode.style.opacity = String(value?.opacity ?? 0);
  }

  clear(): void {
    for (const node of this.#nodes.values()) node.remove();
    this.#nodes.clear();
    this.setFlash(null);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.clear();
    this.root.remove();
    this.#disposed = true;
  }
}
