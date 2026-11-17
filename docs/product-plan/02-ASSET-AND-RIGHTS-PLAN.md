# RO 倖存者同人素材與權利管理計畫

本作的 `fan-local` 版本直接使用使用者上次下載的 RO 官方客戶端素材，但不把數 GB 的 GRF 再複製進新專案。遊戲程式只保存素材 ID、白名單與轉換規則；開發時由本機閘道讀取 GRF，產生的快取也保持在 Git 之外。

這個做法同時解決三個問題：避免重複佔用數十 GB、保護上次私服成果不被 Claude 改壞，以及讓程式與素材能獨立測試及替換。

首版精確白名單已完成，位於 `handoff/fan-local-asset-whitelist.csv`。它是 Phase 1 唯一允許的素材清單，不再由 Claude 自行搜尋 GRF。首版內容 ID、技能來源與本作原創平衡 seed 位於 `handoff/vertical-slice-content-seed.json`。

已驗證的首版組合是 `prt_fild08`（rAthena map index 201）、`BGM/12.mp3`〈Streamside〉、劍士男女 body／hair 1／單手劍／Guard，以及 12 組怪物 SPR／ACT。三個地圖檔與所有列出的 SPR／ACT 都在 `data.grf`，`rdata.grf` 沒有同名覆蓋。轉檔器必須同時支援 ACT 2.4 與 2.5；`CHONCHON` 的實際 basename 是 `chocho`，`WILOW` 保留歷史拼字 `wilow`。Rocker 1052、Vocal 1088 與 Metaller 1058 不可按翻譯名稱猜測，必須以數字 ID 對應。

# 現有素材清冊

## 主要目錄

| 路徑 | 規模 | 內容 | 本作用途 |
| --- | ---: | --- | --- |
| `C:\Users\user\Downloads\RO-Amatsu` | 約 8.45 GiB、16,958 檔 | 天津 rAthena 私服、原生客戶端、繁中內容、串流工具 | 唯讀參考；不在此施工 |
| `C:\Users\user\Downloads\RO-Server` | 約 24.85 GiB、33,678 檔 | 舊私服、瀏覽器客戶端、官方遊戲檔、繁中資料、自訂職業 | 主要素材與工具來源；唯讀 |

## 主素材庫

以 `C:\Users\user\Downloads\RO-Server\browser-research\client-assets\kro2021` 為唯一 canonical source，避免又複製 `RO-Amatsu\client` 內相同檔案。

| 檔案 | 大小 | SHA-256 | 原始項目 |
| --- | ---: | --- | ---: |
| `data.grf` | 2,966,717,458 bytes | `FA3B7BBDBD650C3468ECA5E978A44E7A848D533F2735E6F5AF2B668E1D1DC3B6` | 136,112 |
| `rdata.grf` | 306,697,843 bytes | `FA6367B8ABC5D1297DE742A127CFF4E1DA626AB3D6B1B0A81BA563CB3CB5124E` | 24,740 |
| `BGM` | 約 323.59 MiB | 由 Phase 0 產生逐檔 manifest | 185 首 MP3 |

兩個 GRF 使用 CP949 路徑。現有資產閘道已能建立 489,252 個正規化／覆蓋層索引；原始項目合計 160,852。

## GRF 類型統計

| 類型 | data.grf | rdata.grf | 典型用途 |
| --- | ---: | ---: | --- |
| `.spr` | 31,328 | 6,039 | 人物、魔物、NPC、掉落物與特效精靈 |
| `.act` | 39,000 | 6,462 | 動作、幀、方向、pivot、音效事件 |
| `.bmp` | 40,709 | 6,938 | UI、圖示、地面與模型貼圖 |
| `.tga` | 6,201 | 3,196 | 特效及模型貼圖 |
| `.rsm/.rsm2` | 7,922 | 599 | 場景物件與 3D 模型 |
| `.str` | 1,656 | 769 | 粒子與技能特效 |
| `.wav` | 2,743 | 280 | 攻擊、命中、魔物與 UI 音效 |
| `.gat/.gnd/.rsw` | 各 895 | 各 23 | 地圖碰撞、地面與世界配置 |
| `.pal` | 2,577 | 232 | 角色、服裝與髮色調色盤 |

主要路徑：

- 魔物：`data/sprite/몬스터`
- NPC：`data/sprite/npc`
- 玩家職業：`data/sprite/인간족`
- 道具地面圖：`data/sprite/아이템`
- 盾牌、武器與頭飾：`data/sprite/방패`、`data/sprite/악세사리` 及相鄰分類
- 技能與環境特效：`data/texture/effect`、`data/sprite/이팩트`、`.str`

台灣 2026 客戶端也保存在 `client-assets\extracted\app`，但 GRF 採現有 loader 不支援的 Event Horizon 格式。第一階段只使用其中已核對的文字資料，不把它當圖像主來源。

## 已整理的繁中資料

位置：`C:\Users\user\Downloads\RO-Server\browser-research\remote-client\data\zh-TW`

