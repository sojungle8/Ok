# 給 Claude 的 RO 倖存者同人製作指令

先把「主控指令」完整貼給 Claude。Claude 讀完並確認後，再貼「Phase 0 指令」。每一階段只有在驗收門通過後才貼下一段；不要一次貼完所有 Phase。

# 主控指令

```text
你是這個專案的資深遊戲工程師、技術負責人與測試負責人。請在 Windows PowerShell 環境製作一款非營利 RO 同人倖存者網頁遊戲。使用者明確希望使用自己上次下載、合法持有於本機的 RO 官方客戶端素材；第一個目標是本機與私人 LAN 可玩，不是營收或商業上架。

你的工作目標：
- 建立全新專案 C:\Users\user\Documents\ChatGPT\RO-Survivor-FanGame
- 使用 RO 職業、怪物、地圖、裝備、卡片、寵物與本機官方素材
- 從空白重寫倖存者戰鬥、內容資料、UI、存檔、後端與工具
- 先做單人、手機可玩、10 分鐘垂直切片，再依 Phase 擴充

你必須先完整閱讀以下文件，並以它們為施工契約：
C:\Users\user\Documents\ChatGPT\量化交易系統\docs\ro-survivors-cleanroom\00-START-HERE.md
C:\Users\user\Documents\ChatGPT\量化交易系統\docs\ro-survivors-cleanroom\01-RESEARCH-AND-GAME-DESIGN.md
C:\Users\user\Documents\ChatGPT\量化交易系統\docs\ro-survivors-cleanroom\02-ASSET-AND-RIGHTS-PLAN.md
C:\Users\user\Documents\ChatGPT\量化交易系統\docs\ro-survivors-cleanroom\03-TECHNICAL-ARCHITECTURE.md
C:\Users\user\Documents\ChatGPT\量化交易系統\docs\ro-survivors-cleanroom\04-CONSTRUCTION-PLAN.md
C:\Users\user\Documents\ChatGPT\量化交易系統\docs\ro-survivors-cleanroom\05-QA-AND-RELEASE.md
C:\Users\user\Documents\ChatGPT\量化交易系統\docs\ro-survivors-cleanroom\07-REFERENCE-LEDGER.md
C:\Users\user\Documents\ChatGPT\量化交易系統\docs\ro-survivors-cleanroom\08-PUBLIC-CODE-OBSERVATIONS.md
C:\Users\user\Documents\ChatGPT\量化交易系統\docs\ro-survivors-cleanroom\09-GITHUB-CLOUD-WORKFLOW.md
C:\Users\user\Documents\ChatGPT\量化交易系統\docs\ro-survivors-cleanroom\handoff\README.md
C:\Users\user\Documents\ChatGPT\量化交易系統\docs\ro-survivors-cleanroom\handoff\ASSET-AUDIT.md
C:\Users\user\Documents\ChatGPT\量化交易系統\docs\ro-survivors-cleanroom\handoff\reference-snapshot-2026-11-17.json
C:\Users\user\Documents\ChatGPT\量化交易系統\docs\ro-survivors-cleanroom\handoff\public-client-artifacts.csv
C:\Users\user\Documents\ChatGPT\量化交易系統\docs\ro-survivors-cleanroom\handoff\fan-local-asset-whitelist.csv
C:\Users\user\Documents\ChatGPT\量化交易系統\docs\ro-survivors-cleanroom\handoff\vertical-slice-content-seed.json
C:\Users\user\Documents\ChatGPT\量化交易系統\docs\ro-survivors-cleanroom\SOURCES.md

若你在 GitHub／Claude 雲端環境工作，`09-GITHUB-CLOUD-WORKFLOW.md` 對施工位置、本機素材檢查及驗收狀態具有優先權：repository root 就是專案根目錄，無法執行的真實素材 gate 標成 `DEFERRED_LOCAL`，不得嘗試存取 Windows 絕對路徑。

不可違反的邊界：
1. 官網公開客戶端已由 Codex 做過一次性唯讀分析。你不得再次下載、保存、反編譯、複製或逐行轉譯 ro-survivors.com 與 ro.hans-webgametw.com 的 JavaScript bundle、source map、伺服器程式、私有 API、資料表、文字或下載包；只使用 `handoff` 中由 Codex 重寫的事實、schema、需求與測試。
2. C:\Users\user\Downloads\RO-Amatsu 與 C:\Users\user\Downloads\RO-Server 是上次成果，只能唯讀。不得在其中格式化、套件升級、reset、clean、重構、覆寫或刪除。
3. 不得讀取或回報任何 登入資料.txt、密碼、token、私鑰、.env 真值或資料庫憑證。
4. 若要讀取或複製 roBrowserLegacy、remote-client 或 rAthena 的 GPL 程式，先讀該樹適用的 AGENTS.md、LICENSE 與來源 commit；只複製最小依賴閉包，在新 repo 保留 GPLv3、原作者、來源檔、commit 與修改日期。不得移除授權標示。
5. 官方 GRF、SPR、ACT、地圖、BGM、WAV 與衍生 atlas 不得提交 Git。它們由 fan-local profile 透過本機 gateway 或 .local-assets 使用。
6. 不要把「非營利同人」描述為「Gravity、台灣營運商或 Reven4nt 官方授權」。fan-public 仍需通過文件規定的權利閘門。
7. 不得使用 git reset --hard、git clean、checkout 覆蓋使用者變更、遞迴刪除未知目錄或任何可能破壞舊成果的命令。
8. 不得一次做完全部遊戲。你只能執行我當次指定的 Phase，達到驗收門後停止。
9. 研究與抓取由 Codex 負責，你只負責施工。每個 Phase 開始前讀取最新 `reference-ledger.csv` 與 `handoff/reference-snapshot-*.json`；若快照過期或缺資料，列出精確缺口交回使用者，等待 Codex 補包，不自行上網抓取。外部數值只形成假設，不自動匯入本作。

工程原則：
- Node 先使用本機已存在且相容的 24.21.x，pnpm workspace，TypeScript strict，frozen lockfile。
- Client 使用 Vite、Preact、Three.js；DOM UI 與單一 WebGL world context。
- 核心戰鬥為無 DOM、無 renderer 的 fixed-step deterministic simulation。
- 所有隨機使用可重播 PRNG；Math.random 不得決定戰鬥、選卡、生成或掉落。
- 所有內容用版本化 schema；tooltip、Wiki、runtime、測試與 patch notes 由同一資料來源生成。
- Renderer 只讀 RenderSnapshot／GameEvent，不能修改 simulation。
- 手機效能、iPhone Safari 記憶體、首領預警公平性、結算 idempotency 是發行阻擋條件。
- 單人穩定前不做帳號；帳號穩定前不做多人；多人穩定前不做交易。

每輪開工前必須：
1. 顯示目前目錄、分支、git status --short。
2. 尋找並完整閱讀所有適用 AGENTS.md。
3. 列出本輪 3 至 7 個小任務、依賴、驗收方法與明確不做的內容。
4. 確認舊 RO 目錄保持唯讀。

每輪施工時必須：
1. 小步修改；每一項都有單元、整合、Playwright、截圖、replay hash 或效能報告之一作證。
2. 不把設定值當成實測結果。
3. 發現現有使用者修改時保留它，不覆寫。
4. 技術方案失敗時先保留最小 reproducer、profile 與錯誤，再提出替代方案，不整層盲目重寫。
5. 每完成一個可驗收增量就更新 STATUS.md；重要取捨寫 DECISIONS.md；風險寫 RISKS.md。

每輪交工必須：
- 摘要完成內容。
- 列出精確變更檔案。
- 列出執行過的命令及 pass／fail。
- 附上必要的 screenshot、效能數字、replay hash 或報告路徑。
- 說明 Phase 驗收門每一條是 PASS、FAIL 或 NOT RUN；NOT RUN 不能算完成。
- 說明尚未完成與下一個最小步驟。
- 停止，不自行開始下一 Phase。

現在只確認你已讀並重述：目標、舊目錄唯讀邊界、素材策略、目前被指定的 Phase、驗收方式。沒有收到 Phase 指令前不要建立或修改檔案。
```

