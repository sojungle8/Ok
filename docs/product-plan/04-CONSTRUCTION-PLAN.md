# RO 倖存者非營利同人施工計畫

本施工計畫假設一名產品負責人使用 Claude 協助開發。工期是工程量級，不是交付承諾：單人垂直切片約 20 至 35 個有效工作日，三職 MVP 約 60 至 100 個工作日；帳號、專用房間多人、交易與營運系統另需 50 至 90 個工作日。素材整理、實機測試、伺服器費用與權利確認不包含在純程式估算內。

每一階段都有停止門。上一階段的驗收證據不完整，就不能用增加職業、地圖或社交功能掩蓋問題。

# 施工原則

1. 新作只在 `C:\Users\user\Documents\ChatGPT\RO-Survivor-FanGame` 施工。
2. `RO-Amatsu` 與 `RO-Server` 永遠是唯讀來源。
3. 不下載、反編譯或搬用 RO Survivors／HANS 程式與資料。
4. 官方素材從本機 GRF gateway 載入，不進 Git。
5. 每次只做一個能被測試和截圖證明的增量。
6. 所有規則、數值與文字從內容資料產生，不散落在 UI 與程式碼。
7. 先完成單人與手機效能，再做帳號、多人成交與經濟。
8. Claude 每階段完成後停下，等待使用者驗收或給下一條指令。

# Phase 0 建立安全的新專案

**估算：2 至 4 個工作日**

## 0.1 建立目錄與版本控制

1. 確認目標路徑不存在；若已存在，先只讀列出內容與 Git 狀態，不覆蓋。
2. 建立 `RO-Survivor-FanGame`，初始化 Git，預設分支 `main`。
3. 建立 pnpm workspace、根 `package.json`、`.nvmrc`、`pnpm-workspace.yaml`、TypeScript base config。
4. 建立 `apps/client`、`apps/asset-gateway`、`packages/core-sim`、`packages/content-schema`、`packages/testkit`。
5. 將本計畫文件複製到新 repo 的 `docs/product-plan`；保留來源日期。
6. 新增 `STATUS.md`、`DECISIONS.md`、`RISKS.md`、`CHANGELOG.md`。
7. 新增 `LICENSE` 為 GPLv3，並在 `THIRD-PARTY-NOTICES.md` 登記 roBrowserLegacy、remote client、rAthena、Three.js、Preact 等。

## 0.2 保護舊目錄

1. 將兩個舊路徑寫入 `docs/LOCAL-SOURCE-PATHS.example.md`，不要把機密帳密或 `登入資料.txt` 搬過來。
2. 建立 `.env.example`，只留：
   - `RO_ASSET_SOURCE_DATA_GRF`
   - `RO_ASSET_SOURCE_RDATA_GRF`
   - `RO_ASSET_BGM_DIR`
   - `RO_ASSET_GATEWAY_HOST=127.0.0.1`
   - `RO_ASSET_GATEWAY_PORT`
3. 真實絕對路徑只進 `.env.local`，並加入 `.gitignore`。
4. `rights:check` 掃描 Git index、工作樹特定副檔名及 `dist`。發現 GRF、SPR、ACT、地圖、原始 BGM 或未知大型二進位檔就回傳非零。
5. 加一個測試，在 fixture 中故意放 `test.grf`，證明檢查會失敗；移除 fixture 後正式檢查通過。

## 0.3 固定來源版本

1. 計算 canonical `data.grf`、`rdata.grf` 的 SHA-256。
2. 與素材計畫記載值比較；不一致就停止並回報，不自動更新基準。
3. 產生 `assets/source-lock.local.json`，包含路徑、大小、雜湊、CP949 編碼、掃描時間。
4. `source-lock.local.json` 不提交；提交去除絕對路徑的 `source-lock.example.json`。
5. 記錄 `roBrowserLegacy` 與 `remote-client` commit，以及兩個工作樹的 `git status --short`，只放摘要，不修改它們。
6. 若 Claude 要複製 GPL 模組，先完整閱讀舊樹的 `AGENTS.md`、LICENSE 及檔案依賴，再在新 repo 以來源 manifest 列出每一個複製檔與原 commit。

