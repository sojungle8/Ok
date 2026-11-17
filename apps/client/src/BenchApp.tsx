import { useEffect, useRef, useState } from "preact/hooks";
import { arenaHash } from "@ro-survivor/core-sim";
import { connectFormalGateway } from "./gateway.ts";
import { loadFormalAssets, type LoadedAssets } from "./game/assets.ts";
import { InputState } from "./game/input.ts";
import { GameLoop, type BenchResult, type LoopStats } from "./game/loop.ts";
import { ArenaRenderer } from "./game/fixture/benchRenderer.ts";
import { MissingAssetsError, type MissingAsset } from "./game/requirements.ts";

declare global {
  interface Window {
    __bench?: BenchResult & { buildId: string; userAgent: string; viewport: string; pixelRatio: number; loadMs: number; assetSource: string };
    __arena?: { hash(): string; tick(): number; enemies(): number; player(): { x: number; y: number; dir: number } };
  }
}

const params = new URLSearchParams(location.search);
const benchEnemies = params.has("bench") ? Number(params.get("bench")) : null;

type Phase =
  | { kind: "loading" }
  | { kind: "blocked"; reason: string; missing: MissingAsset[] }
  | { kind: "running"; fixture: boolean; tolerated: MissingAsset[] };

function MissingTable({ missing }: { missing: MissingAsset[] }) {
  return (
    <table class="missing" data-testid="missing-assets">
      <thead>
        <tr>
          <th>Canonical path</th>
          <th>Asset ID</th>
          <th>原因</th>
        </tr>
      </thead>
      <tbody>
        {missing.map((m) => (
          <tr key={`${m.assetId ?? ""}:${m.canonicalPath}`}>
            <td><code>{m.container}:{m.canonicalPath}</code></td>
            <td>{m.assetId ?? "—"}</td>
            <td>{m.reason}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Phase 1 render bench (test-fixture builds only, ?bench=N): arena + one monster sheet. */
export function BenchApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [gatewayText, setGatewayText] = useState("檢查中…");
  const [stats, setStats] = useState<LoopStats | null>(null);
  const [debug, setDebug] = useState(false);
  const rendererRef = useRef<ArenaRenderer | null>(null);

  useEffect(() => {
    let disposed = false;
    const input = new InputState();
    let loop: GameLoop | null = null;
    let renderer: ArenaRenderer | null = null;
    const onResize = (): void => {
      const c = canvasRef.current;
      if (c && renderer) renderer.resize(c.clientWidth, c.clientHeight);
    };
    const start = (assets: LoadedAssets, fixture: boolean): void => {
      if (!canvasRef.current) return;
      const capacity = Math.max(600, (benchEnemies ?? 0) + 10);
      const enemySheet = assets.enemies["monster.1002"];
      if (!enemySheet) return;
      renderer = new ArenaRenderer(canvasRef.current, assets.player, enemySheet, { capacity, pixelRatio: benchEnemies !== null ? 1 : window.devicePixelRatio });
      rendererRef.current = renderer;
      renderer.setGround(assets.ground);
      onResize();
      input.attachKeyboard(window);
      if (baseRef.current && knobRef.current) input.attachJoystick(baseRef.current, knobRef.current);
      const fpsCap = params.has("fps") ? Number(params.get("fps")) : undefined;
      const r = renderer;
      loop = new GameLoop(renderer, input, {
        runSeed: Number(params.get("seed") ?? 20261117),
        initialEnemies: benchEnemies ?? 50,
        spawnEveryTicks: benchEnemies !== null ? 1_000_000 : 60,
        grid: assets.grid,
        start: assets.start,
        ...(fpsCap ? { fpsCap } : {}),
        ...(benchEnemies !== null
          ? {
              bench: {
                seconds: Number(params.get("seconds") ?? 8),
                onDone: (b: BenchResult) => {
                  window.__bench = {
                    ...b, buildId: __BUILD_ID__, userAgent: navigator.userAgent, viewport: `${window.innerWidth}x${window.innerHeight}`,
                    pixelRatio: r.renderer.getPixelRatio(), loadMs: b.loopStartMs, assetSource: fixture ? "synthetic-test-fixture" : "fan-local",
                  };
                },
              },
            }
          : {}),
      });
      loop.onStats = setStats;
      const l = loop;
      window.__arena = { hash: () => arenaHash(l.state), tick: () => l.state.tick, enemies: () => l.state.enemies.length, player: () => ({ x: l.state.player.x, y: l.state.player.y, dir: l.state.player.dir }) };
      loop.start();
    };
    void (async () => {
      const conn = await connectFormalGateway();
      if (disposed) return;
      if (!conn.ok) {
        setGatewayText(`尚未連線 · ${conn.health?.fixture ? "fixture 已拒絕" : "無 RO 素材來源"}`);
        setPhase({ kind: "blocked", reason: conn.reason, missing: [] });
        return;
      }
      const fixture = conn.health.fixture === true;
      setGatewayText(fixture ? "已連線 · mode=fan-local · TEST FIXTURE" : "已連線 · mode=fan-local");
      try {
        const assets = await loadFormalAssets(conn.client, fixture);
        if (disposed) return;
        setPhase({ kind: "running", fixture, tolerated: assets.tolerated });
        requestAnimationFrame(() => start(assets, fixture));
      } catch (err) {
        if (err instanceof MissingAssetsError) setPhase({ kind: "blocked", reason: "缺少必要的 RO 素材，正式畫面停止（不以任何替代圖取代）。", missing: err.missing });
        else setPhase({ kind: "blocked", reason: err instanceof Error ? err.message : String(err), missing: [] });
      }
    })();
    window.addEventListener("resize", onResize);
    const key = (e: KeyboardEvent): void => {
      if (e.code === "KeyG") setDebug((d) => !d);
    };
    window.addEventListener("keydown", key);
    return () => {
      disposed = true;
      loop?.stop();
      input.dispose();
      renderer?.dispose();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", key);
    };
  }, []);

  useEffect(() => {
    rendererRef.current?.setDebugOverlay(debug);
  }, [debug]);

  const running = phase.kind === "running";
  return (
    <main class={`game ${running ? "" : "stopped"}`} data-phase={phase.kind}>
      {running ? <canvas ref={canvasRef} class="world" data-testid="world" /> : null}
      <section class="hud">
        <h1 data-testid="project-name">RO Survivor Fan Game</h1>
        <p class="tag">Render bench（test fixture build only）</p>
        {running && phase.fixture ? <p class="fixture" data-testid="fixture-banner">TEST FIXTURE：自動測試用 synthetic 素材，非正式畫面</p> : null}
        <dl>
          <dt>Profile</dt>
          <dd data-testid="build-profile">{__BUILD_PROFILE__}</dd>
          <dt>Build</dt>
          <dd data-testid="build-id"><code>{__BUILD_ID__}</code></dd>
          <dt>Gateway</dt>
          <dd data-testid="gateway-status">{gatewayText}</dd>
          {running ? (
            <>
              <dt>Sim</dt>
              <dd data-testid="sim-stats">{stats ? `${stats.fps.toFixed(0)} FPS · tick p95 ${stats.tickMsP95.toFixed(2)} ms · ${stats.enemies} 敵 · ${stats.drawCalls} draw` : "啟動中…"}</dd>
            </>
          ) : null}
        </dl>
        {running ? <p class="keys">WASD／方向鍵或左下搖桿移動 · G 切換 GAT 可走區</p> : null}
      </section>
      {phase.kind === "blocked" ? (
        <section class="blocked" data-testid="blocked">
          <h2>無法顯示正式畫面</h2>
          <p data-testid="blocked-reason">{phase.reason}</p>
          {phase.missing.length ? <MissingTable missing={phase.missing} /> : null}
          <p class="hint">正式畫面只使用本機 RO 客戶端的原始 SPR／ACT／地圖／音訊。請依 reports/phase1/PHASE1-ACCEPTANCE.md 執行 assets:verify-sources、assets:extract，再用 pnpm dev:fan-local 啟動。</p>
        </section>
      ) : null}
      {running ? (
        <div class="stick" ref={baseRef} data-testid="joystick" aria-label="虛擬搖桿">
          <div class="knob" ref={knobRef} />
        </div>
      ) : null}
    </main>
  );
}