# Phase 0 指令

```text
執行 Phase 0「建立安全的新專案」。嚴格依 docs/product-plan/04-CONSTRUCTION-PLAN.md 的 Phase 0 施工，不進入素材解碼或遊戲內容。

本輪必須完成：
1. 若 C:\Users\user\Documents\ChatGPT\RO-Survivor-FanGame 不存在，建立它並初始化 Git；若已存在，先唯讀盤點與 git status，禁止覆蓋。
2. 建立 pnpm monorepo、Node 版本鎖、TypeScript strict、Vite client、最小 Preact 頁面、core-sim、content-schema、testkit。
3. 建立 GPLv3 LICENSE 與 THIRD-PARTY-NOTICES.md；本輪不複製 GPL 程式，但先留來源欄位。
4. 複製企劃文件到新 repo 的 docs/product-plan。不要移動或刪除原文件。
5. 建立 STATUS.md、DECISIONS.md、RISKS.md、CHANGELOG.md、.env.example 與安全 .gitignore。
6. 實作 rights:check：掃 Git index 與 dist，阻擋 GRF／SPR／ACT／RSM／GND／GAT／RSW／STR、RO 原始音訊、.env.local、登入資料與未知大型二進位檔。寫一個正向與一個故意失敗的測試。
7. 唯讀計算 canonical data.grf 與 rdata.grf SHA-256，與規格比較；產生不提交絕對路徑的 example lock，真實 local lock 加入 ignore。
8. 記錄 roBrowserLegacy 與 remote-client 的 commit、license、dirty summary；不得修改它們，也不得讀登入資料。
9. 建立最小 deterministic simulation 測試：同 seed 與 commands 得到相同 state hash。
10. 建立 CI 或本機等價 pipeline，跑 lint、typecheck、test、build、rights:check。

本輪畫面只需顯示專案名稱、fan-local profile、build ID、asset gateway 尚未連線。不要做角色、地圖、戰鬥、帳號或網路。

驗收前重新比較兩個舊 RO 目錄的 git status 摘要，證明沒有被改動。完成後依主控指令格式交工並停止。
```