| 檔案 | 數量 | 用途 |
| --- | ---: | --- |
| `items.json` | 20,442 | 道具名稱與說明候選 |
| `maps.json` | 1,131 | 地圖名稱 |
| `quests.json` | 9,629 | 任務文字；首版不匯入全部 |
| `npcnames.json` | 1,607 | NPC 名稱 |
| `npctext.json` | 28,474 精確對照、363 模板 | NPC 顯示文字候選 |
| `msgstringtable*.txt` | 4,023 索引 | 原生 UI 訊息參考 |

每筆匯入文字仍要記錄來源版本與是否適用本作。不能因為已翻成繁中就假設數值說明與本作效果相同；本作技能、裝備與系統說明由自己的內容資料生成。

# 可使用的開源工具

## roBrowserLegacy

位置：`C:\Users\user\Downloads\RO-Server\browser-research\roBrowserLegacy`

- commit `5435cf67642eac8281f9a7a94c92f98428db471e`
- GPLv3
- ES Modules、WebGL、Vite、Web Workers
- 已有 SPR、ACT、地圖、模型、STR 特效、音效、行動裝置輸入與檢視器
- 現有工作樹包含 13 個已修改檔與多個未追蹤檔，絕對不可在原目錄清理或 reset

優先研究或移植的模組：

- `src/Loaders/Sprite.js`
- `src/Loaders/Action.js`
- `src/Renderer/SpriteRenderer.js`
- `src/Renderer/Entity/*`
- `src/Renderer/EffectManager.js`
- `src/Renderer/Effects/StrEffect.js`
- `src/Audio/SoundManager.js`
- `src/Audio/BGM.js`
- `src/Core/Mobile.js`
- `src/App/GrfViewer.js`
- `src/App/EffectViewer.js`

若直接移植 GPL 程式，本同人客戶端採 GPLv3 並保留原作者、修改日期、LICENSE、NOTICE 與對應源碼。不得只複製片段後刪除授權標示。

## GRF 資產閘道

位置：`C:\Users\user\Downloads\RO-Server\browser-research\remote-client`

- commit `cd51fcab453444ae5d9a1028b677fe0c56a32ca6`
- Node、Express、`@chicowall/grf-loader`
- GPLv3
- 已配置 `data.grf`、`rdata.grf` 與繁中覆蓋層
- `index.js` 有本機修改，原目錄只啟動、不編輯

第一階段把它當外部唯讀服務。若新作需要不同 API，在新 repo 另建 `apps/asset-gateway`，明確複製所需 GPL 檔案並記錄來源；不可直接改舊服務。

## rAthena

位置：`C:\Users\user\Downloads\RO-Amatsu\server`

rAthena 是 GPLv3 的 MMO 伺服器與資料庫，可提供魔物屬性、種族、體型、掉落、技能 ID、卡片、裝備與狀態概念。它不適合直接改成倖存者戰鬥後端。Phase 0 只把核准欄位轉成設計種子，所有倖存者數值另存於本作的版本化內容 schema。

# 素材隔離與目錄

新專案使用以下結構：

```text
RO-Survivor-FanGame/
  apps/
    client/
    asset-gateway/
  packages/
    asset-contracts/
    ro-format-runtime/
    content/
  assets/
    manifests/             # 可提交；只含 ID、來源路徑、雜湊與權利狀態
    placeholders/          # 可提交；測試占位素材
  .local-assets/           # 不可提交；GRF 衍生快取
  licenses/
    GPL-3.0.txt
    THIRD-PARTY-NOTICES.md
  tools/
    scan-assets/
    build-atlas/
    validate-assets/
```

`.gitignore` 至少阻擋：

```text
.local-assets/
*.grf
*.gpf
*.rgz
*.spr
*.act
*.rsm
*.rsm2
*.gnd
*.gat
*.rsw
*.str
assets/raw-audio/
```

再加一個 `pnpm rights:check`，直接掃 Git index 與發行輸出，而不是只依賴 `.gitignore`。

# Asset manifest

每個正式使用的素材必須有一筆記錄。建議 schema：

```json
{
  "assetId": "monster.poring.body",
  "kind": "sprite-animation",
  "sourceProfile": "fan-local",
  "sourceArchive": "kro2021/data.grf",
  "sourcePath": "data/sprite/<cp949-path>.spr",
  "companionPaths": ["data/sprite/<cp949-path>.act"],
  "sourceSha256": "pending-phase-0",
  "owner": "Gravity and related rights holders",
  "licenseClass": "local-fan-use",
  "redistribution": "not-cleared",
  "attribution": "required",
  "transform": {
    "palette": "default",
    "scale": 1,
    "pivotProfile": "monster-ground-center",
    "atlasGroup": "field-01-monsters"
  },
  "output": {
    "atlas": ".local-assets/field-01/monsters.webp",
    "metadata": ".local-assets/field-01/monsters.json"
  },
  "reviewedBy": null,
  "reviewedAt": null
}
```

允許的 `licenseClass`：

- `project-code-gpl-3.0`
- `third-party-permissive`
- `local-fan-use`
- `public-use-cleared`
- `original-project-owned`
- `unknown-quarantine`

