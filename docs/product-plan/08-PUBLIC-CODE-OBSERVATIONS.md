# 官網公開客戶端唯讀分析

## 結論

2026-11-17 的公開 client 快照足以確認產品表面、模組類別、PWA 方式、即時功能與資料保存責任，但不足以合法或可靠地還原原始實作。施工應採乾淨室方式：把下列發現轉成自有狀態機、schema、測試與效能門檻，不使用對方函式、壓縮片段、訊息文案或完整數值表。

本次由 Codex 負責抓取與分析。Claude 只讀 `handoff` 的重寫結果，不再碰官網程式。

## 觀察範圍與方法

- 讀取官方與 HANS 公開首頁、Credits、法律頁、talents 頁、Web App Manifest、`status.json` 與 HANS 公開公告／notice／guest-status。
- 取得 HTML 明示的 client artifact URL，僅在記憶體中計算 byte、ETag、Last-Modified、SHA-256、路徑 token 與架構關鍵字。
- 對公開主 bundle 與 talents 依賴做字串／結構層的介面分析，沒有保存 bundle 到企劃或交付目錄。
- 沒有抓 source map、沒有嘗試私有或管理端點、沒有建立帳號、沒有攔截 token、沒有重播封包、沒有繞過訪客停用。
- 官網程式本身不進 Git；交付物只含 hash、事實、推論與我方獨立 schema。

## Artifact 指紋

完整 CSV 在 `handoff/public-client-artifacts.csv`。這些 hash 只用來指明「分析的是哪一版」，不是可重用程式碼。

| 站點 | Artifact | Bytes | SHA-256 前 12 碼 | Last-Modified UTC |
| --- | --- | ---: | --- | --- |
| 官方 | main JS | 1,351,156 | `75E30EB32412` | 2026-11-16 10:42:58 |
| 官方 | talents JS | 7,532 | `F73B41EF7D1D` | 2026-11-16 10:42:57 |
| 官方 | shared／soul-linker JS | 2,617,063 | `34F8B78FD046` | 2026-11-16 10:42:58 |
| 官方 | main CSS | 223,804 | `7285FDE86DBA` | 2026-11-15 21:57:50 |
| HANS | main JS | 1,622,877 | `04C76E491B52` | 2026-11-16 23:29:20 |
| HANS | talents JS | 7,335 | `884A13EB9047` | 2026-11-16 23:29:20 |
| HANS | shared／soul-linker JS | 2,987,673 | `E7D5CC7589F6` | 2026-11-16 23:29:20 |
| HANS | main CSS | 210,470 | `7F6174D40D38` | 2026-11-12 16:24:05 |

所有 build artifact 都回傳一年 immutable cache；HTML／manifest／狀態與公告採短 cache 或 no-cache。因此自己的建置也應使用 content-hashed 靜態檔、短 cache shell 與可控更新提示。

## 已確認的公開事實

### App shell 與 PWA

- 官方 manifest 名稱為 RO Survivors，語言 `es`；HANS 為繁中名稱，語言 `zh-TW`。
- 兩者皆使用 `start_url=./`、`scope=./`、`display=standalone`、任意方向與 192／512／maskable icon。
- HTML 以 Vite 風格雜湊 ES module、modulepreload 與雜湊 CSS 啟動；公開 Credits 明列 Vite、TypeScript、Node、PixiJS、Three.js。
- client 中可觀察到 service worker、local／session storage、BroadcastChannel、requestAnimationFrame、WebGL、Worker、Pixi 與 Three 相關訊號；另有 Canvas、WebGL 與 WebGPU renderer 分割 chunk，但不能據此斷言目前正式路徑已啟用 WebGPU。
- 公開資源契約可見 `assets/sprites/{id}.json`、`assets/sprites/fx_emotion.json`、`assets/stages/{id}.jpg` 與 `assets/runitems/` 類路徑，顯示網頁使用預先抽取產物，而非每次執行直接掃整包 GRF。

### 產品表面

- 角色建立有名字、性別、Job、髮型、髮色、衣色與 48 點初始能力值。
- 角色面板公開呈現裝備、背包、卡片、寵物、外觀、狀態與 Job。
- 公開 UI 與法律頁確認訪客／帳號、伺服器存檔、普隆德拉廣場、聊天、好友、隊伍、交易、商店、精煉、無盡塔、月榜與 replay 驗證等責任。
- 法律頁說明伺服器會核對物品來源、商店、精煉、交易與塔的 replay；因此經濟與排行不能只信任 client。

### 公開狀態與版本

