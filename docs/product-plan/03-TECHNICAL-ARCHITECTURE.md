# RO 倖存者同人技術架構

本架構以瀏覽器優先、手機可玩、單人先完成、多人後加入為原則。戰鬥模擬與畫面完全分離，同一個 replay 可以在無畫面的測試程序、瀏覽器客戶端與未來專用房間伺服器中得到相同結果。

# 技術決策

## 第一階段固定技術

| 領域 | 選擇 | 理由 |
| --- | --- | --- |
| Runtime | 使用本機已有的 Node.js 24.21.x，專案以 `.nvmrc` 與 `engines` 鎖定 | 與現有 roBrowser 工具相容，避免任意升級 |
| Monorepo | pnpm workspace | 共用型別、內容資料與測試，安裝體積較小 |
| Client | Vite、TypeScript strict、Preact | 建置快速；DOM UI 可做無障礙與觸控，不增加第二個 WebGL context |
| World renderer | Three.js WebGL2，正交相機 | 能呈現 RO 的 3D 地形／模型與 2D billboard 角色 |
| Simulation | 自寫 fixed-step TypeScript core | 倖存者戰鬥規則簡單，容易做決定性測試與 replay |
| Local persistence | IndexedDB，經版本化 repository 封裝 | 適合 PWA、大量裝備與設定；不使用 localStorage 存主進度 |
| Validation | Zod 或等價 runtime schema | 內容、存檔與網路訊息都要在邊界驗證 |
| Unit tests | Vitest | 與 Vite／TypeScript 整合 |
| Browser tests | Playwright | 鍵鼠、觸控 viewport、PWA、存檔與截圖驗收 |
| License | GPLv3 | 直接重用 roBrowserLegacy GPL 程式時維持授權相容 |

不要在 Phase 0 自動追最新版。先記錄當日相容版本，產生 lockfile，之後的升級各自開 PR／工作分支驗證。

## 後期才加入

| 領域 | 建議 | 啟用條件 |
| --- | --- | --- |
| HTTP API | Fastify 或同級 TypeScript server | 本機存檔與 MVP 穩定後 |
| Multiplayer rooms | Colyseus 或自建權威 WebSocket room | Phase 6 網路 spike 通過後 |
| Database | PostgreSQL | 帳號、雲端存檔與物品履歷上線時 |
| Ephemeral state | Redis | 媒合、presence、rate limit 或多節點時 |
| Object storage | S3 相容儲存 | replay、崩潰報告或自有素材包需要時 |

多人框架版本要在 Phase 6 重新查官方文件與相容性，不能現在把舊版範例固定進正式碼。

# 專案結構

```text
RO-Survivor-FanGame/
  apps/
    client/                  # PWA、Three.js 世界、Preact UI
    asset-gateway/           # 本機 GRF 閘道，GPL，預設只綁 loopback
    server/                  # Phase 5 後的帳號與權威房間
    admin/                   # Phase 7 後的客服、封鎖與經濟查詢
  packages/
    core-sim/                # 無 DOM、無 Three、可決定性重播的戰鬥核心
    content-schema/          # 職業、技能、魔物、關卡、掉落、文字 schema
    content-ro/              # 本作 RO 同人內容資料，不放原始素材
    asset-contracts/         # manifest、gateway protocol、cache keys
    ro-format-runtime/       # 經 GPL notice 移植的 SPR/ACT/地圖解析
    renderer-three/          # 地圖、billboard、VFX、camera、LOD
    input/                   # 鍵鼠、觸控、手把 → InputCommand
    persistence/             # IndexedDB 與未來 cloud repository
    protocol/                # API／WebSocket 訊息及版本
    telemetry/               # 可關閉、最小化的效能與平衡事件
    testkit/                 # fake clock、seed、fixture、replay assertions
  assets/
    manifests/
    placeholders/
  content/
    jobs/
    skills/
    monsters/
    stages/
    items/
    cards/
    pets/
    locales/zh-TW/
    locales/en/
  tools/
    scan-assets/
    build-atlas/
    build-stage/
    build-wiki/
    balance-sim/
    replay-verify/
  docs/
  licenses/
```

