import { useEffect, useRef, useState } from "preact/hooks";
import type { AssetGatewayHealth } from "@ro-survivor/asset-contracts";
import { arenaHash } from "@ro-survivor/core-sim";
import { createStartupGateway } from "./gateway.ts";
import { loadAssets } from "./game/assets.ts";
import { InputState } from "./game/input.ts";
import { GameLoop, type BenchResult, type LoopStats } from "./game/loop.ts";
import { ArenaRenderer } from "./game/renderer.ts";

declare global {
  interface Window {
    __bench?: BenchResult & { buildId: string; userAgent: string; viewport: string; pixelRatio: number; loadMs: number; assetSource: string };
    __arena?: { hash(): string; tick(): number; enemies(): number };
  }
}

const params = new URLSearchParams(location.search);
const benchEnemies = params.has("bench") ? Number(params.get("bench")) : null;

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const [health, setHealth] = useState<AssetGatewayHealth | null>(null);
  const [reason, setReason] = useState<string>("");
  const [stats, setStats] = useState<LoopStats | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
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
    void (async () => {
      const gateway = await createStartupGateway(__BUILD_ID__);
      setReason(gateway.reason ?? "");
      setHealth(await gateway.health().catch(() => null));
      const assets = await loadAssets(gateway);
      if (disposed || !canvasRef.current) return;
      setNotes(assets.notes);
      const capacity = Math.max(600, (benchEnemies ?? 0) + 10);
      renderer = new ArenaRenderer(canvasRef.current, assets.player, assets.enemy, { capacity, pixelRatio: benchEnemies !== null ? 1 : window.devicePixelRatio });
      rendererRef.current = renderer;
      renderer.setGround(assets.ground);
      onResize();
      input.attachKeyboard(window);
      if (baseRef.current && knobRef.current) input.attachJoystick(baseRef.current, knobRef.current);
      const fpsCap = params.has("fps") ? Number(params.get("fps")) : undefined;
      loop = new GameLoop(renderer, input, {
        runSeed: Number(params.get("seed") ?? 20261117),
        initialEnemies: benchEnemies ?? 50,
        spawnEveryTicks: benchEnemies !== null ? 1_000_000 : 60,
        grid: assets.grid,
        ...(assets.start ? { start: assets.start } : {}),
        ...(fpsCap ? { fpsCap } : {}),
        ...(benchEnemies !== null
          ? {
              bench: {
                seconds: Number(params.get("seconds") ?? 8),
                onDone: (r: BenchResult) => {
                  window.__bench = {
                    ...r, buildId: __BUILD_ID__, userAgent: navigator.userAgent, viewport: `${window.innerWidth}x${window.innerHeight}`,
                    pixelRatio: renderer?.renderer.getPixelRatio() ?? 1, loadMs: Math.round(performance.now()), assetSource: assets.player.source,
                  };
                },
              },
            }
          : {}),
      });
      loop.onStats = setStats;
      const l = loop;
      window.__arena = { hash: () => arenaHash(l.state), tick: () => l.state.tick, enemies: () => l.state.enemies.length };
      loop.start();
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

  return (
    <main class="game">
      <canvas ref={canvasRef} class="world" data-testid="world" />
      <section class="hud">
        <h1 data-testid="project-name">RO Survivor Fan Game</h1>
        <p class="tag">非官方、非營利同人 · Phase 1 技術尖峰</p>
        <dl>
          <dt>Profile</dt>
          <dd data-testid="build-profile">{__BUILD_PROFILE__}</dd>
          <dt>Build</dt>
          <dd data-testid="build-id"><code>{__BUILD_ID__}</code></dd>
          <dt>Gateway</dt>
          <dd data-testid="gateway-status" data-mode={health?.mode ?? "unknown"}>
            {health ? (health.mode === "fan-local" ? "已連線 · mode=fan-local" : `尚未連線 · mode=${health.mode}`) : "檢查中…"}
          </dd>
          <dt>Sim</dt>
          <dd data-testid="sim-stats">
            {stats ? `${stats.fps.toFixed(0)} FPS · tick p95 ${stats.tickMsP95.toFixed(2)} ms · ${stats.enemies} 敵 · ${stats.drawCalls} draw` : "載入中…"}
          </dd>
        </dl>
        {reason ? <p class="reason" data-testid="gateway-reason">{reason}</p> : null}
        {notes.length ? <p class="reason">{notes.join(" · ")}</p> : null}
        <p class="keys">WASD／方向鍵或左下搖桿移動 · G 切換 GAT 可走區</p>
      </section>
      <div class="stick" ref={baseRef} data-testid="joystick" aria-label="虛擬搖桿">
        <div class="knob" ref={knobRef} />
      </div>
    </main>
  );
}