- 官方與 HANS 的 `status.json` 在觀察時都回覆 `state=ok`。
- HANS `hans-news.json`：日期 2026-11-17、版本 V0.13.1，標題表示同步官方 0.7.2；重點為傳說技能詞綴合法性、舊裝備遷移、職業修正與磁鐵吸寶箱。
- HANS `api/guest-status` 在觀察時回覆訪客停用。
- HANS 公開 notice 回覆結構為 revision、level、text、time 類欄位；只記 schema，不複製公告文案。

## 從公開 client 推得的模組邊界

下列為「架構推論」，不是對方原始設計文件：

1. `app shell`：登入／建立角色／選角／設定／PWA 更新。
2. `profile domain`：角色、Base／Job、六維、天賦、裝備、卡片、寵物、外觀與成就。
3. `run domain`：關卡、波次、掉落、升級選擇、結果、續局與 replay。
4. `social domain`：廣場分流、presence、聊天、好友、隊伍、邀請與交易。
5. `economy domain`：商店、Kafra 點、礦物、精煉、物品 UUID／來源與綁定。
6. `tower domain`：無盡波次、分數、月榜、replay 與伺服器驗證。
7. `render domain`：Three.js 世界／地圖，加上 PixiJS 2D／特效或渲染工具；實際責任邊界仍屬推論。
8. `persistence domain`：本機 session／settings／cache 加伺服器 revision／save；HANS 額外可見同步與通知類 key。
9. `realtime transport`：client 中有 WebSocket 與 lobby／party／trade 訊息類別，可判斷存在即時連線；不能由此斷言伺服器內部實作。
10. `cross-tab coordination`：BroadcastChannel 加上 storage 類別可能負責多分頁 session、互斥與復原；這是合理推論，不是已確認的內部設計。
11. `party run authority`：公開 token 與玩家提示共同顯示原作合作局可能受隊長分頁背景化影響，推測存在隊長端模擬／轉送。無論推論是否完全正確，本作仍選用 dedicated authoritative room，避免把此弱點帶入。

## HANS 相對官方的差異訊號

- HANS main JS 比同日官方多 271,721 bytes，共用／職業 chunk 多 370,610 bytes。byte 差只表示交付內容不同，不能等同功能品質。
- HANS 有繁中 manifest、公告、notice、guest 開關，以及更多商店、排行、同步、郵件／通知、三轉職業與營運 UI token。
- HANS Credits 明示它是 RO Survivors 的改作，繁中、多人物伺服器與營運由 HANS 負責。
- HANS 公告與 bundle 可支持「擴充內容面更大」；但拍賣、公會、PVP、三轉等仍不得直接塞進首版，必須依 Phase 與本作驗收門重做。

## 對本作的乾淨室轉換

| 觀察 | 本作獨立實作 |
| --- | --- |
| 雜湊靜態檔與 PWA | Vite build hash、短 cache HTML、更新先提示，戰鬥中不 reload |
| 角色／run／社交／經濟混合產品面 | monorepo 中拆成 core-sim、content-schema、client、server、asset-gateway |
| client 有 local storage 與伺服器 save | IndexedDB 本機 revision log；Phase 5 才做雲端衝突狀態機 |
| WebSocket 社交與組隊 | 自訂版本化訊息 envelope；Phase 6 使用 dedicated authoritative room，不複製訊息名 |
| 多分頁同步與崩潰復原訊號 | 自訂 tab lease、revision 與 crash checkpoint；每個機制有獨立測試，不照搬 storage key |
| replay 驗證排行 | 固定 tick、seed、InputCommand、contentVersion、hash chain，再由 server headless replay |
| 物品來源核對 | 每件物品 UUID、append-only provenance、交易／精煉 server transaction |
| Three + Pixi | 本作首版採單一 Three WebGL world + DOM/Preact UI，避免雙 canvas 記憶體成本；需要時才實驗 Pixi |
| HANS 大量營運功能 | 保留 roadmap，不進單人垂直切片 |

## 不確定與待量測

- 未建立帳號，因此沒有進入受帳號限制的完整遊戲流程。
- 沒有把壓縮程式轉回來源，故所有 class／模組責任只按公開 token 與 UI 行為推論。
- 沒有取得完整技能係數、掉落率、生成表、首領時間軸或伺服器協定；本作使用自有 seed 與平衡試驗。
- 官網可能隨時更新；只有 hash 改變且使用者再次要求時，才由 Codex 做新快照。

## 給 Claude 的規則

Claude 只能使用這份摘要、`reference-snapshot-2026-11-17.json`、`reference-ledger.csv` 與本機 RO／rAthena／roBrowser 的允許來源。不得再抓官網 client、source map、私有 API 或下載包；缺資料就列出 `RESEARCH-GAP` 交回 Codex。

