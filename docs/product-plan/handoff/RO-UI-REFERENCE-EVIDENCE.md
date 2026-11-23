# RO UI clean-room 參考證據

狀態：研究完成；本文件只記錄公開可觀察的畫面、操作與 clean-room 設計決策。未檢視、反編譯或抄錄 HANS／RO Survivors 的 bundle、DOM、CSS 或封閉原始碼，也不保存或交付公開錄影的原始截圖。

## 1. Evidence status

| 標記 | 意義 | 可否當成像素規格 |
| --- | --- | --- |
| `OBSERVED` | 從公開實機錄影、公開頁面、官方手冊或本機開源研究實作直接確認 | 只能支持實際看到的功能、相對位置與行為；網路畫面不能取代本機素材 |
| `INFERRED` | 由多個 observed facts 推導的響應式布局或輸入規則 | 不可宣稱是 HANS／官方原排版；需以測試與本機 reference profile 驗收 |
| `ORIGINAL-DESIGN` | 為本專案新設計的 Survivors × Classic RO 融合方式 | 必須只使用核准的本機 RO 素材，不得模仿或搬用封閉 UI 實作 |

## 2. 公開來源

- RO Survivors 作者公開介紹：<https://www.reddit.com/r/RagnarokOnline/comments/1xmyhng/ro_survivors_a_free_browser_survivors_game_with/>
- RO Survivors 操作整理：<https://snyr.tw/games/ro-survivors>
- 公開玩家實機錄影討論串：<https://gaia.komica1.org/00b/pixmicat.php?res=31102800>
- HANS 公開首頁：<https://ro.hans-webgametw.com/>
- HANS 公開 credits：<https://ro.hans-webgametw.com/credits.html>
- HANS 公開法律／素材聲明：<https://ro.hans-webgametw.com/legal.html>
- Gravity Game Hub 快捷鍵指南：<https://ro.gnjoy.asia/gameguide/?gg=3>
- iRO 基本介面：<https://playragnarok.com/gameguide/howtoplay_interface01_test.aspx>
- iRO 鍵盤快捷鍵：<https://www.playragnarok.com/gameguide/howtoplay_interface03.aspx>
- 本機唯讀研究使用的 GPL 專案：<https://github.com/MrAntares/roBrowserLegacy>，研究 commit `5435cf67642eac8281f9a7a94c92f98428db471e`。

HANS 公開 credits 明示遊戲圖形、音效與音樂來自 RO client，但其程式與介面仍是專案自有成果。因此本專案只參考公開可見功能，不使用 HANS 下載圖、卡片底板、字型配置或封閉程式。

## 3. Survivors 實機觀察

以下項目均為 `OBSERVED`。桌機與手機錄影來自公開玩家分享，且錄影中的網址為 `ro-survivors.com`；不得據此宣稱 HANS 每一版本具有完全相同的像素布局。

### 3.1 戰鬥 HUD

- 左上玩家資訊包含人物頭像、名稱／職業、目前／最大 HP、EXP 百分比與本局等級。錄影片段中沒有看到常駐 SP 顯示。
- 上方中央顯示倒數或經過時間；其下另列擊殺、Zeny／戰利品類計數。
- MVP 出現時，上方中央增加 MVP 名稱與長條 HP gauge。
- 右上為方形 minimap，含地圖名、玩家方向標記、怪物／事件標記與缩放控制。手機版把時間與統計資訊移到 minimap 下方。
- Pause 是獨立按鈕；桌機與手機都可在不中斷 HUD 辨識的地方操作。
- 下方中央有兩層槽位：較小的一列呈現被動／裝備類狀態，較大的一列呈現技能；技能 icon 上可見 cooldown 數值，空位以待選槽表示。
- 桌機可顯示傷害統計面板；公開操作資料記載 `K` 為切換鍵。
- 公開戰鬥畫面未見常駐背包或完整聊天視窗。公開法律說明可確認聊天主要屬於 Prontera plaza／帳號社交功能，因此 Phase 1 不應把戰鬥 chat 冒充成原作既有布局。

### 3.2 Level-up／寶箱選擇

- 升級時戰鬥畫面進入深色遮罩且停止互動，頂部顯示升級標題、本局等級與本級獎勵。
- 畫面會先列目前技能數量與已持有技能 icon，再提供三個選項。
- 桌機是三張直式卡片橫排；手機是三張橫式選項縱排。
- 每個選項包含類型／稀有度、RO 技能或物品 icon、名稱、分類與效果描述；新取得項目有可辨識的新項目標記。
- 桌面選項可由 `1`、`2`、`3` 對應；底部有整組重洗與剩餘次數提示。
- 寶箱選擇沿用相同資訊架構，另可出現單項重洗與整組重洗。
- 作者公開說明確認：每次升級三選一，可取得新技能、既有技能升級或 Deity 版本；技能本身自動施放。

### 3.3 Mobile 與操作

- 手機實機有左下虛擬搖桿、下方中央技能槽、左上 compact player info、右上 minimap，選項改為單欄縱排。
- 公開操作資料另確認手機可輕點地面移動，雙指可旋轉／縮放。
- 桌機操作包含 WASD／方向鍵／點地移動、`Q`／`E` 或滑鼠右鍵拖曳旋轉、滾輪縮放、`Esc` 暫停／返回、`M` 靜音及 `K` 傷害統計。
- HANS 公開首頁可直接確認 Prontera 中 `C` 開角色、`X` 更換角色、`Esc` 開選項；角色功能含裝備、物品欄、卡片、寵物、狀態與職業。