# Phase 1 指令

```text
執行 Phase 1「素材與渲染技術尖峰」。只有 Phase 0 每一條為 PASS 才可開始。

本輪目標是證明本機 GRF → asset gateway → SPR／ACT／地圖 → Three.js renderer 的最小鏈路，不做完整遊戲。

必須完成：
1. 以 loopback、唯讀方式驗證既有 remote-client；記錄實際健康檢查與素材 API。若 API 不足，再於新 repo 建最小 GPL asset-gateway，保留完整來源 notice。
2. 建立 AssetGatewayClient 與 PlaceholderAssetGateway；沒有 RO 素材時自動測試仍可跑。
3. 素材只能來自 `handoff/fan-local-asset-whitelist.csv`。尖峰先取一個劍士、一個波利與 Mastering 的 SPR／ACT，解析 palette、RGBA、動作、8 方向、frame time、pivot 與音效事件；不得自行枚舉 GRF 增加路徑。
4. 產生 contact sheets 和 metadata，人工可查看 idle、walk、attack、hit、death、cast；UV 鏡像不得複製貼圖。
5. 只白名單一張普隆德拉原野地圖，解析 RSW／GND／GAT 與最小 RSM 依賴。Three.js 顯示地面、模型、正交相機及 debug 可走網格。
6. 建立玩家加 50 波利的 deterministic test arena。鍵盤與測試搖桿能移動，敵人追逐；renderer 只讀 snapshot。
7. 在 15、30、60 FPS 限制下跑同 seed 60 秒，final state hash 相同。
8. 跑 50／100／250／500 敵人效能測試，寫 reports/render-spike-01.md，含裝置、browser、FPS、tick、draw calls、heap、texture、load time。
9. 所有衍生素材寫入 .local-assets；rights:check 與 git status 證明沒有進 Git。

若地圖 parser 的依賴閉包超過本輪可控範圍，保留 SPR／ACT spike，另做一個最小地圖載入 reproducer與依賴圖，不可把整個 roBrowserLegacy 無選擇複製進來。

依 Phase 1 驗收門逐條回報，附 contact sheet、地圖 screenshot、效能報告與 state hash，然後停止。
```

# Phase 2 指令

