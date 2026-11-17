# RO 原始操作介面素材閉包（KRO 2021）

交付檔：`ro-ui-original-assets.csv`

鎖定 profile：`KRO2021_CLASSIC_V0_FAN`。每一列的 `notes` 都以
`profile=KRO2021_CLASSIC_V0_FAN;` 開頭；不得和 BasicInfo V1、V5 `menu_icon` 或 minimap V2 混搭。

## 驗證摘要

- UI rows：108（106 筆 GRF + 2 筆 `filesystem:System` 字型）
- unique asset IDs：108
- unique canonical paths：108
- 與 `fan-local-asset-whitelist-v2-174.csv` 重複 asset ID：0
- 與 `fan-local-asset-whitelist-v2-174.csv` 重複 canonical path：0
- CSV SHA-256：`B40096677791009A616015BA068FA60A8949F461D2ED086B13793E5435F4707E`
- LF only、末尾有 newline
- 106/106 GRF rows：來源 bytes、SHA-256、raw filename bytes、CP949 decode、URI round-trip、archive precedence 全部 PASS
- 108/108 rows：bytes、SHA-256、URI round-trip 全部 PASS
- 既有 174 rows 後直接附加本檔（跳過本檔 header）時：282 rows、125,131 bytes、SHA-256 `63EA6798B842AA6DCC65B00E09D3BBD88AA74467BC75594B5A9490F0C5C6A4DB`

## 素材範圍

| 類別 | rows | 用途 |
| --- | ---: | --- |
| `ui_cursor` | 2 | 官方 `cursors.spr/.act`，ACT 2.5、14 actions |
| `ui_status_hud` | 11 | 經典 BasicInfoV0 背板、HP/SP 與空量表三段素材 |
| `ui_status_control` | 6 | base、minimize、close 的 normal/hover |
| `ui_main_menu_button` | 16 | BasicInfoV0 全部八顆按鈕：status、equipment、inventory、map、skill、option、friends、chat 的 normal/active |
| `ui_hotbar` | 3 | 官方九格快捷列、resize grip、slot selection |
| `ui_window_chrome` | 9 | title/body/footer 三段式視窗框 |
| `ui_button_chrome` | 12 | normal/hover/pressed/disabled 的 left/mid/right 三段式按鈕 |
| `ui_scroll_arrow` | 4 | left/right/up/down |
| `ui_minimap` | 6 | `prt_fild08.bmp`、玩家箭頭、classic minimap plus/minus normal/hover |
| `ui_chat` | 25 | chat/system log 背板與五片、input、三態按鈕、mode、lock、minimize、stick、battle、scroll controls |
| `ui_skill_icon` | 11 | 十個劍士官方技能圖示 + 一個核准語意重用的官方十字軍盾技圖示 |
| `ui_number_sheet` | 1 | 官方物品數量數字圖集 |
| `ui_font` | 2 | `SCDream4.otf`、`SCDream6.otf` |

## Archive precedence

Audit 依 `rdata.grf` → `data.grf` 的客戶端覆蓋順序查找。這個最小閉包的 106 筆 GRF path 全部只存在於 `data.grf`，所以 CSV 中 `source_container=data.grf`、`rdata_override=false` 是實測結果，不是未檢查的預設值。未把同名舊版素材誤選進來。

## 劍士 10 個官方 icon

| source ID | source key | canonical file |
| ---: | --- | --- |
| 2 | `SM_SWORD` | `item\sm_sword.bmp` |
| 3 | `SM_TWOHAND` | `item\sm_twohand.bmp` |
| 4 | `SM_RECOVERY` | `item\sm_recovery.bmp` |
| 5 | `SM_BASH` | `item\sm_bash.bmp` |
| 6 | `SM_PROVOKE` | `item\sm_provoke.bmp` |
| 7 | `SM_MAGNUM` | `item\sm_magnum.bmp` |
| 8 | `SM_ENDURE` | `item\sm_endure.bmp` |
| 144 | `SM_MOVINGRECOVERY` | `item\sm_movingrecovery.bmp` |
| 145 | `SM_FATALBLOW` | `item\sm_fatalblow.bmp` |
| 146 | `SM_AUTOBERSERK` | `item\sm_autoberserk.bmp` |