# 執行時分層

```text
Input adapters
  ↓ InputCommand
Deterministic simulation core
  ↓ immutable RenderSnapshot and GameEvent
Three.js renderer          Preact UI          Audio mixer
  ↑ asset handles             ↑ view model       ↑ sound event
Local asset gateway and cache

Simulation state
  ↓ SaveRepository interface
IndexedDB now / Cloud repository later
```

核心原則：畫面、音效與 UI 可以漏幀，但模擬時間、碰撞、掉落及 RNG 不能跟著 frame rate 改變。

# 決定性戰鬥核心

## 時間

- 模擬固定 60 tick／秒。
- `requestAnimationFrame` 只決定畫面何時畫，不直接推動遊戲規則。
- 每 frame 最多補 5 個 simulation tick；超過時進入降畫質，不無限追趕造成 spiral of death。
- 暫停、選卡與結算是明確 state machine，不靠把 `deltaTime` 設為 0 的副作用。

## 隨機

- 每局保存 `runSeed`、內容版本與難度設定。
- 使用明確、跨平台結果固定的 PRNG；不得用 `Math.random()` 決定掉落、升級或生成。
- 每個系統使用分流 seed，例如 `spawn`、`draft`、`loot`、`boss`，避免新增一個視覺隨機就改變掉落結果。
- Replay 保存玩家輸入與重要選擇，不逐 frame 保存所有座標。

## 實體與效能

- 敵人、投射物、掉落、傷害區與 VFX 使用物件池。
- 高頻元件使用 dense arrays 或 typed arrays；UI 與低頻資料可用普通物件。
- 空間查詢使用固定 cell 的 spatial hash。生成、鎖敵、範圍傷害與碰撞不得遍歷全場所有實體。
- 敵人 AI 分時更新：近距敵人每 tick，遠距低威脅敵人可每 2 至 4 tick。
- 視覺實體可被 cull；模擬實體不能因離開相機就消失，除非關卡規則明確回收。

## 座標與碰撞

- 世界單位固定為公尺；角色腳底中心是位置。
- 普通碰撞以圓形與 capsule 為主，不用複雜物理引擎。
- GAT 可走資料轉成簡化 nav grid；地圖裝飾碰撞由白名單決定。
- 玩家和大量怪物之間使用柔性分離，不能讓怪物形成完全不可穿越的數值牆。
- 地形、生成點、首領房與安全區在 `stage.json` 中明確定義。

## 預警與傷害共用資料

首領招式由一個 timeline 定義：

```ts
type TelegraphSpec = {
  id: string;
  shape: Circle | Cone | Segment | Ring;
  origin: OriginRule;
  windupTicks: number;
  activeTicks: number;
  recoveryTicks: number;
  damage: DamageFormulaId;
  hitPolicy: "once" | "interval";
};
```

Renderer 用同一個 `shape` 畫預警，simulation 用同一個 `shape` 判定命中。禁止另寫一套近似半徑。

# 渲染架構

## 地圖

- GND 轉地形 mesh 與 texture atlas。
- RSW 轉世界物件、燈光、音效區與出生基準。
- RSM／RSM2 轉 Three.js geometry；相同模型使用 InstancedMesh 降低 draw calls。
- GAT 只提供可走與高度資訊，不直接當視覺地面。
- 桌機可旋轉相機；手機預設固定角度以降低 shader、排序與操作成本，設定中可開啟旋轉。

## 角色與魔物

- SPR／ACT 在載入期解碼成 atlas 與 animation metadata。
- Billboard 依相機與移動方向選擇 8 方向動畫。
- 相同 atlas、blend mode 與 shader 的實體批次繪製。
- 鏡像方向使用 UV flip，不建立第二份 texture。
- 影子使用簡單橢圓 decal；飛行高度獨立於碰撞位置。
- hit flash、染色與透明度使用 instance attributes，不複製材質。

