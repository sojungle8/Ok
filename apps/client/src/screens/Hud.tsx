import type { RunContent, RunState } from "@ro-survivor/core-sim";
import { scaleCombatValue } from "../game/combat-format.ts";
import { formatHudNumber, RoFormalHud, type RasterRegistry, type RoFormalHudModel, type RoHudDamageStat, type RoHudSkill } from "../ui/ro/index.ts";

export interface HudMapExtent {
  widthMm: number;
  heightMm: number;
}

export function formalHudSkills(st: Pick<RunState, "runTick" | "player">): RoHudSkill[] {
  const p = st.player;
  return [
    { id: "skill.sw.basic_slash", rank: p.basicRank },
    ...p.active.map((a, index) => ({ id: a.id, rank: a.rank, hotkey: `F${index + 1}`, cooldownTicks: Math.max(0, a.readyAt - st.runTick) })),
  ];
}

export function formalMinimapModel(player: RunState["player"], extent: HudMapExtent): NonNullable<RoFormalHudModel["minimap"]> | undefined {
  if (!(extent.widthMm > 0) || !(extent.heightMm > 0)) return undefined;
  const clampPermille = (value: number): number => Math.max(0, Math.min(1000, Math.round(value)));
  return {
    xPermille: clampPermille(player.x * 1000 / extent.widthMm),
    // RO map bitmaps place north at the top; simulation +Y is north.
    yPermille: clampPermille(1000 - player.y * 1000 / extent.heightMm),
    facingDeg: Math.atan2(player.fx, player.fy) * 180 / Math.PI,
  };
}

const DAMAGE_LABELS: ReadonlyMap<string, string> = new Map<string, string>([
  ["skill.sw.basic_slash", "普攻"],
  ["skill.sw.bash", "狂擊"],
  ["skill.sw.magnum_break", "怒爆"],
  ["skill.sw.shield_wave", "盾擊"],
  ["skill.sw.fatal_blow", "致命攻擊"],
  ["keystone.guardian.counter", "反擊"],
]);

function damageLabel(source: string): string {
  const known = DAMAGE_LABELS.get(source);
  if (known) return known;
  const tail = source.split(".").pop() ?? source;
  return tail.replaceAll("_", " ");
}

export function formalDamageStats(stats: Pick<RunState["stats"], "effectiveDamageBySource">): RoHudDamageStat[] {
  return Object.entries(stats.effectiveDamageBySource)
    .filter(([, value]) => Number.isFinite(value) && value > 0)
    .sort(([aId, a], [bId, b]) => b - a || aId.localeCompare(bId))
    .slice(0, 4)
    .map(([id, value]) => ({ id, label: damageLabel(id), valueText: formatHudNumber(scaleCombatValue(value)) }));
}

export function Hud({ content, st, rasters = null, mapExtent }: { content: RunContent; st: RunState; rasters?: RasterRegistry | null; mapExtent?: HudMapExtent }) {
  const p = st.player;
  const need = content.progression.xpToNext[p.level] ?? 1;
  const boss = st.enemies.find((e) => e.id === st.bossId);
  const secs = Math.floor(st.runTick / 60);
  const warning = st.magnetPermille > 1000 && !boss;
  if (rasters) {
    const skills = formalHudSkills(st);
    const minimap = mapExtent ? formalMinimapModel(p, mapExtent) : undefined;
    const bossDetail = `${st.enraged ? "狂暴" : ""}${boss && st.runTick < boss.hardenUntil ? `${st.enraged ? " · " : ""}硬化` : ""}`;
    const keystone = p.keystone?.replace("keystone.", "");
    const alert = st.phase === "victory" ? { text: "勝利！", testId: "outcome" as const }
      : st.phase === "defeat" ? { text: "倒下了…", testId: "outcome" as const }
      : st.phase === "boss-intro" ? { text: "MVP · Mastering", testId: "boss-intro" as const }
      : warning ? { text: "首領即將出現", testId: "boss-warning" as const }
      : null;
    return (
      <RoFormalHud
        rasters={rasters}
        model={{
          playerName: "冒險者",
          jobName: "劍士",
          level: p.level,
          hp: p.hp,
          maxHp: p.maxHp,
          xp: p.xp,
          xpNext: need,
          timer: `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`,
          kills: st.stats.kills,
          damageStats: formalDamageStats(st.stats),
          skills,
          ...(keystone ? { keystone } : {}),
          ...(boss ? { boss: { name: "Mastering", hp: boss.hp, maxHp: boss.maxHp, ...(bossDetail ? { detail: bossDetail } : {}) } } : {}),
          ...(minimap ? { minimap } : {}),
          ...(alert ? { alert } : {}),
        }}
      />
    );
  }
  return (
    <section class="fixture-run-hud" data-testid="run-hud" data-fixture-hud="true">
      <div class="fixture-bar hp" aria-label="HP"><span style={{ width: `${(p.hp / p.maxHp) * 100}%` }} /><em>{Math.ceil(p.hp / 100)} / {Math.ceil(p.maxHp / 100)}</em></div>
      <div class="fixture-bar xp" aria-label="XP"><span style={{ width: `${Math.min(100, (p.xp / need) * 100)}%` }} /><em>Lv {p.level}</em></div>
      <div class="fixture-meta">
        <span data-testid="timer">{String(Math.floor(secs / 60)).padStart(2, "0")}:{String(secs % 60).padStart(2, "0")}</span>
        <span>擊殺 {st.stats.kills}</span>
        {p.keystone ? <span>流派 {p.keystone.replace("keystone.", "")}</span> : null}
      </div>
      <div class="fixture-slots">
        {p.active.map((a) => <span key={a.id} class={st.runTick >= a.readyAt ? "ready" : ""}>{a.id.replace("skill.sw.", "")} {a.rank}</span>)}
        {p.passive.map((a) => <span key={a.id} class="passive">{a.id.split(".").pop()} {a.rank}</span>)}
      </div>
      {boss ? <div class="fixture-bar boss" data-testid="boss-hp"><span style={{ width: `${(boss.hp / boss.maxHp) * 100}%` }} /><em>Mastering{st.enraged ? " · 狂暴" : ""}{st.runTick < boss.hardenUntil ? " · 硬化（背後弱點）" : ""}</em></div> : null}
      {warning ? <div class="banner" data-testid="boss-warning">首領即將出現</div> : null}
      {st.phase === "boss-intro" ? <div class="banner big" data-testid="boss-intro">MVP · Mastering</div> : null}
    </section>
  );
}