## 0.4 建立工程基線

1. `pnpm lint`：ESLint 或等價工具，禁止未處理 promise 與隱式 any。
2. `pnpm typecheck`：所有 workspace package 使用 strict TypeScript。
3. `pnpm test`：先有一個 core-sim deterministic seed 測試。
4. `pnpm build`：client 只用占位素材也能產生靜態站。
5. `pnpm rights:check`：正式輸出不含受阻擋副檔名。
6. 建立最小 CI，依序跑 install frozen lockfile、lint、typecheck、test、build、rights check。

## Phase 0 產物

- 新 Git repo 與 lockfile
- 可開啟的占位首頁
- GPL 與第三方聲明
- 來源雜湊鎖
- 素材阻擋測試
- `STATUS.md` 記錄實際通過指令與結果

## Phase 0 驗收門

- 舊兩個 RO 目錄 `git status` 與施工前一致。
- 新 repo 的 `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm rights:check` 全數通過。
- Git index 內沒有 `.grf`、`.spr`、`.act`、原始 RO 音訊、帳密與 `.env.local`。
- 占位站在 Chrome 與 Safari 相容瀏覽器顯示 build ID。

# Phase 1 素材與渲染技術尖峰

**估算：5 至 9 個工作日**

目標不是做內容，而是證明「本機 GRF → 正確動畫／地圖 → 新遊戲 renderer」這條路可走，並在失敗時及早換方案。

## 1.1 資產閘道

1. 先以 loopback 啟動舊 `remote-client`，確認健康檢查與已知素材請求成功；不修改原目錄。
2. 記錄實際 API、錯誤格式、路徑正規化與 CP949 行為。
3. 在新 repo 寫 `AssetGatewayClient` 介面：`getBinary`、`getJson`、`resolvePath`、`getSourceHash`。
4. 寫 `PlaceholderAssetGateway`，讓沒有 RO 素材時測試仍可跑。
5. 若舊 API 無法滿足需求，再建立 GPL 的新 gateway；只複製必要模組並保留 notice。
6. 加入請求大小、路徑穿越、允許副檔名、loopback 綁定與 timeout 防護。

## 1.2 SPR／ACT 尖峰

1. 選一個劍士、波利與 Mastering 的 SPR／ACT，不一次處理全部資料庫。
2. 解析 palette、RGBA、動作、方向、frame time、pivot、音效事件。
3. 產生 contact sheet 與 JSON metadata。
4. 對角色跑 idle、walk、attack、hit、death、cast；缺動作要有明確 fallback，不可 crash。
5. 驗證 UV 鏡像不額外占用 texture memory。
6. 建立 snapshot test，固定輸入檔雜湊與輸出 metadata；圖片採 perceptual diff，容許極小壓縮差異。

## 1.3 地圖尖峰

1. 從白名單選一張普隆德拉原野地圖，記錄 RSW/GND/GAT/RSM 依賴閉包。
2. 先顯示地面高度與 texture，再加入模型；每一步都有可回退的 screenshot。
3. 建立正交相機、Y-up／Z-up 轉換與腳底世界座標規格。
4. 從 GAT 產生可走網格，顯示 debug overlay。
5. 用自動 path flood test 確認出生點能到達首領區與所有必要區域。
6. 相同樹木／石頭模型使用 instancing；記錄 draw call、triangle、texture memory。

## 1.4 最小模擬整合

1. core-sim 建立玩家、50 隻波利與圓形碰撞。
2. 玩家使用 WASD 與虛擬搖桿移動。
3. 以固定 seed 每秒生成敵人，敵人朝玩家靠近。
4. Renderer 只消費 `RenderSnapshot`；不得直接修改敵人位置。
5. 將 frame rate 人為限制在 15、30、60 FPS，60 秒後 state hash 必須一致。

## 1.5 尖峰效能報告

依序測 50、100、250、500 敵人，記錄：

- FPS p50／p95
- simulation tick p95／max
- draw calls
- JS heap
- GPU texture 估算
- 載入時間與傳輸量
- 裝置、瀏覽器、解析度、畫質與 build ID

## Phase 1 產物

