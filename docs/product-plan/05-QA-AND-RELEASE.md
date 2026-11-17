# RO 倖存者同人測試與發行驗收

測試的優先順序是資料不重複、首領判定公平、手機不中斷、輸入可完成整局，最後才是內容數量。所有效能結果都必須附裝置、瀏覽器、畫質、解析度、關卡 seed、build ID 與測試時間。

# 測試環境矩陣

## 必測環境

| 類別 | 環境 | 最低測試 |
| --- | --- | --- |
| Windows 桌機 | Chrome、Edge，1080p | 鍵鼠、手把、60 FPS 壓力場景、PWA 更新 |
| macOS | Safari | WebGL、音訊解鎖、IndexedDB、鍵鼠、重新整理恢復 |
| iPhone | 近三代中至少一台，Safari | 直向、橫向、主畫面 PWA、三局連跑、背景切換 |
| Android | 一台中階 Android Chrome | 觸控、Low 模式、手把切換、記憶體壓力 |
| 低效能模擬 | CPU 4x slowdown、慢速網路 | 載入、降階、操作回應與錯誤畫面 |

## 建議擴充

- iPad Safari
- 低記憶體 Android
- 高 DPI 4K 桌機
- Firefox
- Xbox、PlayStation 與通用藍牙手把各一種

# 自動測試層級

## 單元測試

- PRNG 固定輸出
- fixed timestep 與累積器
- 角色移動、碰撞與邊界
- 目標搜尋與 spatial hash
- 每個技能的冷卻、詠唱、命中與升級公式
- 每種首領預警 shape
- 經驗曲線、選卡 eligibility 與權重
- 掉落、裝備分數、卡片、精煉與天賦
- save migration 與 idempotency
- manifest 與權利 profile 驗證

## 整合測試

- 一局從 `Loading` 到 `Results`
- 關閉／重開後 checkpoint 恢復
- 結算 transaction 在每個故障點的結果
- asset gateway 缺檔、timeout、錯誤編碼與壞檔
- PWA 舊 cache 升級到新 build
- controller disconnect／reconnect
- 語言切換與缺翻譯 fallback
- 未來的雲端同步、房間、交易與排行

## 決定性 replay 測試

每個正式 build 保存以下 golden replay：

- 劍士標準通關
- 低生命大量補品憐憫值
- 250 敵人壓力場景
- Mastering 每種招式命中與閃避
- 選卡重抽與流派關鍵選擇
- 死亡前一 tick 與勝利前一 tick

同一內容版本的 final state hash 不得改變。若平衡或規則有意改變，必須更新 content version、差異說明與 golden replay，不能靜默覆寫。

# 功能驗收清單

## 開始與載入

- [ ] 沒有 asset gateway 時顯示可理解的設定指引，仍可進占位測試場。
- [ ] GRF 雜湊不符時拒絕載入並顯示目前值與預期值。
- [ ] 第一次載入顯示實際進度，不偽造百分比。
- [ ] 資產請求 timeout 可重試或返回標題，不白畫面。
- [ ] 更新中不會覆蓋正在玩的 build。

## 角色與操作

- [ ] 鍵盤、點地、觸控與手把都能單獨完成一局。
- [ ] 失焦、來電、切背景與手把斷線不留下卡住的移動。
- [ ] 直向／橫向切換不重置關卡。
- [ ] 虛擬搖桿不遮擋選卡與系統手勢。
- [ ] 接上手把後可隱藏搖桿。

## 戰鬥

- [ ] 普攻與技能只在合法目標、射程與時機施放。
- [ ] 詠唱中死亡、暈眩或關卡結束會取消 pending hit。
- [ ] 同一敵人不因低 FPS 被重複命中。
- [ ] 範圍、穿透、擊退、狀態與免疫有邊界測試。
- [ ] 自動技能不把角色移入危險區。
- [ ] 畫面大小不改變鎖敵距離、生成與傷害。

## 選卡與資訊