`unknown-quarantine` 永遠不能進入任何遊戲建置。

# 素材施工流程

## Step 1 固定來源

1. 驗證兩個 canonical GRF 的 SHA-256 與上表一致。
2. 建立 `assets/source-lock.json`，記錄絕對來源、大小、雜湊、編碼與日期。
3. 不修改、不重新壓縮、不重新命名來源 GRF。
4. 若雜湊不同，停止導入並產生差異報告，不自動接受新檔。

## Step 2 建立白名單

1. 垂直切片只選劍士男／女身體、必要髮型、武器、盾牌、10 種魔物、2 種菁英、Mastering、經驗物件、補品、1 張地圖與必要特效。
2. 用 GRF Viewer 逐項確認動畫、方向、色盤與缺幀。
3. 每個選定素材填入 manifest；不得用整個資料夾萬用規則匯入。
4. 將缺檔、亂碼、錯誤 palette 或 ACT 版本寫入 `assets/reports/unresolved.json`。

## Step 3 解碼與標準化

1. SPR/ACT 解出 RGBA 幀、動作、方向、frame duration、pivot、音效事件與 hit frame。
2. 保留原始方向資料；沒有的鏡像方向在 runtime 用 UV 翻轉，不再存一份貼圖。
3. 空白邊裁切後同步修正 pivot，避免角色移動時跳動。
4. 玩家與魔物統一「腳底中心」為世界座標；飛行魔物另存高度與影子 offset。
5. 地圖由 RSW/GND/GAT 建立視覺層、可走網格、阻擋輪廓、出生區與首領區。
6. 預警碰撞不得從圖片反推；使用本作自己的幾何資料。
7. STR 特效先轉成受限粒子描述；無法安全限制的效果改成自製簡化版。

## Step 4 打包與效能分級

1. 依關卡分 atlas，不做全遊戲巨型 atlas。
2. 桌機使用 1x WebP／PNG；手機另產生 0.5x atlas。
3. 每張 atlas 不超過目標裝置可安全處理的尺寸，優先 2048×2048；需要 4096 時先做裝置測試。
4. 技能特效首次選到才載入；未選技能不得佔 GPU 記憶體。
5. BGM 以串流方式播放；短音效轉成一致取樣率並限制同時播放數。
6. 關卡離開後分批釋放貼圖與聲音，不在單一 frame 大量 destroy。

## Step 5 視覺驗收

每個角色與魔物建立自動 contact sheet，至少顯示：

- 8 方向 idle
- 8 方向 walk
- attack、hit、death
- cast 或 skill 動作
- shadow、pivot、碰撞圓與名字基準線

人工檢查通過後才把 manifest 的 `reviewedAt` 填上日期。

## Step 6 建置權利檢查

`fan-local`：

- 允許 `local-fan-use`，但輸出只綁定 localhost 或私人 LAN 設定。
- 不生成包含原始 GRF 的安裝包。
- 遊戲頁顯示非官方、非營利同人聲明與權利標示。

`fan-public`：

- 只允許 `public-use-cleared`、`third-party-permissive` 與 `original-project-owned`。
- 必須保存書面許可或適用規範快照的路徑與日期。
- 沒有核准記錄即使技術上可打包也要停止。

# 垂直切片素材需求

| 類別 | 數量 | 驗收標準 |
| --- | ---: | --- |
| 劍士身體 | 男、女各 1 | 8 方向 idle、walk、attack、hit、death、cast |
| 髮型 | 4 組 | 男女與色盤皆無穿模到不可接受程度 |
| 武器／盾 | 4／2 | 動作 pivot 正確，左右手不漂移 |
| 普通魔物 | 10 | 每種至少 idle、move、attack、hit、death |
| 菁英 | 2 | 輪廓、色調與地面標記能立即辨識 |
| 小頭目／MVP | 1／1 | 大型動畫不超出 atlas 預算，死亡特效可降階 |
| 地圖 | 1 | 視覺與可走區一致，全部出生點可達 |
| 技能特效 | 8 主技能加 4 通用 | 支援低、中、高三個特效等級 |
| UI 圖示 | 約 40 | 觸控與高 DPI 清楚；沒有圖片內嵌西文 |
| 音效 | 約 30 | 有同時播放上限，首領預警不被戰鬥聲蓋掉 |
| BGM | 1 城鎮、1 關卡、1 首領 | 可分別調音量並正確循環 |

# 禁止事項

- 不得把 `RO-Amatsu` 或 `RO-Server` 整個複製進新 repo。
- 不得對舊目錄執行 `git reset --hard`、`git clean`、批次格式化或套件大升級。
- 不得下載、反編譯或搬用 RO Survivors／HANS 的 JavaScript、伺服器檔、資料表與文字。
- 不得把台灣 2026 文字整批覆蓋到 2021 資源；只能依相同 ID、相同效果逐筆採用。
- 不得把「非營利」寫成「官方授權」或在頁面上使用會讓玩家誤認官方的營運標示。
- 不得在沒有備份及 manifest 差異報告時更新 GRF 來源版本。