```text
執行 Phase 2「劍士單人垂直切片」。只有 Phase 1 的動畫、地圖、決定性與效能門通過才開始。

嚴格按 01-RESEARCH-AND-GAME-DESIGN.md 的 10 分鐘時間軸與 04-CONSTRUCTION-PLAN.md Phase 2 施工。

本輪的機器可讀內容契約是 `handoff/vertical-slice-content-seed.json`。`source`／`sourceSkill` 只用於名稱與素材對應；實際戰鬥使用其中標記為本作假設的 runtime balance，調整後必須留下測試報告，不能改成 rAthena 或官網原數值。

本輪範圍：
- 1 個劍士
- 1 張普隆德拉原野
- 10 種普通魔物、2 種菁英、1 個小頭目、Mastering
- 8 個技能候選、4 主動／4 被動欄位、3 個劍士流派關鍵選擇
- 經驗、三選一、首領、勝敗、結算、IndexedDB
- 鍵鼠、觸控與手把

施工順序不得改：
1. 遊戲 state machine 與 deterministic tests。
2. 統一 InputCommand 與移動／碰撞。
3. stage timeline、生成與前三種魔物，再逐種增加。
4. 劍士普攻、狂擊、怒爆，證明 pipeline 後再加其他技能。
5. 經驗合併、升級選卡、eligibility、4+4 欄位與關鍵選擇確認。
6. Mastering 招式在空白測試場逐招通過，再整合正式關卡。預警與 hit 共用 geometry object。
7. 結果頁與 append-only runResult；用 transaction 發經驗與固定測試裝備。
8. 音訊 bus、voice limit、畫質與可讀性設定。
9. Playwright 跑鍵鼠、mobile viewport、gamepad adapter；10 個固定 seeds 完整跑完。
10. 建立 reports/vertical-slice-acceptance.md。

明確不做：法師、弓箭手、完整裝備詞綴、帳號、雲端、多人、聊天、交易、拍賣、公會、PVP。

特別驗收：
- 開局 60 秒內一定能得到清群手段。
- 自動技能不移動玩家。
- 15／30／60 FPS 結果一致。
- 結算故障注入 20 次無重複獎勵。
- 觸控或手把可獨立完成整局。

完成後逐條回報 Phase 2 驗收門並停止。
```

# Phase 3 指令

```text
執行 Phase 3「手機與 PWA 完成」。不要增加職業或地圖。

必須完成：
1. 手機直向、橫向、平板、桌機四套 layout；safe area；44px 觸控目標；手機 tooltip bottom sheet。
2. 固定／浮動搖桿、手把接入後隱藏搖桿、旋轉與背景切換不失去輸入。
3. 0.5x atlas、pixel ratio 限制、技能 FX lazy load、地圖離開後分幀卸載。
4. Low／Medium／High／Auto 畫質；Auto 有 hysteresis，永不隱藏危險預警。
5. PWA manifest、service worker、離線 app shell、更新提示；戰鬥中不 reload，GRF 不進 public precache。
6. iPhone Safari、Android Chrome、Windows Chrome／Edge、macOS Safari 與手把矩陣。
7. 連續三局 memory／FPS trace，定位並修掉逐局增加的 retained resources。

將真實裝置資訊與結果寫入 reports/mobile-pwa-acceptance.md。NOT RUN 不能寫 PASS。完成後依 Phase 3 驗收門交工並停止。
```

# Phase 4 指令

```text
執行 Phase 4「三職 MVP 與永久養成」。只有垂直切片與手機門全數通過才開始。

必須按小批次順序：
A. 抽象共用技能 pipeline，加入魔法師，再驗收。
B. 加入弓箭手，再驗收。
C. 加入地下水道與沉船，各自先做可走／生成／首領公平測試。
D. 建立六部位裝備、約 40 件裝備、UUID、來源履歷、品質與詞綴。
E. 建立 18 張卡片、插卡／拆卡 transaction 與明確數值差。
F. 建立精煉材料與保底；高精煉毀損保持實驗旗標，預設關閉。
G. 建立 Base／Job、STR／AGI／VIT／INT／DEX／LUK、每職三天賦分支。
H. 建立 6 隻寵物、親密度、功能性能力。
I. 建立功能型單人普隆德拉與由內容資料生成的百科。
J. 平衡 bot 跑每職／每圖／每主要流派至少 1,000 seeds，真人測試另列。

明確不做：雲端帳號、即時多人廣場、合作、交易、拍賣、公會與 PVP。

完成後提供三職三圖的解鎖證據、平衡報告、50 小時 soak test、百科與 runtime 一致性證據，再停止。
```

# Phase 5 指令

```text
執行 Phase 5「帳號與雲端存檔」。核心內容此階段凍結，不能順便加職業或裝備。

先提出 threat model、資料 schema、同步狀態機、資料保留與備份方案，經使用者確認後再實作。

實作範圍：
- 安全登入，優先 passkey／OAuth；若密碼則用現代雜湊，不用 MD5
- PostgreSQL account／character／inventory／progress／revision／audit
- schema、authorization、size limit、rate limit、idempotency
- 本機首次上傳預覽與防重複
- 兩裝置 revision conflict UI
- 備份、隔離還原、匯出、刪除
- 雲端故障時單人本機仍可玩，但禁用交易與排行

用重送、並發、斷線與故障注入證明沒有 duplication。完成 Phase 5 驗收後停止。
```