- [ ] 每張卡顯示實際舊值 → 新值。
- [ ] 三個選項至少一個對目前構築有效。
- [ ] 欄位滿時不出現無法裝備的新主動技能。
- [ ] 不可逆關鍵選擇有確認與完整說明。
- [ ] Tooltip 在最小手機 viewport 可完整閱讀及捲動。
- [ ] 手把焦點始終可見且不跳到畫面外。

## 首領公平性

- [ ] 預警與命中共用同一 shape ID。
- [ ] 圓形、扇形、直線、環形的視覺邊緣與命中邊緣誤差在允許範圍內。
- [ ] 音訊提示與 windup 時間一致。
- [ ] 低畫質仍保留全部危險預警。
- [ ] 近戰在每個階段都有合法輸出窗口。
- [ ] 狂暴增加壓力但不製造必死的無縫覆蓋。

## 結算與存檔

- [ ] 同一 run ID 只能結算一次。
- [ ] transaction 前、中、後 crash 都不會 duplication。
- [ ] 獎勵內容與結算畫面一致。
- [ ] 角色、裝備、卡片、寵物與設定重新整理後一致。
- [ ] migration 第二次執行不再次變更資料。
- [ ] 匯出、匯入與壞檔有明確結果。

# 效能與穩定性測試

## 標準壓力 seeds

建立固定 seeds：

- `PERF-050`：50 敵人、普通 VFX
- `PERF-250`：250 敵人、300 投射物、持續拾取
- `PERF-500`：500 敵人、桌機壓力
- `PERF-BOSS`：首領、召喚物、四種預警重疊
- `PERF-VFX`：所有可選技能達高等級，但遵守實際同時上限

每個 seed 跑 3 次，取中位數並保存 raw trace。

## 監測指標

- frame time p50、p95、p99
- simulation tick p50、p95、max
- long task 數與時間
- draw calls、triangles、visible instances
- JS heap 與每分鐘趨勢
- texture 數、估算 GPU memory
- audio voices
- pool capacity 與 fallback allocation
- 資產請求數、bytes 與 decode time

## Leak 測試

1. 進入關卡、玩 2 分鐘、回城，重複 10 次。
2. 每輪強制等待資源 GC／卸載窗口，不手動呼叫瀏覽器私有 GC 作唯一證據。
3. 檢查玩家、敵人、texture、audio、event listener、timer 與 DOM node 數。
4. 若 heap 呈線性增加，定位 retained path 後再增加內容。

## 降階驗收

- Auto 模式在 frame p95 超標後逐步降低次要特效。
- 降階不得隱藏預警、危險投射物、玩家、首領或 HP。
- 降階恢復要有 hysteresis，避免品質每秒上下跳動。
- 玩家可手動鎖 Low／Medium／High，不被 Auto 覆蓋。

# 內容與平衡測試

## 自動模擬

使用簡化 bot 跑每職業、每關卡、每主要流派至少 1,000 個 seeds，找出：

- 完全不被選的技能
- 選到後勝率下降的陷阱升級
- 單一技能占總傷害過高
- 首領擊殺時間極端值
- 開局 60 秒沒有清群能力的比例
- 補品與傷害尖峰造成的不可控死亡

Bot 不能取代真人手感測試，只用來找異常與回歸。

## 真人測試記錄

每場至少記錄：

- 職業、裝備分數、關卡、難度、seed
- 選卡順序與最終構築
- 通關／死亡時間
- 死亡來源
- 首領擊殺時間
- 技能傷害占比
- FPS／memory profile
- 玩家一句最喜歡與一句最困惑的內容

## 平衡停止條件

- 標準難度常見流派首領低於 20 秒或高於 180 秒。
- 任一職業能長時間站立不動通關。
- 任一職業因首領飛行／無敵機制長時間無合法輸出。
- 常見升級存在負面效果卻未明確說明。
- 某職業通關率比其他職業低 15 個百分點以上。

# 多人與後端測試

多人未實作前不建立假通過紀錄。Phase 6 後加入：

## 網路

- 50、100、200 ms RTT
- 0、1、5% packet loss
- 20 至 100 ms jitter
- 封包重排與重複
- 5、15、30 秒斷線後重連
- 房間伺服器優雅重啟與非預期 crash

## 安全

