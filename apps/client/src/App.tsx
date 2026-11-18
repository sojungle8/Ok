import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { compileSliceContent } from "@ro-survivor/content-schema";
import { flowTransition, type BuildPlan, type FlowEvent, type FlowState, type RunState } from "@ro-survivor/core-sim";
import { IndexedDbBackend, idempotencyKey, recordPending, settle, settleAllPending, type CharacterRecord, type RunResult } from "@ro-survivor/persistence";
import seedJson from "../../../docs/product-plan/handoff/vertical-slice-content-seed.json?raw";
import { connectFormalGateway, FIXTURE_BUILD, type GatewayConnection } from "./gateway.ts";
import { loadFormalAssets, type LoadedAssets } from "./game/assets.ts";
import { FormalAudio, prepareFormalAudio, type AudioContextLike } from "./game/formal/audio.ts";
import { installFormalFonts, type InstalledFormalFonts } from "./game/formal/fonts.ts";
import { disposeFormalScene } from "./game/formal/load.ts";
import { FormalWorld, nearestTexture, OfficialShadowLayer } from "./game/formal/world.ts";
import { MissingAssetsError, type MissingAsset } from "./game/requirements.ts";
import type { GroundData } from "./game/renderer.ts";
import type { WorldLayer } from "./game/terrain.ts";
import { whitelist } from "./gateway.ts";
import { RunRenderer } from "./game/runRenderer.ts";
import { RunSession } from "./game/session.ts";
import { DraftModal } from "./screens/Draft.tsx";
import { Hud } from "./screens/Hud.tsx";
import { loadSettings, saveSettings, type Settings } from "./settings.ts";

const content = compileSliceContent(JSON.parse(seedJson));
const params = new URLSearchParams(location.search);
// Test-fixture builds only: the acceptance bot can drive a run end to end for browser checks.
const autoplay = FIXTURE_BUILD && params.get("autoplay") ? (params.get("autoplay") as BuildPlan) : null;
const speed = Number(params.get("speed") ?? 1);
const manualDraft = autoplay !== null && params.get("manualDraft") === "1";
const PROFILE = "local-profile";

declare global {
  interface Window {
    __flow?: () => string;
    __run?: () => RunState | null;
    __results?: () => { result: RunResult; applied: boolean } | null;
  }
}

function MissingTable({ missing }: { missing: MissingAsset[] }) {
  return (
    <table class="missing" data-testid="missing-assets">
      <thead><tr><th>Canonical path</th><th>Asset ID</th><th>原因</th></tr></thead>
      <tbody>{missing.map((m) => <tr key={`${m.assetId ?? ""}:${m.canonicalPath}`}><td><code>{m.container}:{m.canonicalPath}</code></td><td>{m.assetId ?? "—"}</td><td>{m.reason}</td></tr>)}</tbody>
    </table>
  );
}