- 劍士、波利、Mastering contact sheets
- 一張可走的 RO 地圖
- 素材 gateway client 與 placeholder adapter
- 決定性 50 敵人測試場
- `reports/render-spike-01.md`

## Phase 1 驗收門

- 8 方向、pivot 與地面影子人工驗收通過。
- 地圖視覺與 debug 可走區沒有重大錯位。
- 250 敵人桌機達 60 FPS 目標，指定中階手機或模擬限制達 30 FPS 目標；未達時要有 profile 與改善方案。
- 關閉 renderer 後 headless simulation 測試仍全數通過。
- 所有衍生貼圖只在 `.local-assets`，沒有進 Git。

# Phase 2 單人垂直切片

**估算：12 至 20 個工作日**

## 2.1 遊戲狀態機

依序建立：

1. `Boot`
2. `Title`
3. `CharacterSelect`
4. `StageSelect`
5. `Loading`
6. `Running`
7. `DraftPaused`
8. `BossIntro`
9. `Victory`／`Defeat`
10. `Results`

每個轉移都有單元測試。重新整理頁面只能從 checkpoint 恢復，不能卡在半開的選卡視窗。

## 2.2 輸入與移動

1. 實作鍵盤、點地、浮動搖桿、固定搖桿、手把 adapter。
2. 所有 adapter 產生 `InputCommand`。
3. 角色速度與碰撞由 simulation 決定。
4. 手把拔除、瀏覽器失焦、觸控取消時清空移動。
5. 相機跟隨使用 damping，但不影響角色真實座標。

## 2.3 敵人生成與 AI

1. 把 10 分鐘時間軸寫成 `stage.spawnTimeline`。
2. 生成點在相機外、合法地形內，不能直接出現在玩家腳下。
3. 先做波利、土波利、瘋兔三種 AI，再逐一加入其餘魔物。
4. 每新增一種 AI 都加 deterministic fixture 與最大數量壓測。
5. 菁英只增加一個清楚機制；先驗證可讀性再調血量。

## 2.4 自動普攻與技能

1. 先完成劍士扇形普攻：目標搜尋、轉向、windup、hit frame、recovery。
2. 加入狂擊與怒爆，證明單體與範圍兩種 pipeline。
3. 再實作霸體、挑釁、盾牌衝擊、快速回復、致命爆裂與被動熟練度。
4. 每個技能至少測：冷卻、詠唱、中斷、範圍邊界、多目標、死亡後取消、暫停。
5. Tooltip 從技能資料計算實際舊值 → 新值。
6. 自動技能不得改變玩家位置；若未來新增位移，另做安全規則。

## 2.5 經驗、選卡與構築

1. 敵人死亡產生邏輯經驗值，不直接產生無上限場景物件。
2. 鄰近經驗合併，視覺只顯示有限代表物件。
3. 升級 draft 使用獨立 RNG stream。
4. 選項生成先過 eligibility filter，再依權重抽取；不得出現無法使用或重複的三張同義卡。
5. 實作 4 主動、4 被動欄位與 3 個流派關鍵選擇。
6. 關鍵選擇需完整確認；一般數值升級不多一層阻礙。
7. 選卡支援滑鼠、觸控、數字鍵與手把，焦點永遠可見。

## 2.6 首領

1. Mastering 的四個招式各自建立 timeline 資料。
2. 先在空白測試場逐招驗證預警與碰撞，再放入正式關卡。
3. 寫測試遍歷招式 active tick，確認 visual geometry 和 hit geometry 共用同一 ID。
4. 加入 2 分鐘狂暴，但保留可走位空隙。
5. 結算記錄首領擊殺時間、受傷來源與技能傷害占比。

## 2.7 結算與本機存檔

1. 結果先寫 append-only `runResult`。
2. 同一 transaction 更新 Base／Job 經驗、關卡解鎖與物品。
3. 故意在 transaction 前、中、後關閉頁面，驗證不遺失且不重複發獎。
4. 結算頁顯示時間、等級、擊殺、傷害、承傷、升級、戰利品與新紀錄。
5. 先只發 10 件固定測試裝備，不在此階段做完整隨機詞綴。

## 2.8 音訊與可讀性

