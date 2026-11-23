# RO 倖存者持續參考與黑箱觀察流程

本作在整個開發期間持續參考 RO Survivors、HANS、官方公告、中文攻略與國外玩家回饋，但只記錄公開可見的功能、操作、版本、玩家問題與自己量測的輸入／輸出。Codex 是研究維護者，Claude 是施工者；Claude 不另行抓站。參考資料不會自動成為本作程式或數值，每一項都要轉成自己的需求、實驗與平衡決策。

2026-11-17 已由 Codex 對兩站「瀏覽器本來就會收到」的 HTML、manifest、公開狀態端點與壓縮 client bundle 做一次性唯讀分析。目的僅是辨認公開介面契約、模組邊界、儲存類別與效能策略；沒有抓 source map、沒有登入、沒有繞過權限、沒有保存原碼到本專案，也不把函式或資料表交給 Claude。結果在 `08-PUBLIC-CODE-OBSERVATIONS.md` 與 `handoff`。

# 可以參考的資料

- 公開首頁、法律頁、Credits、天賦頁與公開更新公告。
- 遊戲內一般玩家可以看到的 UI、操作、Wiki、技能描述與版本資訊。
- 自己正常遊玩時量測的關卡時間、冷卻、詠唱、波次、首領預警、裝備流程與手機效能。
- 公開新聞、攻略、Wiki、Reddit、PTT、Discord 公開公告與玩家影片。
- GPL／開源的 rAthena、roBrowserLegacy、remote client 及其正式文件。
- 使用者本機已持有的 RO 官方素材、資料與開源私服工具，依素材計畫隔離使用。

# 不抓取或不交付的內容

- RO Survivors 或 HANS 的 bundle 原檔、source map、伺服器碼、資料庫 dump、隱藏資料表與下載包。公開 client bundle 只允許 Codex 做低頻、一次性、非保存式的介面分析；Claude 不得重抓。
- 需要繞過登入、權限、驗證、rate limit、robots 或技術限制才能取得的 endpoint。
- 以開發者工具批次枚舉私有 API、攔截 token、重播封包或下載整套遊戲資料。
- 反混淆、反編譯或逐行轉譯別人的封閉程式。
- 把公開攻略的文字整段貼成本作說明，或把觀察到的完整數值表直接複製成正式平衡。

# 參考台帳欄位

每個觀察項目記錄：

| 欄位 | 說明 |
| --- | --- |
| `observation_id` | 穩定 ID，例如 `OBS-20261117-MOBILE-001` |
| `observed_at` | 含時區的觀察時間 |
| `source_type` | official、hans、guide、community、playtest、opensource |
| `source_url` | 直接支援該觀察的公開頁面 |
| `source_version` | 頁面或遊戲顯示版本；不知道就留空 |
| `region_language` | TW／EN／JP／KR／ES 等 |
| `claim` | 用自己的話寫一項可核對事實 |
| `evidence_method` | 公告、畫面、計時、重複測試、玩家多次回報等 |
| `confidence` | high、medium、low |
| `copyright_class` | fact、measurement、idea、text-do-not-copy、code-do-not-copy |
| `design_action` | adopt、adapt、reject、test、watch |
| `our_decision` | 本作採取的自有方案 |
| `test_id` | 對應驗收測試；沒有就建立 backlog |
| `review_status` | new、reviewed、superseded、invalid |

一列只放一個主張。來源無法直接支持的推論要寫成 `confidence=low`，不可混成官方事實。

# 每個 Phase 的更新節奏

## Phase 開始前（Codex／研究維護者）

1. 查閱 `SOURCES.md` 的第一手來源。
2. 記錄目前原作與 HANS 顯示版本、公告日期與重要功能變化。
3. 搜尋近七天中文與海外玩家回饋，至少各一個來源；沒有新資料就記錄「checked-no-material-change」，不要編造更新。
4. 舊 ledger 與 snapshot 一律不覆寫。把新觀察放入日期版 `handoff/reference-ledger-delta-YYYY-MM-DD.csv`，需要時產生新的 `handoff/reference-snapshot-YYYY-MM-DD.json`，再以 hash 更新 `handoff/reference-index.json`。
5. 只把會改變本 Phase 需求或驗收的項目轉入 `RISKS.md`／`DECISIONS.md`。