- 客戶端修改 HP、速度、冷卻、掉落與物品資料
- 重放舊 input 或結算封包
- 超高速 input、巨型 payload、壞 schema
- 越權讀取其他帳號角色
- session fixation、token 重用、CSRF／CORS 設定
- SQL injection 與 log injection
- 聊天 spam、Unicode 混淆、惡意連結與檢舉濫用

## 經濟

- 兩邊同時交易同一物品
- 確認後斷線
- 重送交易 request
- 庫存滿、帳號被凍結、物品已裝備、物品剛被精煉
- 時鐘偏移與跨日次數
- 管理員回滾與 audit chain

# 素材與授權驗收

每次 release 產生 machine-readable 報告：

- build profile
- 每項素材 ID、來源、雜湊、owner、licenseClass、redistribution
- 第三方程式版本與 license
- 缺少 attribution、未知來源或不允許於該 profile 使用的項目
- release archive 內被阻擋的副檔名與大型未知二進位檔

`fan-local` 可以使用 `local-fan-use`，但只發本機啟動工具，不把 GRF 打包。`fan-public` 若任一素材仍是 `not-cleared`，發行工作必須停止並輸出清單。

# 發行流程

## 封閉本機版

1. 標記版本與 content version。
2. 執行完整 lint、typecheck、unit、integration、Playwright、build、rights check。
3. 以乾淨瀏覽器 profile 執行首次安裝。
4. 驗證 GRF 路徑設定、錯誤指引、單局、結算、重啟。
5. 打包的只有程式、設定範例與授權文件；不含 GRF。

## 私人 LAN 版

1. 從 loopback 改為明確私人網卡，禁止綁 `0.0.0.0` 當預設。
2. 列出實際 LAN 網段與 Windows 防火牆規則。
3. 啟用 HTTPS；驗證 iPhone／Mac 憑證與 PWA。
4. 不開路由器 port forwarding。
5. 從另一台裝置確認除必要連接埠外，資料庫與內部服務不可達。

## 非營利公開測試

1. 先通過 `fan-public` 素材權利閘門。
2. 顯示非官方、非營利、無關 Gravity／營運商／Reven4nt 的聲明。
3. 上線 staging，使用獨立測試帳號與資料庫。
4. 10 至 30 人 canary；觀察 48 小時再擴大。
5. 設同時在線上限、排隊與降載，不讓過載破壞資料。
6. 公開狀態頁、問題回報、隱私與刪除管道。
7. 不開廣告、付費道具、付費抽卡、現金交易或付費優先排隊。

# 發行阻擋條件

出現下列任一項，不得發行：

- 可重現的 duplication、進度倒退或存檔損壞。
- 首領預警與命中重大不一致。
- iPhone 標準流程仍頻繁重載。
- 權利 manifest 有未知或不符合目標 profile 的素材。
- release archive 含 GRF、帳密、`.env.local`、私鑰或資料庫 dump。
- 後端沒有可驗證備份與回滾。
- 高嚴重度依賴漏洞或越權問題未處理。
- 文件宣稱已通過的裝置或功能其實沒有實測證據。

# 事故處理

## 資料事故

1. 暫停會增加或轉移物品的寫入。
2. 保留 log、audit、build 與受影響 revision，不先清理證據。
3. 從 item／run provenance 界定範圍。
4. 在 staging 重演並確認修正。
5. 必要時回滾 transaction 或封鎖特定物品，不做無差別清空。
6. 發布影響、處置與避免復發說明。

## 效能事故

1. 先以 feature flag 降低次要 VFX、怪物上限或關閉問題技能。
2. 保留預警與 simulation 精度。
3. 保存受影響裝置與 trace。
4. 修正通過標準 seed 後逐步恢復。

## 素材或權利通知

1. 記錄通知來源、目標素材與時間。
2. 立即用 manifest 找出所有 build、atlas、關卡與快取依賴。
3. 先停用相關素材或整個公開 profile；私人開發資料不對外散布。
4. 清除 CDN／service worker cache 並驗證。
5. 以 placeholder 或替代素材恢復，不用改戰鬥核心。

