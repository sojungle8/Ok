import type { RunContent, RunState } from "@ro-survivor/core-sim";

export function Hud({ content, st }: { content: RunContent; st: RunState }) {
  const p = st.player;
  const need = content.progression.xpToNext[p.level] ?? 1;
  const boss = st.enemies.find((e) => e.id === st.bossId);
  const secs = Math.floor(st.runTick / 60);
  const warning = st.magnetPermille > 1000 && !boss;
  return (
    <section class="run-hud" data-testid="run-hud">
      <div class="bar hp" aria-label="HP"><span style={{ width: `${(p.hp / p.maxHp) * 100}%` }} /><em>{Math.ceil(p.hp / 100)} / {Math.ceil(p.maxHp / 100)}</em></div>
      <div class="bar xp" aria-label="XP"><span style={{ width: `${Math.min(100, (p.xp / need) * 100)}%` }} /><em>Lv {p.level}</em></div>
      <div class="meta">
        <span data-testid="timer">{String(Math.floor(secs / 60)).padStart(2, "0")}:{String(secs % 60).padStart(2, "0")}</span>
        <span>擊殺 {st.stats.kills}</span>
        {p.keystone ? <span>流派 {p.keystone.replace("keystone.", "")}</span> : null}
      </div>
      <div class="slots">
        {p.active.map((a) => <span key={a.id} class={st.runTick >= a.readyAt ? "ready" : ""}>{a.id.replace("skill.sw.", "")} {a.rank}</span>)}
        {p.passive.map((a) => <span key={a.id} class="passive">{a.id.split(".").pop()} {a.rank}</span>)}
      </div>
      {boss ? <div class="bar boss" data-testid="boss-hp"><span style={{ width: `${(boss.hp / boss.maxHp) * 100}%` }} /><em>Mastering{st.enraged ? " · 狂暴" : ""}{st.runTick < boss.hardenUntil ? " · 硬化（背後弱點）" : ""}</em></div> : null}
      {warning ? <div class="banner" data-testid="boss-warning">首領即將出現</div> : null}
      {st.phase === "boss-intro" ? <div class="banner big" data-testid="boss-intro">MVP · Mastering</div> : null}
    </section>
  );
}