export function App() {
  const [flow, setFlow] = useState<FlowState>({ screen: "boot" });
  const [conn, setConn] = useState<GatewayConnection | null>(null);
  const [blocked, setBlocked] = useState<{ reason: string; missing: MissingAsset[] } | null>(null);
  const [assets, setAssets] = useState<LoadedAssets | null>(null);
  const [st, setSt] = useState<RunState | null>(null);
  const [results, setResults] = useState<{ result: RunResult; applied: boolean; character: CharacterRecord | null } | null>(null);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [debug, setDebug] = useState(false);
  const [audioGate, setAudioGate] = useState(false);
  const audio = useRef<FormalAudio | null>(null);
  const fonts = useRef<InstalledFormalFonts | null>(null);
  /** Test-fixture builds only: world factory from the dynamically imported fixture module. */
  const fixtureWorld = useRef<((g: GroundData) => WorldLayer) | null>(null);
  const db = useRef<IndexedDbBackend | null>(null);
  const session = useRef<RunSession | null>(null);
  const renderer = useRef<RunRenderer | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stick = useRef<HTMLDivElement>(null);
  const flowRef = useRef(flow);
  flowRef.current = flow;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const inRunScreen = flow.screen === "running" || flow.screen === "draft-paused" || flow.screen === "boss-intro" || flow.screen === "victory" || flow.screen === "defeat";
  const showDeveloperHeader = !inRunScreen || FIXTURE_BUILD || params.get("dev") === "1";
  // The run lives as long as the flow stays inside one run; phase changes must not restart it.
  const runKey = inRunScreen && "runSeed" in flow ? `${flow.stage}:${flow.runSeed}` : null;
  const send = useCallback((e: FlowEvent) => setFlow((s) => flowTransition(s, e)), []);
  window.__flow = () => flowRef.current.screen;
  window.__run = () => session.current?.state ?? null;
  window.__results = () => (results ? { result: results.result, applied: results.applied } : null);

  // Boot: storage + recovery of unsettled results, then the gateway check (no placeholder fallback).
  useEffect(() => {
    void (async () => {
      try {
        db.current = await IndexedDbBackend.open("ro-survivor");
        await settleAllPending(db.current);
      } catch {
        db.current = null;
      }
      setConn(await connectFormalGateway());
      send({ type: "booted" });
    })();
  }, [send]);

  // Loading: formal RO assets only; any gap stops with canonical paths.
  useEffect(() => {
    if (flow.screen !== "loading") return;
    let cancelled = false;
    void (async () => {
      let loaded: LoadedAssets | null = null;
      let nextAudio: FormalAudio | null = null;
      let nextFonts: InstalledFormalFonts | null = null;
      if (!conn?.ok) {
        if (!cancelled) setBlocked({ reason: conn?.ok === false ? conn.reason : "gateway 未連線", missing: [] });
        return;
      }
      try {
        loaded = await loadFormalAssets(conn.client, conn.health.fixture === true);
        if (loaded.formal) {
          if (!loaded.ui) throw new Error("formal scene loaded without the verified RO UI registry");
          nextFonts = await installFormalFonts(loaded.ui, whitelist);
          // Original audio is decoded up front; a decode failure blocks like any missing asset.
          nextAudio = new FormalAudio(new AudioContext() as unknown as AudioContextLike, loaded.formal);
          await prepareFormalAudio(nextAudio, whitelist); // a decode failure names the exact asset ID + path
        } else if (FIXTURE_BUILD) {
          const mod = await import("./game/fixture/fixtureWorld.ts");
          fixtureWorld.current = (g) => new mod.FixtureWorld(g);
        } else {
          throw new Error("formal build without a formal scene");
        }
        if (cancelled) {
          nextAudio?.dispose();
          nextFonts?.dispose();
          loaded.ui?.dispose();
          disposeFormalScene(loaded.formal);
          return;
        }
        audio.current?.dispose();
        fonts.current?.dispose();
        audio.current = nextAudio;
        fonts.current = nextFonts;
        setAssets(loaded);
        send({ type: "loaded" });
      } catch (err) {
        nextAudio?.dispose();
        nextFonts?.dispose();
        loaded?.ui?.dispose();
        disposeFormalScene(loaded?.formal ?? null);
        if (!cancelled) {
          setBlocked(
            err instanceof MissingAssetsError ? { reason: "缺少必要的 RO 素材，正式畫面停止（不以任何替代圖取代）。", missing: err.missing }
            : { reason: String(err), missing: [] },
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [flow.screen, conn, send]);

  // The decoded scene and verified Blob URLs belong to exactly one loaded run selection.
  useEffect(() => {
    if (!assets) return;
    return () => {
      assets.ui?.dispose();
      disposeFormalScene(assets.formal);
    };
  }, [assets]);

  useEffect(() => () => {
    audio.current?.dispose();
    fonts.current?.dispose();
  }, []);

  // Running: create renderer + session once the canvas exists.
  useEffect(() => {
    const f = flowRef.current;
    if (runKey === null || session.current || !assets || !canvas.current || !("runSeed" in f)) return;
    const runSeed = f.runSeed;
    const world: WorldLayer | null = assets.formal ? new FormalWorld(assets.formal, assets.ground, nearestTexture) : (fixtureWorld.current?.(assets.ground) ?? null);
    if (!world) return;
    const shadow = assets.formal ? new OfficialShadowLayer(assets.formal, nearestTexture, 441) : null;
    const r = new RunRenderer(canvas.current, content, assets.player, assets.enemies, settingsRef.current, world, shadow);
    const a = audio.current;
    if (a && !a.tryStart()) setAudioGate(true);
    renderer.current = r;
    const resize = (): void => r.resize(canvas.current?.clientWidth ?? 1, canvas.current?.clientHeight ?? 1);
    resize();
    window.addEventListener("resize", resize);
    const plan: BuildPlan = autoplay ?? "guardian";
    const s = new RunSession(content, runSeed, r, {
      onFrame: (state) => {
        setSt({ ...state });
        a?.setListener(state.player.x / 1000, world.heightAt(state.player.x / 1000, state.player.y / 1000), -state.player.y / 1000);
        const screen = flowRef.current.screen;
        const want = state.phase === "draft" || state.phase === "keystone-confirm" ? "draft-paused" : state.phase === "boss-intro" ? "boss-intro" : state.phase === "victory" || state.phase === "defeat" ? state.phase : "running";
        if (screen !== want && (screen === "running" || screen === "draft-paused" || screen === "boss-intro")) send({ type: "run-phase", phase: state.phase });
      },
      onEnd: (state) => {
        void (async () => {
          const result = s.result({ profileId: PROFILE, runId: `run-${runSeed}-${Date.now()}`, buildId: __BUILD_ID__ });
          let applied = false;
          let character: CharacterRecord | null = null;
          if (db.current) {
            await recordPending(db.current, result);
            applied = (await settle(db.current, idempotencyKey(result))).applied;
            character = (await db.current.getAll<CharacterRecord>("characters")).find(([k]) => k === `${PROFILE}:job.swordsman`)?.[1] ?? null;
          }
          setResults({ result, applied, character });
          setTimeout(() => {
            send({ type: "show-results" });
            send({ type: "settled" });
          }, autoplay ? 200 : 1500);
          setSt({ ...state });
        })();
      },
    }, { loadout: content.buildLoadouts[plan] ?? content.standardLoadout, autoplay, manualDraft, speed, grid: assets.grid ? { width: assets.grid.width, height: assets.grid.height, cellMm: assets.grid.cellMm, reachable: assets.grid.walkable } : null, start: assets.start });
    if (stick.current) {
      const el = stick.current;
      const rect = (): DOMRect => el.getBoundingClientRect();
      el.onpointerdown = (e) => {
        el.setPointerCapture(e.pointerId);
        s.router.stick.down(e.pointerId, e.clientX - rect().left, e.clientY - rect().top);
      };
      el.onpointermove = (e) => s.router.stick.move(e.pointerId, e.clientX - rect().left, e.clientY - rect().top);
      el.onpointerup = (e) => s.router.stick.up(e.pointerId);
      el.onpointercancel = () => s.router.stick.cancel();
    }
    const keys = (down: boolean) => (e: KeyboardEvent): void => {
      const k = s.router.keys;
      if (e.code === "KeyW" || e.code === "ArrowUp") k.up = down;
      if (e.code === "KeyS" || e.code === "ArrowDown") k.down = down;
      if (e.code === "KeyA" || e.code === "ArrowLeft") k.left = down;
      if (e.code === "KeyD" || e.code === "ArrowRight") k.right = down;
      if (down && e.code === "KeyG") setDebug((d) => !d);
      if (down && e.code === "KeyP") s.paused = !s.paused;
    };
    const kd = keys(true);
    const ku = keys(false);
    const blur = (): void => s.router.blur();
    const vis = (): void => {
      if (document.hidden) s.router.blur();
    };
    const padOff = (): void => s.router.padDisconnected();
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("gamepaddisconnected", padOff);
    session.current = s;
    s.start();
    return () => {
      s.stop();
      r.dispose();
      a?.dispose();
      audio.current = null;
      setAudioGate(false);
      session.current = null;
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", vis);
      window.removeEventListener("gamepaddisconnected", padOff);
    };
  }, [runKey, assets, send]);

  useEffect(() => {
    renderer.current?.setDebugOverlay(debug);
  }, [debug]);

  const updateSettings = (s: Settings): void => {
    setSettings(s);
    saveSettings(s);
    if (renderer.current) renderer.current.settings = s;
  };

  const inRun = inRunScreen;
  return (
    <main class={`app screen-${flow.screen}`} data-screen={flow.screen}>
      {inRun ? <canvas ref={canvas} class="world" data-testid="world" /> : null}
      {showDeveloperHeader ? <header class="hud" data-dev-overlay={inRunScreen ? "true" : undefined}>
        <h1 data-testid="project-name">RO Survivor Fan Game</h1>
        <p class="tag">非官方、非營利同人 · Phase 2 垂直切片</p>
        {FIXTURE_BUILD && conn?.ok && conn.health.fixture ? <p class="fixture" data-testid="fixture-banner">TEST FIXTURE：自動測試用 synthetic 素材，非正式畫面</p> : null}
        <dl>
          <dt>Profile</dt><dd data-testid="build-profile">{__BUILD_PROFILE__}</dd>
          <dt>Build</dt><dd data-testid="build-id"><code>{__BUILD_ID__}</code></dd>
          <dt>Gateway</dt><dd data-testid="gateway-status">{conn === null ? "檢查中…" : conn.ok ? `已連線 · mode=fan-local${conn.health.fixture ? " · TEST FIXTURE" : ""}` : `尚未連線 · ${conn.health?.fixture ? "fixture 已拒絕" : "無 RO 素材來源"}`}</dd>
        </dl>
      </header> : null}

      {flow.screen === "title" ? (
        <section class="panel" data-testid="title">
          <button class="primary" onClick={() => send({ type: "start" })} data-testid="start">開始</button>
          <fieldset class="settings">
            <legend>設定</legend>
            <label><input type="checkbox" checked={settings.flash} onChange={(e) => updateSettings({ ...settings, flash: (e.target as HTMLInputElement).checked })} /> 閃光</label>
            <label><input type="checkbox" checked={settings.shake} onChange={(e) => updateSettings({ ...settings, shake: (e.target as HTMLInputElement).checked })} /> 震動</label>
            <label><input type="checkbox" checked={settings.damageNumbers} onChange={(e) => updateSettings({ ...settings, damageNumbers: (e.target as HTMLInputElement).checked })} /> 傷害數字</label>
            <label><input type="checkbox" checked={settings.colorBlind} onChange={(e) => updateSettings({ ...settings, colorBlind: (e.target as HTMLInputElement).checked })} /> 色弱友善預警</label>
            <label>特效透明度 <input type="range" min="0.2" max="1" step="0.1" value={settings.effectOpacity} onInput={(e) => updateSettings({ ...settings, effectOpacity: Number((e.target as HTMLInputElement).value) })} /></label>
            <small>首領預警不受任何設定影響。</small>
          </fieldset>
        </section>
      ) : null}
      {flow.screen === "character-select" ? (
        <section class="panel" data-testid="character-select">
          <h2>選擇職業</h2>
          <button class="card" onClick={() => send({ type: "choose-character", job: "job.swordsman" })} data-testid="job-swordsman">劍士</button>
          <button onClick={() => send({ type: "back" })}>返回</button>
        </section>
      ) : null}
      {flow.screen === "stage-select" ? (
        <section class="panel" data-testid="stage-select">
          <h2>選擇關卡</h2>
          <button class="card" onClick={() => send({ type: "choose-stage", stage: "stage.prt_fild08.slice", runSeed: Number(params.get("seed") ?? (crypto.getRandomValues(new Uint32Array(1))[0] ?? 1)) })} data-testid="stage-prt_fild08">普隆德拉原野（10 分鐘）</button>
          <button onClick={() => send({ type: "back" })}>返回</button>
        </section>
      ) : null}
      {flow.screen === "loading" ? (
        <section class="panel" data-testid="loading">
          {blocked ? (
            <div class="blocked" data-testid="blocked">
              <h2>無法顯示正式畫面</h2>
              <p data-testid="blocked-reason">{blocked.reason}</p>
              {blocked.missing.length ? <MissingTable missing={blocked.missing} /> : null}
              <button onClick={() => { setBlocked(null); send({ type: "load-failed" }); }}>返回</button>
            </div>
          ) : <p>載入本機 RO 素材…</p>}
        </section>
      ) : null}
      {inRun && st ? <Hud content={content} st={st} rasters={assets?.ui?.rasters ?? null} /> : null}
      {inRun && st && session.current && (st.phase === "draft" || st.phase === "keystone-confirm") && (!autoplay || manualDraft) ? (
        <DraftModal content={content} st={st} rasters={assets?.ui?.rasters ?? null} onChoose={(i) => session.current?.choose(i)} onConfirm={() => session.current?.confirm()} onCancel={() => session.current?.cancel()} />
      ) : null}
      {(flow.screen === "victory" || flow.screen === "defeat") && !assets?.ui ? <div class="banner big" data-testid="outcome">{flow.screen === "victory" ? "勝利！" : "倒下了…"}</div> : null}
      {flow.screen === "results" && results ? (
        <section class="panel results" data-testid="results">
          <h2>{results.result.outcome === "victory" ? "勝利" : "失敗"}</h2>
          <dl>
            <dt>時間</dt><dd>{Math.floor(results.result.timeTicks / 3600)}:{String(Math.floor(results.result.timeTicks / 60) % 60).padStart(2, "0")}</dd>
            <dt>等級</dt><dd>{results.result.level}</dd>
            <dt>擊殺</dt><dd>{results.result.kills}</dd>
            <dt>傷害 / 承傷</dt><dd>{Math.round(results.result.damageDealt / 100)} / {Math.round(results.result.damageTaken / 100)}</dd>
            <dt>升級次數</dt><dd>{results.result.levelUps}</dd>
            <dt>首領擊殺</dt><dd>{results.result.bossKillTick >= 0 ? `${Math.floor(results.result.bossKillTick / 60)}s` : "—"}</dd>
            <dt>獎勵</dt><dd data-testid="rewards">Base +{results.result.rewards.baseXp} · Job +{results.result.rewards.jobXp} · {results.result.rewards.items.join(", ") || "無道具"}</dd>
            <dt>存檔</dt><dd data-testid="settled">{db.current ? (results.applied ? "已結算（本機 IndexedDB）" : "已結算過（不重複發獎）") : "無法開啟本機存檔"}</dd>
            {results.character ? <><dt>累計</dt><dd data-testid="character-total">Base {results.character.baseXp} · 勝場 {results.character.victories}/{results.character.runs}{results.character.bestTimeTicks !== null && results.character.bestTimeTicks === results.result.timeTicks && results.result.outcome === "victory" ? " · 新紀錄！" : ""}</dd></> : null}
          </dl>
          <button class="primary" onClick={() => { fonts.current?.dispose(); fonts.current = null; setResults(null); setAssets(null); setSt(null); send({ type: "continue" }); }} data-testid="continue">繼續</button>
        </section>
      ) : null}
      {inRun && audioGate ? (
        <button class="audio-gate" data-testid="audio-gate" onClick={() => void audio.current?.enable().then(() => setAudioGate(false))}>點擊啟用音訊</button>
      ) : null}
      {inRun ? <div class={`stick${assets?.formal ? " formal-stick" : ""}`} ref={stick} data-testid="joystick" aria-label={assets?.formal ? "透明移動區" : "虛擬搖桿"}><div class="knob" /></div> : null}
    </main>
  );
}
