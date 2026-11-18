import { useEffect, useRef } from "preact/hooks";
import type { CharacterRecord, RunResult } from "@ro-survivor/persistence";
import { RoResultsWindow, type RasterRegistry, type RoResultsModel, type RoResultsRow } from "../ui/ro/index.ts";

export interface ResultsData {
  result: RunResult;
  applied: boolean;
  character: CharacterRecord | null;
}

export function formatRunTime(ticks: number): string {
  const whole = Math.max(0, Math.floor(ticks));
  return `${Math.floor(whole / 3600)}:${String(Math.floor(whole / 60) % 60).padStart(2, "0")}`;
}

export function buildResultsModel(data: ResultsData, hasDatabase: boolean, settled: boolean): RoResultsModel {
  const result = data.result;
  const rows: RoResultsRow[] = [
    { key: "time", label: "時間", value: formatRunTime(result.timeTicks) },
    { key: "level", label: "等級", value: String(result.level) },
    { key: "kills", label: "擊殺", value: String(result.kills) },
    { key: "damage", label: "傷害 / 承傷", value: `${Math.round(result.damageDealt / 100)} / ${Math.round(result.damageTaken / 100)}` },
    { key: "levels", label: "升級次數", value: String(result.levelUps) },
    { key: "boss", label: "首領擊殺", value: result.bossKillTick >= 0 ? `${Math.floor(result.bossKillTick / 60)}s` : "—" },
    {
      key: "rewards",
      label: "獎勵",
      value: `Base +${result.rewards.baseXp} · Job +${result.rewards.jobXp} · ${result.rewards.items.join(", ") || "無道具"}`,
      testId: "rewards",
    },
    {
      key: "settled",
      label: "存檔",
      value: hasDatabase ? (data.applied ? "已結算（本機 IndexedDB）" : "已結算過（不重複發獎）") : "無法開啟本機存檔",
      testId: "settled",
    },
  ];
  if (data.character) {
    const record = result.outcome === "victory" && data.character.bestTimeTicks !== null && data.character.bestTimeTicks === result.timeTicks ? " · 新紀錄！" : "";
    rows.push({
      key: "character",
      label: "累計",
      value: `Base ${data.character.baseXp} · 勝場 ${data.character.victories}/${data.character.runs}${record}`,
      testId: "character-total",
    });
  }
  return {
    title: result.outcome === "victory" ? "戰鬥勝利" : "戰鬥失敗",
    rows,
    continueLabel: settled ? "繼續 Enter / A" : "結算中…",
    continueDisabled: !settled,
  };
}

/** Native button focus covers keyboard Enter/Space; this hook adds gamepad A edge activation. */
function useContinueInput(button: { current: HTMLButtonElement | null }, enabled: boolean, onContinue: () => void): void {
  const callback = useRef(onContinue);
  callback.current = onContinue;
  useEffect(() => {
    if (enabled) button.current?.focus();
  }, [button, enabled]);
  useEffect(() => {
    let raf = 0;
    let ready = false;
    let previous = false;
    const poll = (): void => {
      raf = requestAnimationFrame(poll);
      const pad = typeof navigator.getGamepads === "function" ? [...navigator.getGamepads()].find((candidate): candidate is Gamepad => candidate !== null && candidate.connected) : undefined;
      const pressed = pad?.buttons[0]?.pressed === true;
      if (ready && enabled && pressed && !previous) callback.current();
      ready = true;
      previous = pressed;
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, [enabled]);
}

export function ResultsScreen(props: {
  data: ResultsData;
  hasDatabase: boolean;
  settled: boolean;
  rasters: RasterRegistry | null;
  onContinue: () => void;
}) {
  const button = useRef<HTMLButtonElement | null>(null);
  const model = buildResultsModel(props.data, props.hasDatabase, props.settled);
  useContinueInput(button, !model.continueDisabled, props.onContinue);
  if (props.rasters) {
    return <RoResultsWindow rasters={props.rasters} model={model} registerContinue={(element) => { button.current = element; }} onContinue={props.onContinue} />;
  }
  return (
    <section class="panel results" data-testid="results">
      <h2>{model.title}</h2>
      <dl>
        {model.rows.map((row) => (
          <div key={row.key}>
            <dt>{row.label}</dt>
            <dd data-testid={row.testId}>{row.value}</dd>
          </div>
        ))}
      </dl>
      <button ref={button} class="primary" disabled={model.continueDisabled} onClick={props.onContinue} data-testid="continue">{model.continueLabel}</button>
    </section>
  );
}