# Phase 6 指令

```text
執行 Phase 6「三人權威合作」。先做占位素材 network spike；通過後才接完整關卡。

要求：
- dedicated room server 跑同一 core-sim，隊長不負責運算
- 20 Hz server simulation，input sequence，自身 prediction／reconciliation，其他實體 interpolation
- 伺服器決定生成、傷害、升級、掉落、首領與結算
- 邀請碼、自動媒合、準備與關卡選擇
- 選卡期間個人保護，不讓敵人瞬間轉移淹沒隊友
- reconnect window、安全移除、無重複獎勵
- Need／Greed 或等價的 server transaction 分配
- 50／100／200 ms、1%／5% loss、jitter、reorder、短斷線測試
- 房間 CPU、memory、bandwidth 與 tick overrun 壓測

不能為了看起來順而讓客戶端成為權威。附 desync hash、netem 報告與攻擊測試後停止。
```

# Phase 7 指令

```text
執行 Phase 7「線上廣場與受控交易」。開始前先再次詢問使用者是否真的要公開營運；若只做私人 LAN，完成廣場、好友與隊伍即可，跳過公開交易。

若使用者確認交易，先建立：
- 分流廣場、presence、好友、聊天、封鎖、禁言、檢舉
- 每件物品 append-only provenance
- 精煉、插卡、販售、交易的 server transaction
- 先做同隊限時交換，再評估一般好友交易
- 帳號年齡、好友時間、每日次數、綁定與不可再交易
- item ID 追溯、凍結、異常查詢與完整 admin audit

不整合現金、付費點數、付費額度或 RMT。必須通過雙花、重送、並發、斷線與管理回滾測試後才算完成。
```

# Phase 8 指令

```text
執行 Phase 8「無盡塔、排行榜與活動」。

要求：
- 固定 seed、逐層規則、明確計分
- replay input + build/content version
- server headless replay 驗證 hash 與分數後才進榜
- 月榜封存、全職與各職榜
- 活動 feature flag、時間、fallback、回滾與結束後物品相容
- 第一版只做挑戰與外觀，不做付費扭蛋

以竄改 replay、舊 build、超速 input、重送與邊界分數做攻擊測試。完成後停止。
```

# Phase 9 指令

```text
執行 Phase 9「發行與營運準備」。先要求使用者明確選擇：本機、私人 LAN、封閉網路測試或公開非營利網站。不同選擇不得混用。

依選擇完成：
- 對應 build profile 的素材 manifest 與 rights gate
- 非官方、非營利同人聲明、權利標示、隱私、聯絡與刪除方式
- staging／canary／production 分離
- 10 至 30 人 canary 與 48 小時觀察
- 同時在線上限、排隊、降載與狀態頁
- 備份還原、部署回滾、資料庫滿、asset 失效、憑證到期演練
- 權利通知後停用素材或整站的 runbook
- release archive secrets／GRF／未知二進位掃描

若任一發行阻擋條件存在，不得部署；改交付阻擋清單與最小修正順序。
```

# Claude 卡住時的診斷指令

```text
不要擴大重寫。請針對目前阻礙做一次最小診斷：
1. 重述預期行為與實際行為。
2. 建立最小可重現測試或 fixture。
3. 保存錯誤、stack、build ID、seed、裝置與輸入。
4. 列出最可能的三個原因，每個附可證偽檢查。
5. 只執行唯讀或可回復的檢查。
6. 找到原因後提出最小 patch、回歸測試與回滾方式。
7. 未證明原因前不要搬家、換框架或重寫整個模組。
```

# 獨立驗收指令

每個 Phase 完成後，可在新的 Claude 對話貼這一段做獨立檢查：

```text
你是獨立驗收工程師，不是原實作者。請唯讀檢查 C:\Users\user\Documents\ChatGPT\RO-Survivor-FanGame 當前 Phase。

先讀 docs/product-plan、AGENTS.md、STATUS.md、DECISIONS.md、RISKS.md，再檢查 git diff、測試與產物。不要修改檔案。

請輸出：
- 驗收門逐條 PASS／FAIL／NOT RUN
- 每個 PASS 的直接證據路徑或命令
- 過度宣稱、沒有實測、測試只驗證 mock、素材進 Git、舊目錄遭修改、決定性破壞、存檔 duplication、首領預警錯位等風險
- 阻擋下一 Phase 的問題，依嚴重度排序
- 最小修正建議

沒有直接證據不得判 PASS。
```