## 特效

- VFX 由 `GameEvent` 觸發，不讀 simulation 私有狀態。
- 粒子使用固定容量 ring buffer；容量滿時淘汰低優先級效果，不增加陣列。
- 首領預警、玩家受擊與危險投射物永遠高於裝飾特效。
- 低畫質停用螢幕震動、地面殘留、次要拖尾與高解析爆炸。
- 同一時間的傷害字合併；超過上限改顯示累計數字。

## UI

- HUD 以 Preact／DOM 呈現，戰鬥 tick 不觸發整棵 UI 重渲染。
- 以 selector 訂閱低頻 view model；HP、經驗條等每 frame 最多更新一次。
- 觸控目標至少 44×44 CSS px，支援 `safe-area-inset-*`。
- Tooltip 在手機改為可捲動底部面板，不可超出畫面。
- 選卡支援觸控、鍵鼠、手把焦點及數字鍵。

# 輸入契約

```ts
type InputCommand = {
  tick: number;
  sequence: number;
  moveX: number;       // normalized -1..1
  moveY: number;
  confirm?: boolean;
  cancel?: boolean;
  draftIndex?: 0 | 1 | 2;
  pause?: boolean;
};
```

- 鍵盤、點地、虛擬搖桿與手把都只產生 `InputCommand`。
- 點地移動先轉成方向，不把螢幕座標直接送入 simulation。
- 手把斷線時回到鍵鼠／觸控，不讓角色保留最後移動方向。
- 手機若接上實體手把，可隱藏虛擬搖桿。

# 內容資料

## 單一真相來源

每個技能、魔物、裝備與關卡都是版本化資料，而不是散落在程式碼的 magic number。建置時由 schema 產生：

- runtime content bundle
- 繁中與英文 tooltip
- 遊戲內百科
- 平衡試算表輸出
- patch note 差異草稿
- 測試 fixture

## 技能範例

```json
{
  "id": "swordman.magnum_break",
  "contentVersion": 1,
  "displayNameKey": "skill.swordman.magnum_break.name",
  "tags": ["melee", "fire", "area"],
  "cooldownTicks": 420,
  "castTicks": 18,
  "targeting": { "type": "self" },
  "effect": {
    "shape": { "type": "circle", "radius": 3.2 },
    "damageFormula": "swordman.magnum_break.v1",
    "knockback": 0.8
  },
  "upgradePool": [
    "swordman.magnum_break.radius",
    "swordman.magnum_break.cooldown",
    "swordman.magnum_break.burn"
  ]
}
```

本作數值與效果由自己的資料定義。RO 名稱與視覺可沿用於同人版，但不得把舊私服技能說明直接當成新效果說明。

# 存檔

## 本機存檔

IndexedDB 至少分成：

- `profiles`
- `characters`
- `inventory`
- `cards`
- `pets`
- `stageProgress`
- `achievements`
- `settings`
- `runRecovery`
- `migrations`

每次結算先寫入 append-only `runResult`，再在單一 transaction 套用角色與物品變更。瀏覽器中途關閉時，只能恢復到最後已提交的 checkpoint，不能生成兩份戰利品。

## 版本與遷移

- 存檔包含 `schemaVersion`、`contentVersion`、`buildId`。
- 每次遷移先複製舊記錄到有限保留的 backup store。
- 遷移必須可在 fixture 上重複執行，第二次不得再次增加物品或經驗。
- 匯入／匯出使用簽章 JSON；不要讓玩家手動編輯後直接進入公開經濟。

# PWA 與離線

- App shell、程式與占位素材可由 service worker 快取。
- RO 素材由本機 gateway／cache 供應，不寫死進 service worker 公開 precache。
- 更新採版本提示，不在戰鬥中自動 reload。
- 新版內容下載完成後，玩家回城才切換 build。
- 單人遊戲不依賴社交伺服器；未來雲端故障時仍可使用最後同步的本機角色，但不可進行交易或排行。

