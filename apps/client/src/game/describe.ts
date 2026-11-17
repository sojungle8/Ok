import { skillValue, type DraftOption, type RunContent, type RunState } from "@ro-survivor/core-sim";

/** Tooltip lines computed from the same content data the simulation uses (old → new values). */
export function describeOption(c: RunContent, st: RunState, o: DraftOption): { title: string; lines: string[] } {
  const p = st.player;
  const fmtS = (ticks: number): string => `${(ticks / 60).toFixed(2)}s`;
  const fmtHp = (centi: number): string => `${(centi / 100).toFixed(0)}`;
  if (o.kind === "keystone") {
    const e = c.keystones[o.id]?.effects ?? {};
    return { title: `流派：${o.id.replace("keystone.", "")}`, lines: Object.entries(e).map(([k, v]) => `${k}: ${typeof v === "number" ? (k.endsWith("Permille") ? `×${(v / 1000).toFixed(2)}` : v) : String(v)}`).concat(["需再次確認，且只能選一個流派"]) };
  }
  if (o.kind === "heal") return { title: "回復", lines: ["回復 30% 最大 HP"] };
  if (o.kind === "new-passive" || o.kind === "rank-passive") {
    const d = c.passives[o.id];
    const rank = p.passive.find((x) => x.id === o.id)?.rank ?? 0;
    const lines: string[] = [`等級 ${rank} → ${rank + 1}`];
    if (d?.perRank.physicalDamagePermille) lines.push(`物理傷害 +${(d.perRank.physicalDamagePermille * rank) / 10}% → +${(d.perRank.physicalDamagePermille * (rank + 1)) / 10}%`);
    if (d?.perRank.maxHpPermille) lines.push(`最大 HP +${(d.perRank.maxHpPermille * rank) / 10}% → +${(d.perRank.maxHpPermille * (rank + 1)) / 10}%`);
    if (d?.perRank.attackIntervalPermille) lines.push(`普攻間隔 ${(d.perRank.attackIntervalPermille * rank) / 10}% → ${(d.perRank.attackIntervalPermille * (rank + 1)) / 10}%`);
    if (d?.lowHp) lines.push(`HP ≤ ${d.lowHp.thresholdPermille / 10}% 時傷害 ×${d.lowHp.damagePermille / 1000}`);
    if (d?.movingRecoveryPermille) lines.push(`移動中回復 ×${d.movingRecoveryPermille / 1000}`);
    return { title: o.id.replace(/^(passive|skill)\.sw\./u, ""), lines };
  }
  const s = c.skills[o.id];
  if (!s) return { title: o.id, lines: [] };
  const rank = o.kind === "rank-basic" ? p.basicRank : (p.active.find((a) => a.id === o.id)?.rank ?? 0);
  const next = skillValue(c, s, Math.max(1, rank + 1), p.keystone);
  const cur = rank > 0 ? skillValue(c, s, rank, p.keystone) : null;
  const pair = (label: string, a: string | null, b: string): string => (a === null || a === b ? `${label} ${b}` : `${label} ${a} → ${b}`);
  const lines = [`等級 ${rank} → ${rank + 1}`, pair("傷害", cur ? fmtHp(cur.damage) : null, fmtHp(next.damage)), pair("冷卻", cur ? fmtS(cur.cooldown) : null, fmtS(next.cooldown))];
  if (next.geometry?.shape === "circle") lines.push(pair("半徑", cur?.geometry?.shape === "circle" ? `${cur.geometry.radiusMm / 1000}m` : null, `${next.geometry.radiusMm / 1000}m`));
  else if (next.geometry) lines.push(pair("距離", cur?.geometry && cur.geometry.shape !== "circle" ? `${cur.geometry.rangeMm / 1000}m` : null, `${next.geometry.rangeMm / 1000}m`));
  if (next.hitLimit > 1) lines.push(pair("目標數", cur ? String(cur.hitLimit) : null, String(next.hitLimit)));
  lines.push("自動施放，不會移動角色");
  return { title: s.id.replace("skill.sw.", ""), lines };
}