`SM_SWORD` 可由 basic slash 與 sword mastery 共用同一 asset ID；不得為了 runtime alias 在白名單重複列同一 canonical path。

產品已核准 `skill.sw.shield_wave` 語意重用官方 RO 十字軍圖示：source ID `251`、source key
`CR_SHIELDBOOMERANG`、asset ID `ui.skill.cr_shieldboomerang.icon`、canonical file
`item\cr_shieldboomerang.bmp`。該檔是本機 `data.grf` 的原始 RO 24×24 BMP，不是自創圖；bytes `1782`、
SHA-256 `313fcef3fe9b4a9eff610c58c759d31c110b74283e9a081d549fef0db6f18f8b`。

## 給 Claude 的施工限制

1. CSV 是新增閉包，不是要替換既有 174 rows。合併時保留 v2 header，只附加本檔第 2 行起的 108 rows，並同步更新 validator 的 rows/hash。
2. Formal UI 不准用 CSS gradient、圓角色塊、手繪框線或 placeholder texture 代替素材。HUD、快捷列、視窗、按鈕與游標必須由 CSV 的 asset ID 經 gateway 載入。
3. 三段素材要用 left + repeat/stretch mid + right 組合；像素圖採 nearest filtering，不得做 AI 放大或平滑重繪。
4. `SCDream4/6` 是從本機 KRO 客戶端素材根目錄的 `System\Font\` 讀取，不是 Windows Fonts，也不是向作業系統借用的字型。實測大小/hash 分別為 `729724 / 1dc288e8cfdf96eb083c0b016fb5f107bc83208e748b6a61422404b9e42a95a4`、`743480 / 7dd3e0240002feedd37d0f33033a44e17b1ab11f84a93acf8482184adc33aa1a`。gateway 要新增精確的 `filesystem:System` allowlist；不得開放任意 filesystem path。
5. Minimap 使用 classic `map_plus0/1.bmp`、`map_minus0/1.bmp`、官方 `map\prt_fild08.bmp` 與 `map_arrow.bmp`；座標、旋轉、裁切由 renderer 做，不能生成替代 minimap 圖，也不能混用 minimap V2 的 `i_*` 控制列。
6. Chat/System Log 的背景、三段框、分隔線、輸入列與 controls 都在本閉包；不可用半透明 CSS panel 取代。
7. 正式 build 缺任一 `required=true` 素材時，沿用 fail-closed 規則：列 asset ID + canonical path 並阻擋，不可回退成自繪介面。

## 明確 GAP

### GAP-UI-001 — 桌面 KRO 2021 沒有原生虛擬搖桿素材

對 `data.grf` 與 `rdata.grf` 的 UI/sprite filename 搜尋 `joystick`、`virtual_pad`、`virtualpad`、`analog`、`touchpad`、`mobile_pad`、`mobilepad`，結果都是 0。桌面 KRO 的官方輸入是滑鼠游標／點地移動，不能憑空畫圓形搖桿。

Phase 1 可接受的 formal 行為只有：

- 桌機使用官方 `cursors.spr/.act` 與點地移動；手機也採點地／拖曳移動並沿用官方 cursor feedback；或
- 暫停手機虛擬搖桿，等使用者提供有權使用且能驗證來源的官方手機 RO client 素材。

禁止把 synthetic joystick、CSS 圓、透明色塊或 AI 生成圖放進 formal build。測試 fixture 仍可使用 synthetic，但必須保留 `TEST FIXTURE` 標示。

## 已解決決策

### GAP-UI-002 — RESOLVED：`skill.sw.shield_wave` 官方圖示語意重用

`shield_wave` 是 `ORIGINAL_SURVIVOR_ADAPTATION`，沒有同名官方劍士圖示。產品已決定使用
`ui.skill.cr_shieldboomerang.icon`（官方 `CR_SHIELDBOOMERANG`）作 semantic reuse。Claude 必須在
DECISIONS 記錄此對應；禁止重新繪製、AI 生成或改造該圖。此決策只解決圖示資產，不把原創技能誤稱為
RO 官方技能。