# 多人與雲端架構

## 帳號與同步

- Phase 5 才建立帳號；密碼使用現代 password hash，或採 OAuth／passkey，不沿用舊私服 MD5。
- 每個雲端變更有 idempotency key 與 server revision。
- 衝突不做靜默 last-write-wins；裝備與貨幣由伺服器決定，本機只保留快取。

## 三人合作

- 使用 dedicated room server，20 Hz 權威 simulation。
- 客戶端送 input sequence；只預測自己的移動與非關鍵視覺。
- 伺服器送 10 至 20 Hz delta snapshot；客戶端插值其他玩家與敵人。
- 掉落、傷害、升級與首領狀態由伺服器產生。
- 隊友斷線保留短暫 reconnect window；怪物不得瞬移到存活玩家身邊。
- 房間建立前選地區；記錄 RTT、jitter、丟包與 desync 指標。

## 公開經濟

只有在交易階段才需要：

- 每件物品全域唯一 ID
- 取得、精煉、插卡、拆卡、交易、販售的 append-only 履歷
- 帳號年齡、好友時間、每日次數與速率限制
- 交易前後 server transaction 與雙方確認版本
- 管理後台可按 item ID 追溯完整來源
- 異常交易不直接刪資料，先標記、凍結與保留證據

# 效能預算

## 垂直切片目標

| 指標 | 手機目標 | 桌機目標 |
| --- | ---: | ---: |
| 模擬敵人 | 250 | 600 |
| 同時投射物 | 300 | 1,000 |
| 高優先 VFX 粒子 | 1,000 | 4,000 |
| 畫面 FPS p95 | ≥ 30 | ≥ 60 |
| simulation tick p95 | < 8 ms | < 4 ms |
| 首圖冷啟動 | < 12 秒 | < 6 秒 |
| 進關後額外素材 | < 25 MiB | < 50 MiB |
| JS heap 目標 | < 220 MiB | < 500 MiB |
| GPU texture 目標 | < 160 MiB | < 512 MiB |

這些是驗收目標，不是假定已達成的數字。每次測試都記錄裝置、瀏覽器、畫質、關卡 seed 與 build ID。

## 自動降階順序

1. 降低次要粒子與傷害字。
2. 停用拖尾、地面殘留與螢幕震動。
3. 降低 atlas 解析度與渲染 pixel ratio。
4. 降低遠距 AI 視覺更新率。
5. 保留預警、玩家、危險投射物、首領與 HP 回饋。

不得降低 simulation tick、碰撞精度或危險預警來換 FPS。

# 安全與隱私

- 本機 asset gateway 預設只綁 `127.0.0.1`。開私人 LAN 前要列出確切網段與防火牆規則。
- 不記錄密碼、完整 session token、GRF 路徑中的個人資料或聊天內容到一般 log。
- 崩潰報告預設先在本機顯示，玩家同意後才傳送。
- 遙測只記效能與平衡事件，不做廣告追蹤。
- 所有 API、WebSocket 訊息、存檔匯入與內容 bundle 都做 schema 驗證、大小限制與 rate limit。
- 管理後台使用獨立權限、稽核記錄與強制二次驗證。

# 架構驗收條件

架構 spike 必須證明：

1. 不啟動 asset gateway 時，客戶端能用占位素材進入測試場。
2. 啟動 gateway 後，能載入劍士與一種魔物的 SPR／ACT，8 方向與 pivot 正確。
3. 同一 seed、同一輸入在瀏覽器與 headless Vitest 產生相同 final state hash。
4. Renderer 被完全移除時，核心模擬測試仍可執行。
5. 人為把 frame rate 限制在 15、30、60 FPS 時，60 秒後的模擬結果一致。
6. 首領圓形、扇形與直線預警的視覺參數與命中參數由同一 object 產生。
7. `.grf` 或 `local-fan-use` 衍生素材不會出現在 Git index 或一般 release archive。