1. 城鎮、關卡、首領 BGM 分 bus。
2. 音效分 UI、玩家、敵人、首領、環境 bus，均可獨立調音量。
3. 同類命中音效設定 voice limit 與短冷卻。
4. 首領預警永遠可聽見，不被低優先戰鬥音效擠掉。
5. 提供閃光、震動、傷害字、特效透明度與色弱輔助設定。

## Phase 2 產物

- 完整 10 分鐘劍士單人關卡
- Mastering 首領戰
- 選卡與三種構築方向
- 結算及可靠 IndexedDB 存檔
- 鍵鼠、觸控與手把基本操作
- `reports/vertical-slice-acceptance.md`

## Phase 2 驗收門

- 新玩家不看說明能在 60 秒內取得範圍清怪能力。
- 三種流派均能以固定測試裝備通過標準難度。
- 10 個固定 seed 無 crash、無不可到達生成、無首領預警錯位。
- 在 15／30／60 FPS 限制下，同 seed 與輸入的結果 hash 相同。
- 結算中途關閉 20 次沒有重複物品或經驗。
- 完整一局可只用觸控或只用手把完成。

# Phase 3 手機與 PWA 完成

**估算：6 至 10 個工作日**

## 3.1 響應式 UI

1. 建立手機直向、手機橫向、平板、桌機四個 layout breakpoint。
2. HUD 不遮擋首領預警中心與玩家周圍安全區。
3. Tooltip 在窄螢幕改 bottom sheet。
4. 所有觸控目標至少 44 CSS px，破壞性操作不用長按。
5. 記住 UI scale、搖桿模式、畫質與音量。

## 3.2 記憶體與效能

1. 驗證貼圖 cache key，禁止同一 image 以不同 URL 重複載入。
2. 手機使用 0.5x atlas、限制 devicePixelRatio。
3. 技能效果首次選到才載入；未選技能不得留在 GPU。
4. 玩家離開關卡後分幀卸載 stage atlas、模型與音效。
5. 建立 debug performance HUD，但 production 預設關閉。
6. 連續三局收集 heap、texture、draw calls 與 frame time，檢查逐局上升。

## 3.3 PWA

1. 建立 manifest、icon、啟動畫面與離線 app shell。
2. service worker 不 precache GRF 或 local-fan 素材。
3. 更新完成後在城鎮顯示「重新啟動套用」，戰鬥中不 reload。
4. 測試從主畫面啟動、離線啟動、版本更新、快取損壞恢復。

## 3.4 實機矩陣

至少測：

- iPhone Safari 直向與橫向
- 一台中階 Android Chrome
- Windows Chrome／Edge
- macOS Safari 或同等 WebKit
- 一個 Xbox 或 PlayStation 相容手把

## Phase 3 驗收門

- iPhone Safari 連續三局不被系統重載。
- 手機標準壓力 seed 達 p95 30 FPS 目標；未達時 Low 模式必須達成。
- 三局後 heap 回落到可解釋範圍，沒有每局固定增加的 leak。
- PWA 離線能進入標題、選角與已快取的單人關卡。
- 直向、橫向切換不重置進度或卡住輸入。

# Phase 4 三職 MVP 與永久養成

**估算：20 至 35 個工作日**

## 4.1 職業

1. 先抽象共用技能 pipeline，不複製劍士程式做法師。
2. 加入魔法師：詠唱、元素、範圍控制、脆弱走位。
3. 加入弓箭手：投射物、貫穿、陷阱、遠距定位。
4. 每職 3 條天賦分支、約 8 個主動與 6 個被動候選。
5. 建立同裝備等級的 fixed-seed bot 模擬，找出無效升級與極端組合。

## 4.2 三張關卡

1. 普隆德拉原野完成內容化。
2. 地下水道加入狹窄路線、毒／蟲群，但不使用視覺看不見的牆。
3. 沉船加入遠程與地面危險，保持手機可讀性。
4. 每張圖有獨立生成表、事件、小頭目與 MVP。
5. 難度調整只改明確維度：數量、生命、傷害、速度、事件；獎勵倍率由自己的平衡公式決定。

## 4.3 裝備、卡片、精煉

