# GitHub Cloud 與本機素材接線流程

本文件只在 Claude 透過 GitHub／雲端工作時生效，並覆寫其他文件中的 Windows 施工位置與本機檔案檢查。遊戲規格、權利邊界、Phase 範圍和測試要求仍維持不變。

## 路徑覆寫

- GitHub checkout 的 repository root 就是新遊戲專案根目錄。
- 不建立或存取 `C:\Users\user\Documents\ChatGPT\RO-Survivor-FanGame`。
- `docs/product-plan` 已在 repo，不需再次複製。
- 所有 Windows 絕對路徑只視為未來本機接線參考；程式碼與 committed config 不得寫死它們。
- 真實路徑只允許出現在被 ignore 的 `.env.local` 或 `local-asset-lock.json`。

## Claude 在雲端可以完成的工作

1. pnpm monorepo、TypeScript strict、Vite／Preact client、core-sim、content-schema、testkit。
2. deterministic fixed-step simulation、PRNG、state hash 與 replay tests。
3. `AssetGateway` 契約、`PlaceholderAssetGateway`、loopback `HttpAssetGatewayClient`。
4. 合成測試 fixture：用程式產生最小 SPR／ACT／GAT／GND／RSW-like fixture；不得從官網或其他 repo 找 RO 二進位代替。
5. manifest／content seed schema 驗證、CP949 path round-trip、URI normalization。
6. placeholder test arena、UI、輸入 adapter、CI、rights:check。
7. 寫好本機 source hash 驗證與白名單抽取命令，但不宣稱已對真實 GRF 執行。

## Claude 在雲端不能宣稱完成的工作

- 實際讀取 `data.grf`、`rdata.grf` 或 BGM 目錄。
- 真實劍士／怪物的 SPR／ACT 動畫與 pivot 視覺驗收。
- `prt_fild08` 的實際 RSW／GND／GAT／RSM dependency rendering。
- 真實 RO 音效、BGM、atlas 或 contact sheet。
- Windows、iPhone Safari 或私人 LAN 的實機驗收。

上述項目必須標記 `DEFERRED_LOCAL`，不得寫成 `PASS` 或以 mock 冒充。

## 雙層驗收狀態

每一個素材相關 gate 都拆成：

- `CLOUD_PASS`：契約、placeholder、synthetic fixture、錯誤處理與 CI 通過。
- `LOCAL_PASS`：使用者電腦以白名單和指定 GRF hash 執行，產生真實證據。
- `FAIL`：已執行但不符合預期。
- `DEFERRED_LOCAL`：雲端無法執行，已提供可複現命令與期望輸出。

Phase 0 可在所有 cloud gate 為 `CLOUD_PASS`、本機 gate 正確標成 `DEFERRED_LOCAL` 時完成雲端交工。Phase 1 整體不得宣稱完成，直到真實素材 gate 取得 `LOCAL_PASS`。

## 必須實作的素材介面

```ts
type AssetSourceMode = "placeholder" | "fan-local";

interface AssetGateway {
  mode(): AssetSourceMode;
  getBinary(assetId: string, signal?: AbortSignal): Promise<ArrayBuffer>;
  getJson<T>(assetId: string, signal?: AbortSignal): Promise<T>;
  resolvePath(assetId: string): Promise<string>;
  getSourceHash(sourceId: "data.grf" | "rdata.grf" | "bgm"): Promise<string | null>;
  health(): Promise<{
    ok: boolean;
    mode: AssetSourceMode;
    buildId: string;
    sourceHashes: Record<string, string | null>;
  }>;
}
```

要求：

- `PlaceholderAssetGateway` 在 GitHub CI 永遠可用，且不需要網路。
- `HttpAssetGatewayClient` 預設只接受 `http://127.0.0.1:<port>`；非 loopback 必須由明確的 LAN profile 開啟。
- asset ID 必須存在 `handoff/fan-local-asset-whitelist.csv`；未知 ID 在送出 HTTP 前就拒絕。
- response 必須有限制 bytes、timeout、content type 與 source hash。
- gateway 離線時顯示設定指引並回退 placeholder，不讓 simulation 或存檔崩潰。

## GitHub CI 素材策略

CI 只執行：

```text
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm rights:check
pnpm assets:test-synthetic
```

CI 不下載 GRF、不呼叫 RO Survivors／HANS、不連使用者電腦，也不把 placeholder 測試寫成真實素材驗收。

## Claude 必須建立的本機命令

命令名稱可依實際 package 調整，但功能不可缺：

```text
pnpm assets:verify-sources
  - 讀 RO_ASSET_SOURCE_DATA_GRF、RO_ASSET_SOURCE_RDATA_GRF、RO_ASSET_BGM_DIR
  - 比對企劃中鎖定的 SHA-256
  - 不符合就停止，不自動更新 lock

pnpm assets:audit-whitelist
  - 驗證 48 筆 asset ID、CP949 raw hex、normalized URI、bytes 與格式 magic
  - 不枚舉或抽取白名單以外的素材

pnpm assets:extract --profile fan-local
  - 只輸出到 .local-assets/<source-hash>/<converter-version>/
  - 產生 output hash、metadata、dependency report 與 contact sheet

pnpm dev:fan-local
  - 先啟動只綁 127.0.0.1 的 asset gateway
  - 再啟動 client
  - gateway 不存在時改用 placeholder 並顯示原因
```

`.env.example` 只放變數名稱與假值：

```dotenv
RO_ASSET_SOURCE_DATA_GRF=C:\path\to\data.grf
RO_ASSET_SOURCE_RDATA_GRF=C:\path\to\rdata.grf
RO_ASSET_BGM_DIR=C:\path\to\BGM
RO_ASSET_GATEWAY_HOST=127.0.0.1
RO_ASSET_GATEWAY_PORT=4178
```

## 本機接線順序

Claude 完成 cloud Phase 0 後，使用者在 Windows：

1. checkout Claude 的工作 branch。
2. 建立 `.env.local` 指向既有 RO 素材；不得提交。
3. 執行 `assets:verify-sources`，取得三個 source hash 證據。
4. 執行 `assets:audit-whitelist`，取得 48 筆成功／失敗表。
5. 先抽取劍士、Poring、Mastering 與 `prt_fild08` 技術尖峰。
6. 用 contact sheet、地圖 screenshot、GAT debug view、state hash 和效能報告完成 `LOCAL_PASS`。
7. 確認 `git status` 沒有任何官方或衍生素材後，才把報告與程式提交；報告不得內嵌素材大圖。

## 雲端 Claude 的第一輪停止點

Claude 現在只執行 Phase 0。交工時必須清楚分列：

- 已完成的 `CLOUD_PASS`。
- 等待使用者電腦的 `DEFERRED_LOCAL`。
- 本機要執行的精確命令。
- 沒有進 Git 的素材／secrets 掃描結果。

不得因沒有官方素材而自行抓取網站 bundle、第三方素材包或其他私服 client。