Claude 在 Phase 開始前只讀取上述交付物。如果資料不足，應提交缺口清單，不自行研究外站。

## 平衡調整前

1. 先看本作自己的遙測、replay 與真人測試。
2. 外部數值只用來提出假設，不直接覆蓋本作平衡表。
3. 每項改動寫明目標指標、預期方向、實驗群組與回滾條件。
4. 若參考作品版本已變，保留舊觀察並標記 `superseded`，不要改寫歷史。

## 發行前

1. 再查官方法律頁、Credits 與相關地區規範有沒有更新。
2. 重新確認非官方、非營利與權利標示。
3. 將所有 `code-do-not-copy`／`text-do-not-copy` 項目與 Git diff 做抽樣比對。
4. 檢查本作 UI、文字與數值沒有因「參考」變成逐項複製。

# 低頻變更監看

Codex 可以建立 `pnpm reference:check`，但功能只限：

- 以清楚 user agent、低頻率及合理 timeout 讀取允許的公開 HTML 頁面。
- 優先使用 ETag、Last-Modified 或內容摘要判斷頁面是否改變。
- 每個來源最多 24 小時檢查一次；錯誤採退避，不密集重試。
- 只保存 URL、時間、HTTP 狀態、標題、公開版本文字與內容 hash。
- 發現變更時標記 `needs-human-review`，絕不自動把頁面內容或數值匯入遊戲。
- 日常監看不追蹤 script、bundle、source map、API endpoint 或需要登入的頁面。只有使用者明確要求重新分析公開 client、且版本 hash 改變時，才由 Codex另做一次人工審核。
- 遵守網站 robots、使用條款與明確的封鎖回應；不使用代理規避。

如果無法確認網站允許自動檢查，就改成人工查閱，不影響遊戲施工。

# 黑箱量測方法

## 技能

1. 正常遊玩並錄製畫面。
2. 只記錄可見的開始時間、命中時間、冷卻結束、範圍與目標數。
3. 重複至少 5 次，寫中位數與觀察誤差。
4. 不將量測值直接設成本作值；先寫「想保留的手感」與自己的目標。

## 關卡與首領

1. 記錄總長、事件順序、預警種類與玩家需要做的決策。
2. 不逐幀複製完整招式表；本作以不同時間軸與組合重做。
3. 特別記錄不公平死亡、視覺遮蔽與近戰無輸出窗口。

## 手機與效能

1. 記錄裝置、OS、瀏覽器、畫質、遊玩時間與發熱／重載。
2. 只比較體感與公開瀏覽器指標，不探查對方內部記憶體物件或程式結構。
3. 把觀察轉成自己的 FPS、heap、texture 與 soak-test 門檻。

# 參考轉成需求的例子

| 外部觀察 | 不應做的事 | 本作的正確轉換 |
| --- | --- | --- |
| iPhone 長局會重載 | 複製對方記憶體管理程式 | 建立三局 soak test、texture cache key、lazy FX 與 heap 門檻 |
| 某法師普攻流過強 | 抄它的技能係數 | 建立技能傷害占比與首領時間指標，調整自己的公式 |
| 紅圈與 hit 不一致 | 逐幀仿製對方紅圈 | 本作讓 renderer 與 simulation 共用 geometry object |
| HANS 有拍賣與擺攤 | 立即把功能塞進 MVP | 記錄為 Phase 7 候選，先完成物品履歷與雙花測試 |
| 玩家喜歡 RO 詠唱感 | 搬用對方資料表 | 以本作的 cast／windup／recovery schema重建手感 |

# 台帳檔案

- 本企劃目錄的 `reference-ledger.csv`：2026-11-17 鎖定基線；後續日期版 delta 由 `handoff/reference-index.json` 列出，讀取時合併但不改寫舊檔。
- `docs/reference/source-checks.jsonl`：低頻頁面檢查結果。
- `docs/reference/playtest-observations/`：自己的錄影時間點與量測摘要；不提交他人完整影片。
- `docs/reference/decisions/`：只有會影響設計的整理結論。

模板位於同一企劃目錄的 `reference-ledger.template.csv`。