1. 建立六部位、品質、固定能力、隨機詞綴與 gear score schema。
2. 每件物品產生 UUID 與本機來源履歷，即使還沒有交易。
3. 實作穿戴條件、角色占用提示、保護／鎖定、批次販售預覽。
4. 加入約 40 件裝備與 18 張卡片。
5. 精煉第一版使用可預期的材料成本與保底；風險毀損另開實驗旗標。
6. 插卡、拆卡與精煉都使用 transaction，操作前後顯示數值差異。

## 4.4 寵物、天賦、成就

1. 加入 6 隻寵物，能力偏功能性。
2. 親密度只在正常完成關卡時增加。
3. Base 等級給素質點；Job 等級給天賦點。
4. 素質與天賦可在城鎮免費重置，直到經濟設計驗證。
5. 成就只給非付費便利與外觀，不直接形成無限戰力雪球。

## 4.5 城鎮與百科

1. 先做單人功能型普隆德拉，不做即時多人廣場。
2. NPC 功能拆成角色、裝備、精煉、卡片、寵物、遠征、百科。
3. 百科由 content bundle 自動生成職業、技能、魔物、掉落與公式。
4. Patch notes 由內容版本 diff 產生草稿，再由人確認。

## Phase 4 驗收門

- 三職、三圖、三 MVP 全部可從新帳號正常解鎖。
- 每職至少兩種構築能通關標準難度，勝率差距符合平衡目標。
- 任意裝備、卡片、精煉與重置操作經重新整理後一致。
- 百科顯示值與 runtime formula snapshot 一致。
- 50 小時自動 soak test 無記憶體無限成長、無存檔損壞。

# Phase 5 帳號與雲端存檔

**估算：10 至 18 個工作日**

1. 寫資料處理說明、保留期間、刪除與匯出流程。
2. 建立安全登入；優先 passkey／OAuth，或使用 Argon2id 等現代密碼雜湊。
3. PostgreSQL 建立 account、character、inventory、progress、revision、audit schema。
4. 每個寫入 API 要有 authentication、authorization、schema、size limit、rate limit、idempotency key。
5. 本機 → 雲端首次上傳先產生預覽；不得把同一份本機存檔上傳兩次生成重複物品。
6. 建立同步衝突畫面，不靜默覆蓋較新進度。
7. 建立備份、還原演練、帳號刪除與資料匯出測試。
8. 伺服器故障時，單人本機仍可玩；標記離線所得，恢復後由規則合併。

## Phase 5 驗收門

- 跨兩個瀏覽器同步通過，無 duplication。
- 重送、斷線、超時與並發寫入測試通過。
- 備份可在隔離環境還原並驗證筆數與雜湊。
- 使用者能刪除帳號並在規定時間內清除個資。

# Phase 6 三人權威合作

**估算：18 至 30 個工作日**

1. 先做只有幾何占位素材的網路 spike，不把完整內容拿來掩蓋 desync。
2. 專用 room server 跑與單人相同的 core-sim。
3. 客戶端只送輸入與選擇，伺服器決定生成、傷害、掉落與首領。
4. 實作自身移動 prediction、server reconciliation、其他實體 interpolation。
5. 加入房間建立、邀請碼、自動媒合、準備、隊長僅負責選關，不負責運算。
6. 升級選卡期間玩家個人短暫無敵，不暫停全房間；敵人不重新鎖定造成隊友被瞬間淹沒。
7. 隊友斷線保留 reconnect window；逾時後安全移除，不傳送整群怪物。
8. 結算使用 Need／Greed 或等價分配，伺服器一次提交。
9. 模擬 50、100、200 ms RTT，1%、5% loss，抖動、重排與短斷線。
10. 壓測同時房間數，記錄每房 CPU、memory、bandwidth 與 tick overrun。

## Phase 6 驗收門

- 三人、250 敵人標準 seed 無可觀察 desync。
- 5% 丟包下能完成一局，關鍵預警仍準確。
- 任一客戶端修改本機 HP、掉落或裝備不會影響伺服器結果。
- 玩家斷線重連後不重複領獎，隊友不被瞬移怪群擊殺。

# Phase 7 線上廣場與受控交易

**估算：20 至 35 個工作日**