## 4. Classic V0 研究基準

下列為本機 roBrowserLegacy 與官方 RO 手冊交叉核對所得的 `OBSERVED` 搜尋提示，不直接等同目標 KRO client 的正式像素 golden：

- Classic Basic Info V0 約為 `280×120` expanded、`280×33` minimized，典型位置為左上；內容含姓名／Job、HP／SP、Base／Job Lv 與 EXP、Weight／Zeny，以及功能按鈕。
- Status 約 `280×130`，包含 STR／AGI／VIT／INT／DEX／LUK、bonus、需求與衍生戰鬥數值。
- Shortcut 每列 9 格、icon 約 `24×24`，可有 1–4 列；支援拖入 skill／item、雙擊使用、右鍵資訊及 cooldown 表現。
- MiniMap 基準畫布為 `128×128`，典型 anchor 為右上，另有座標、縮放與 world-map controls。
- Inventory 使用 17px 級 titlebar、32px 級 grid cell 與 24px 級 icon；Chat 為左下頁籤式 log／input；buff icon 為右側 32px 級直排。
- 經典 RO 視窗行為包含 titlebar drag、focus 提升 z-order、viewport clamp、位置保存、minimize／close 與 modal input ownership。
- 官方快捷鍵支持 `Alt+E` Inventory、`Alt+A` Status、`Alt+Q` Equipment、`Alt+S` Skill、`F12` Hotkey Bar、`F11` UI visibility、`Insert` sit／stand；實際語意仍須由鎖定的 target client profile 決定。

roBrowserLegacy 的 `MobileUI` emoji、CSS 圓形按鈕與漸層是社群新增，不是 RO 原始介面證據，正式 build 不得採用。

## 5. Classic V0 融合決策

### 5.1 決策狀態

- `ORIGINAL-DESIGN`：採用「Survivors 的資訊架構與錨點，套用同一套 Classic V0 RO skin」；不重製 RO Survivors／HANS 的專有藍白卡面。
- `INFERRED`：桌機保留左上玩家資訊、上中 timer／counters、右上 minimap、下中 skill bar、中央 MVP bar；手機保留 compact HUD 與單欄三選一。
- `OBSERVED`：正式可見素材閉包已在 `ro-ui-original-assets.csv` 中建立，包括 BasicInfoV0、gauge、common window、button states、hotbar、minimap、cursor、技能 icon 與 KRO 字型。
- 精確尺寸與 crop 仍以本機 KRO 2021 reference profile 為唯一視覺權威；在 profile 標成 `LOCKED` 前，不得把上述 roBrowser 研究值宣稱為正式 golden。

### 5.2 元件映射

| Survivors 功能 | Classic V0 融合方式 | Status |
| --- | --- | --- |
| 玩家 HP／名稱／職業 | 使用 BasicInfoV0 原始背板與 gauge；SP 保留原義 | `ORIGINAL-DESIGN` |
| 本局 Lv／EXP | 使用獨立的 RO window primitive，不把 SP 欄冒名改成 EXP | `ORIGINAL-DESIGN` |
| Timer／kills／Zeny／loot | 以原始 title/body/footer 或 gauge slices 組成窄資訊窗 | `ORIGINAL-DESIGN` |
| 底部技能槽 | 使用原始 Classic shortcut frame、slot 與原 skill icon；文字標示自動施放 | `ORIGINAL-DESIGN` |
| Level-up 三選一 | 保留 observed 三選一與桌機／手機排列，卡片改由原始 RO window／button primitives 組成 | `ORIGINAL-DESIGN` |
| Pause | `Esc` 開原始 RO Escape／message-window 風格的 Continue、Settings、Controls、Abandon | `ORIGINAL-DESIGN` |
| Inventory／Status／Skill | 在廣場採 classic draggable windows；快捷鍵遵循鎖定 profile | `INFERRED` |
| Mobile movement | KRO 2021 沒有可驗證的原生 joystick 素材；正式版先使用點地／拖曳與官方 cursor feedback | `INFERRED` |

## 6. Clean-room 與驗收限制

1. 不讀取或複製 HANS／RO Survivors bundle、source map、DOM、CSS、網路下載圖或封閉程式碼。
2. 公開錄影只用於人工觀察；不把錄影截圖、裁圖、trace 或 visual golden 放入 repo。
3. Formal build 的可見 raster 必須來自本機 GRF／核准 filesystem allowlist，並有 canonical path、source container、bytes 與 SHA-256。
4. 不使用 emoji、AI 圖、自製 SVG、CSS gradient、CSS 圓形 joystick、Canvas primitive 或 placeholder 代替 RO 素材。
5. 缺素材時 fail closed，列出 logical asset ID 與 canonical path；不可用「接近」的自繪介面繼續。
6. 手機 touch hit area 可以透明擴大，但不得增加自創可見底圖。Classic desktop KRO 缺 joystick 素材時，點地移動是正式可接受方案。
7. 先驗收 `ui-reference-profile`、asset manifest 與同年代 skin 一致性，再施工正式 HUD；禁止 BasicInfo V0 與 V5 `menu_icon` 混搭。

最終設計句：**保留 RO Survivors 可公開觀察的戰鬥資訊與操作節奏，所有正式視覺改由使用者本機同一 profile 的 Classic V0 RO 素材呈現。**
