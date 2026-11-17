import { useEffect, useState } from "preact/hooks";
import type { AssetGatewayHealth } from "@ro-survivor/asset-contracts";
import { createStartupGateway } from "./gateway.ts";

const gateway = createStartupGateway(__BUILD_ID__);

export function App() {
  const [health, setHealth] = useState<AssetGatewayHealth | null>(null);
  useEffect(() => {
    gateway.health().then(setHealth, () => setHealth(null));
  }, []);

  return (
    <main class="shell">
      <h1 data-testid="project-name">RO Survivor Fan Game</h1>
      <p class="tagline">非官方、非營利 RO 同人倖存者遊戲 · 開發中（Phase 0）</p>
      <dl class="facts">
        <dt>Build profile</dt>
        <dd data-testid="build-profile">{__BUILD_PROFILE__}</dd>
        <dt>Build ID</dt>
        <dd data-testid="build-id">
          <code>{__BUILD_ID__}</code>
        </dd>
        <dt>Asset gateway</dt>
        <dd data-testid="gateway-status" data-mode={health?.mode ?? "unknown"}>
          {health ? `尚未連線 · mode=${health.mode}` : "檢查中…"}
          <small>{gateway.reason}</small>
        </dd>
      </dl>
      <p class="notice">
        本作與 Gravity、其授權營運商及 RO Survivors／Reven4nt 無關，亦未獲其授權。RO 素材僅於使用者本機
        fan-local 模式由自有客戶端載入，不隨本專案散布。
      </p>
    </main>
  );
}