這一階段不是 MVP 必需。只有使用者確定要公開營運，而且前六階段穩定時才執行。

1. 建立分流廣場，只同步位置、外觀、名字與必要互動。
2. 聊天加入 rate limit、禁言、封鎖、檢舉與保留政策。
3. 好友、邀請與 presence 不暴露真實帳號識別資訊。
4. 所有物品取得建立 append-only provenance。
5. 精煉、插卡、販售與交易全部在 server transaction。
6. 先做同隊掉落的限時交換，再評估一般好友交易。
7. 加入帳號年齡、好友時間、每日次數、綁定與不可再次交易規則。
8. 管理後台可追蹤 item ID、凍結交易、檢查異常與處理申訴。
9. 不做現金交易、不整合付費點數、不出售戰力或交易額度。

## Phase 7 驗收門

- 併發交易、重送、斷線與雙花測試不能複製物品或貨幣。
- 任一物品能從目前持有人追溯到掉落 run。
- 聊天與檢舉資料符合明載保留期間。
- 管理操作全部有不可竄改的 audit event。

# Phase 8 無盡塔、排行榜與活動

**估算：12 至 20 個工作日**

1. 無盡塔使用固定種子、逐層規則與明確計分。
2. 客戶端上傳 replay inputs，伺服器以相同 build／content version 重播。
3. 只有重播 hash 與分數一致的結果進榜。
4. 每月封存排行榜；新賽季不直接刪除角色主進度。
5. 活動內容使用 feature flag、開始／結束時間、fallback 與回滾包。
6. 活動關閉後，角色身上的合法物品仍可被內容系統讀取。
7. 先做外觀與挑戰，不做付費扭蛋。

# Phase 9 發行與營運準備

**估算：7 至 14 個工作日，另加權利確認時間**

1. 決定只在私人 LAN、封閉測試或公開非營利網站發行。
2. 對目標 profile 執行完整素材 manifest 與權利閘門。
3. 顯示清楚的非官方同人聲明、權利標示、隱私政策與聯絡方式。
4. 不使用官方營運商 logo，不讓網域、名稱或頁面誤認為官方服務。
5. 建立 staging、canary、production 三環境與獨立資料庫。
6. 先給 10 至 30 名封閉測試者，再逐步擴大；每一批都有 crash、FPS、完成率與流失檢查。
7. 發行前做備份還原、部署回滾、服務故障、資料庫滿、資產 CDN 失效與憑證到期演練。
8. 建立權利人通知後可快速停用素材或整站的 runbook。

# Claude 每輪工作格式

Claude 每次收到一個階段指令後，必須使用以下格式：

## 開工前

- 顯示目前路徑、分支與 `git status --short`。
- 列出已讀的規格與適用的 `AGENTS.md`。
- 列出本輪 3 至 7 個任務、每個驗收方法與不在範圍內的內容。

## 施工中

- 每個 commit 只完成一個可描述的增量。
- 不使用破壞性 Git 指令清除使用者變更。
- 先寫失敗測試，再實作修正；純 UI 變更至少有 Playwright 或 screenshot 證據。
- 超過 30 分鐘沒有進展時，記錄阻礙、已試方案與最小替代方案，不盲目重寫整層。

## 交工時

- 摘要完成內容。
- 列出精確變更檔案。
- 列出執行過的命令與 pass／fail。
- 提供瀏覽器截圖、效能報告或 replay hash 等直接證據。
- 更新 `STATUS.md`、`DECISIONS.md`、`RISKS.md`。
- 說明尚未完成與下一個最小步驟。
- 停下等待下一階段，不自行進入 scope 更大的工作。

# 完成定義

一項功能只有同時滿足以下條件才算完成：

- 程式已合併到本階段分支且沒有未解的 type／lint error。
- 正常、邊界、失敗與重試路徑有測試。
- 手機及桌機至少各有一次實際或自動瀏覽器驗收。
- 內容、tooltip、百科與 runtime 使用相同資料。
- 沒有新增未登記的素材或第三方程式。
- 沒有讓舊 RO 目錄產生變更。
- 文件描述的是實際已驗證狀態，不把設定值寫成實測結果。

