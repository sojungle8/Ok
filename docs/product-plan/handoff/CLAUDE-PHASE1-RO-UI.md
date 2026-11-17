# Claude 下一步指令：Phase 1 原始 RO 操作介面

狀態：Codex 先以 commit `d804aa2` 做唯讀 UI 驗收；目前 Claude 已做到 commit `59dcabd` 的 synthetic Phase 2。該 synthetic 實作可以保留，不必回退，但不能據此把正式 RO 素材或正式 RO UI 標成 PASS／ACCEPTED。本文件規範接下來的正式操作介面施工與驗收。

搭配文件：同資料夾的 `CLAUDE-PHASE1-ORIGINAL-ASSETS.md`、`fan-local-asset-whitelist-v2-174.csv`。兩份規格同時有效；若名稱或 commit 編號衝突，本文件一律使用 `UI-*` 前綴區分。

## 0. 執行順序與硬閘門

目前可以先做 `CLAUDE-PHASE1-ORIGINAL-ASSETS.md` 的 **Commit A**。在它完成以前，不要修改玩家 HUD。

UI 工作必須依下列順序：

1. 完成原始素材 Commit A：套用 canonical whitelist、修好 dependency contract 與正式素材 fail-closed。
2. 做本文件的 **UI-A：reference profile 與原始 UI 素材盤點**。
3. UI-A 只可提交 manifest、解析器／gateway contract、量測資料與測試；不得憑印象畫 HUD，也不得先決定某個網路截圖的 UI 版本。
4. 將 UI-A 的 client build、skin、canonical paths、hash、native dimensions、按鈕狀態與量測報告交 Codex 驗收。只有 reference profile 被明確標成 `LOCKED` 後，才可做 UI-B 以後的正式 HUD。
5. 任一核心 UI 素材缺失、版本混用或來源不明，停止，不做 CSS／Canvas 替代圖，列出 exact asset ID、container 與 canonical CP949 path。

原因：RO 不同年代的 Basic Info、Shortcut、MiniMap、Chat 與按鈕圖差異很大。本機唯讀研究樹已有 BasicInfo V0–V5，證明不能把不同版本拼成一套再宣稱「接近原版」。

## 1. `d804aa2` 的 UI 驗收判定

### 1.1 已通過的部分

- 無 gateway 或必要場景素材缺失時，正式 world canvas 不建立。
- formal build 拒絕 synthetic fixture；synthetic 只准測試 build 使用。
- 缺場景素材時會列出 canonical path，不再以角色／草地 placeholder 開跑。

### 1.2 尚未完成、會阻擋 RO UI 驗收的部分

- `apps/client/src/App.tsx:146-179` 只有 world canvas、開發診斷 HUD 與虛擬搖桿。
- `App.tsx:147-165` 把 Project、Profile、Build、Gateway、FPS、tick、draw calls、GAT debug 指令直接放在玩家畫面；這不是 RO 玩家介面。
- `apps/client/src/style.css:1-40` 使用 `system-ui`、自訂 light/dark 色票、半透明背景與圓角卡片；外觀會隨 OS 深色模式改變。
- `style.css:41-61` 的搖桿底與 knob 是 CSS 圓、邊框、半透明色塊，屬正式畫面的自創視覺，必須移除或只留在 synthetic 測試 build。
- `apps/client/src/game/input.ts:7-80` 只有 WASD／方向鍵與連續向量 joystick；沒有 RO 的 world click、target、camera、cursor、shortcut、chat 與視窗快捷鍵路由。
- `apps/client/src/game/requirements.ts` 只列場景素材；沒有 UI skin、cursor、button states、shortcut、chat、minimap 的 formal requirements。
- 沒有 Basic Info、Shortcut、MiniMap、Chat／System Log、RO window manager、level-up、pause、result 與 Boss HP 的 RO 視覺實作。
- 手機規則只有縮字，沒有安全區、資訊收折、觸控衝突與 modal input ownership。

結論：`d804aa2` 的 **formal scene policy guard PASS**，但 **RO player UI NOT DONE**。不得把現有 HUD 截圖當作 RO UI 成果。

## 2. 視覺來源與禁止事項

### 2.1 唯一正式視覺來源

正式畫面中的下列像素只能來自使用者本機 RO client：

- 視窗框、底板、角、標題列、分隔線；
- 按鈕 off／on／hover／down／disabled 狀態；
- HP／SP／EXP／Boss 等 gauge 的底與填充圖；
- 快捷格、物品格、技能格、頁籤、箭頭、鎖定、縮小、關閉圖；
- skill／item／menu icon；
- minimap chrome、標記與控制圖；
- mouse cursor、ground cursor、target／attack／pick／no-walk 等狀態；
- joystick 或觸控提示若要顯示可見圖，也必須由核准的本機原始 RO asset 組成。

DOM 文字、資料值、透明 hit area、Flex／Grid／absolute positioning 與事件處理可由程式實作。這項許可不等於可用 CSS 畫裝飾。

### 2.2 正式 build 明確禁止

- `linear-gradient`、`radial-gradient`、`conic-gradient`；
- 用 `border-radius`、border、box-shadow、背景色畫出的卡片、按鈕、圓形搖桿、bar、tooltip 或 window frame；
- Canvas 2D／WebGL primitive 畫 UI frame、gauge、shadow、joystick 或 icon；
- 自製 SVG、emoji、圖示字型、AI/ImageGen 圖、程序產生 texture；
- 用網路下載圖片取代本機 client asset；
- 將 roBrowserLegacy、HANS 或其他封閉／第三方 client 的 UI 程式碼搬入 repo；只能唯讀研究行為與 asset 名稱，再 clean-room 實作；
- 將本機原始 RO bitmap、衍生 atlas、client 截圖或 visual golden PNG 提交 Git／GitHub；
- 在 production HUD 顯示 Build、Gateway、FPS、tick、draw calls、TEST FIXTURE 或其他開發診斷資料。

透明背景、`pointer-events`、clip／overflow、純布局 border-box 與文字顏色不屬裝飾替代，但仍要由 reference profile 決定最終數值。

### 2.3 研究資料的權威順序

1. 使用者本機 RO client 的同一 build、同一 default skin：**唯一視覺權威**。
2. 本機 client 實際操作截圖：布局與互動量測權威，不提交 repo。
3. Gravity／各地官方操作手冊：行為與快捷鍵參考。
4. roBrowserLegacy／其他玩家分享：只能用來找可能的檔名或測試假設，不可當素材來源或直接複製實作。

官方行為參考：

- Gravity GGH shortcut：<https://ro.gnjoy.asia/gameguide/?gg=3>
- kRO shortcut：<https://ro.gnjoy.com/guide/ragstart/interface3.asp>
- kRO camera：<https://ro.gnjoy.com/guide/ragstart/interface5.asp>
- jRO window guide：<https://ragnarokonline.gungho.jp/playmanual/operation/window.html>

## 3. UI-A：reference profile 與素材 contract

### 3.1 必須交付的 reference profile

新增一份可機器驗證的 profile，至少包含：

```text
profile_id
client_build_identifier
skin_name
source_container_priority
capture_date
capture_viewport
capture_dpi_scale
locale/codepage
component_version_map
status = DISCOVERED | REVIEWED | LOCKED
```

`component_version_map` 至少含：BasicInfo、Shortcut、MiniMap、Chat、Cursor、CommonWindow、Button、Tooltip、Status、Inventory、Skill、Pause／MessageBox。所有項目必須來自同一 compatible profile；若 client 真的會混用不同資料包，要用來源優先序與實際 client 截圖證明。

### 3.2 UI asset manifest schema

每一筆至少記錄：

```text
logical_asset_id
source_container
canonical_cp949_path
canonical_cp949_raw_hex
source_size
source_sha256
format
native_width
native_height
role
state
nine_slice_insets_or_null
cursor_hotspot_or_null
transparent_key_or_alpha_mode
reference_profile_id
```

`role` 至少可區分 frame、button、gauge、slot、icon、cursor、minimap、chat、tooltip。`state` 至少支援 off、on、hover、down、disabled；沒有某狀態時必須以實際 client 行為說明，不能由 CSS 變暗或變色補出。

gateway 仍只能接受 logical asset ID。不得增加「前端傳任意 path 就可讀 GRF」的端點。

### 3.3 核心 UI asset gate

進入 `running` 前必須一次確認：

- Basic Info expanded／minimized 所需全部圖；
- Shortcut frame、slot、page／row controls 與必要 icon；
- MiniMap chrome 與 controls；
- Chat frame／input／tabs／resize controls；
- common close／minimize／lock／resize／tab／scroll controls；
- formal cursor SPR／ACT 或該 profile 的等效原始檔；
- player 初始 HP／SP／EXP gauges；
- level-up、pause、result 可組成合法 RO window 的 core frame/button assets。

任何一筆缺失：formal world canvas 不建立。尚未開啟的次要視窗也不得使用 substitute；如果允許 lazy-load，開啟時只能顯示純文字 blocked diagnostics，且不能假裝成完成的 RO window。

### 3.4 UI-A 停止點

UI-A 結束時只可有：manifest、source audit、derived contract、reference metrics、profile comparison、synthetic structural fixture 與測試。不得有「先畫一套差不多的 HUD」。交付報告需列：

- 掃描的 containers 與優先序；
- 每類 found／missing／ambiguous 數；
- profile 混用檢查；
- 所有 source hash；
- 未決定項目與需要 Codex 選擇的選項。

## 4. Pixel metrics contract

### 4.1 固定驗收 viewport

| Profile | CSS viewport | DPR | 用途 |
| --- | ---: | ---: | --- |
| Desktop primary | 1280×720 | 1 | 與本機 client 主 reference 對照 |
| Desktop wide | 1920×1080 | 1 | anchor、magnet、空白伸展驗收 |
| Mobile portrait | 390×844 | 3 或裝置實際值 | 主要手機版驗收 |
| Mobile landscape | 844×390 | 3 或裝置實際值 | 旋轉與低高度驗收 |

reference capture 的 OS display scaling 必須記錄。CSS viewport 與實際 PNG pixel size不可混為一談。

### 4.2 原始 bitmap 規則

- UI 圖以 source native pixels 為基準；只准 `1×`、`2×`、`3×` 整數倍率。
- 禁止 fractional transform scale、瀏覽器平滑放大與任意 stretch。
- sprite／icon 使用 nearest／pixelated；nine-slice 只拉伸 manifest 指定的 stretch region，角與邊不可變形。
- 桌機預設 `1×`。高 DPI 不代表 CSS 尺寸自動乘 DPR；DPR 只影響 backing store。
- 手機 icon 視覺可維持原始 `24×24` 等 native size，外層用透明 hit area 擴到最少 `44×44 CSS px`。透明 hit area 不得增加自創可見底圖。
- source asset 若本來不是 24×24，以 manifest native dimensions 為準，不可強裁。

### 4.3 Reference-locked 元件尺寸

下列尺寸在 UI-A 前不得硬編碼為正式值。UI-A 必須輸出 `ui-reference-metrics.json`：

```json
{
  "profileId": "...",
  "desktop1280x720": {
    "basicInfoExpanded": { "x": 0, "y": 0, "w": 0, "h": 0 },
    "basicInfoMinimized": { "x": 0, "y": 0, "w": 0, "h": 0 },
    "shortcut": { "x": 0, "y": 0, "w": 0, "rowHeight": 0, "slots": 9 },
    "miniMap": { "right": 0, "top": 0, "w": 0, "h": 0 },
    "chat": { "left": 0, "bottom": 0, "w": 0, "collapsedH": 0, "expandedH": 0 }
  },
  "font": {
    "family": "...",
    "sizePx": 0,
    "lineHeightPx": 0,
    "weight": 0,
    "outlineOrShadow": "..."
  }
}
```

本機 roBrowserLegacy 的 V0 研究值曾出現 Basic Info `280×120`、minimized `280×33`、Shortcut 9 slots／row、24px icon；這些只能作為 **搜尋與量測提示**，不是 target client 的正式值。必須由實際 local client profile 再確認。

### 4.4 桌機布局與容差

reference profile 鎖定後，預設 anchor 應保持經典 RO 關係：

- Basic Info：左上；
- Shortcut：依同版本 client 的預設位置，通常位於上方並與 Basic Info／MiniMap 保持 reference 間距；
- MiniMap：右上；
- Chat／System Log：左下；
- modal／inventory／skill／status：原版預設位置，可拖曳並取得最上層 focus；
- Survivors timer／wave／kill 不得把原版 HUD 推位；使用獨立 RO window primitive，放在 reference 空白區。

桌機驗收容差：

- bitmap 元件 source crop、state、native width／height：必須完全一致；
- anchor、frame 邊緣、slot 位置：最多 `±1 CSS px`；
- 文字 baseline：最多 `±1 CSS px`，且 font fallback 必須記錄；
- 不允許元件重疊、出 viewport、因 `prefers-color-scheme` 變色；
- 拖曳後座標保存到整數 CSS px，reload 後誤差 `0 px`。

### 4.5 手機 390×844 與 844×390

手機是 RO 視覺語言的 responsive adaptation；除非有相同官方手機 client reference，不得聲稱與桌機原版 pixel-identical。

固定規則：

- 所有 edge offset 必須加 `env(safe-area-inset-*)`；額外 layout gutter 為 `8 CSS px`。
- 可見 control hitbox 最少 `44×44 CSS px`；相鄰 hitbox 間至少 `4 CSS px`，可見 bitmap 仍保持 native size並置中。
- top persistent HUD 不可超過 viewport 高度的 `18%`；bottom persistent controls 不可超過 `22%`。超過時必須收折內容，不可縮到 fractional scale。
- portrait：Basic Info 使用 profile 的 minimized state，anchor 左上；MiniMap anchor 右上。若兩者 native bounds 無法同列，MiniMap 收成原版 control／tab，點擊後開 full RO window，禁止壓縮 bitmap。
- portrait Shortcut：底部顯示最多 4–6 個可完整容納的 slots；其餘以原版 page／arrow control 換頁。不得裁掉 slot frame。
- portrait Chat／Inventory／Skill：用原始 window parts 組成全寬 overlay，外框左右距 safe-area 後各 `8 px`；一次只開一個主要 overlay。
- level-up：3 個選項改成縱向排列；每列最小觸控高度 `64 px`，但可見 frame／button／icon 仍只用原始 RO assets。
- landscape：Basic Info minimized 左上、MiniMap 右上、Shortcut 沿底部或 reference 空白區；modal 高度不得超過可用高度，必要時用原版 scrollbar。
- orientation／resize 後 100 ms 內重新 layout；active pointer 必須 cancel，不能留下持續移動狀態。

## 5. 元件層級與資料流

```text
FormalGameShell
├─ FormalAssetGate
│  ├─ SceneAssetGate
│  └─ FormalUiAssetGate
├─ WorldCanvas
├─ RoHudRoot
│  ├─ DesktopRoHud | MobileRoHud
│  │  ├─ BasicInfoWindow
│  │  ├─ ShortcutWindow
│  │  ├─ MiniMapWindow
│  │  ├─ ChatSystemWindow
│  │  ├─ SurvivorStageWindow
│  │  └─ WindowLauncherButtons
│  ├─ RoWindowLayer
│  │  ├─ StatusWindow
│  │  ├─ EquipmentWindow
│  │  ├─ InventoryWindow
│  │  ├─ SkillWindow
│  │  └─ OptionsWindow
│  ├─ RoModalLayer
│  │  ├─ LevelUpChoiceWindow
│  │  ├─ PauseWindow
│  │  ├─ ResultWindow
│  │  └─ AssetBlockedDiagnostics
│  ├─ RoTooltipLayer
│  └─ RoCursorLayer
└─ DevOverlay（dev/test build 且明確開啟時才存在）
```

### 5.1 Primitive responsibilities

- `RoFrame／RoWindow`：只依 manifest 拼原始 bitmap、提供 title/content/footer slots；不自行決定顏色或邊框。
- `RoButton`：依 interaction state 切換 manifest 中的 source image；缺狀態即 fail，不能 CSS filter 補出。
- `RoGauge`：以原始底／填充 texture clip 顯示 ratio；禁止純色 div bar。
- `RoSlot`：原始 slot frame + 本機原始 icon + DOM 數字／hotkey label；冷卻顯示若 client 有原始 mask/effect便使用，否則先只用數字，不得 conic-gradient。
- `RoTooltip`：原始 tooltip/window skin + DOM 文字；位置可程式計算。
- `RoCursor`：原始 SPR／ACT 與 hotspot；state 由 world／UI hit test 決定。

### 5.2 State ownership

```text
BootPhase = loading | blocked | running
RunPhase  = playing | levelUp | paused | result
WindowState = closed | open | minimized
InputOwner = modal | text | window | hud | world
```

- `BootPhase=blocked`：無 canvas、無假 HUD；純 DOM diagnostics 可讀且列 source path。
- `levelUp／paused／result`：modal 擁有全部 gameplay input，world movement 必須歸零。
- window position、size、minimized、locked、shortcut page 保存；資料必須帶 `reference_profile_id`，換 profile 時不可沿用不相容座標。
- sim state 透過 `UiViewModel` 供 UI 讀取；不得讓整個 `App` 每 tick rerender。文字可低頻更新，gauge 可透過 clip／transform 更新，但不可產生替代視覺。

## 6. RoWindowManager

必須實作：

- focus 與穩定 z-order；
- 只從 reference title／drag zone 開始拖曳；
- viewport clamp；
- profile 支援時的 edge／window magnet；
- close、minimize、lock、resize；
- pointer capture、pointercancel 與 window blur cleanup；
- reload persistence；
- mobile 一次只允許一個 major overlay；
- 所有 UI pointer event 阻止穿透至 world。

禁止把每個 window 寫成互相不知道的 absolute div。Window manager 是 UI-B 的先決元件。

## 7. InputRouter 與操作規則

### 7.1 統一 command contract

DOM、keyboard、pointer、touch 與 renderer picking 不得各自直接改 sim。至少使用下列 logical commands：

```text
MOVE_TO(worldX, worldY)
MOVE_VECTOR(xQ, yQ, source)
FOCUS_TARGET(entityId | null)
USE_SLOT(page, slot)
CAMERA_ROTATE(deltaX, deltaY, modifiers)
CAMERA_ZOOM(delta)
TOGGLE_WINDOW(windowId)
SET_CHAT_FOCUS(on | off)
PAUSE_OR_CLOSE_TOP()
```

Input ownership priority：`modal > focused text input > window chrome/control > HUD control > world`。

### 7.2 桌機

- 左點地面：`MOVE_TO`；按住／拖曳續走的節奏由 reference interaction test 決定。
- 左點怪物：`FOCUS_TARGET`。本作若為自動攻擊，target 只改優先目標，不擅自改戰鬥規則。
- 左點 UI：只觸發 UI，不得同時移動／選怪。
- 右鍵拖曳世界：camera rotate；wheel：zoom。高度／modifier 行為依 locked profile 與官方規則。
- right-click entity context 若本作無功能可以不實作，但不能讓它誤觸 camera 與 UI。
- `F1–F9`：當前 shortcut row slots；`F12`：profile 對應的 row/page/show behavior；`F11`：hide/show non-modal HUD。
- `Enter`：chat focus；chat focus 時 WASD、箭頭與 skill hotkey不得移動／施放。
- `Esc`：先關最上層 modal/window；沒有可關 window 才 pause。
- `Alt+V/E/S/Q` 等只開已完成視窗。未實作視窗不可放能點卻沒反應的假按鈕；若 target profile 必須顯示，使用原始 disabled state並提供 DOM tooltip。
- WASD／方向鍵可保留為 Survivors／accessibility 模式，但不得是唯一世界操作，也不得取代 RO cursor feedback。

### 7.3 Cursor states

至少盤點並驗證：default、click、rotate、attack、talk、pick、target、no-walk；profile 若另有 lock、warp 等狀態一併收錄。唯讀研究曾指向 `data/sprite/cursors.spr`／`.act`，但只有使用者實際 client 的 canonical path、raw hex 與 hash 通過 audit 後才可採用。

### 7.4 手機

- 預設支援 tap／hold world 移動、tap entity 鎖定。
- camera 使用兩指水平拖曳或不與移動區衝突的透明 gesture region；pinch zoom。
- long press skill／item 開 tooltip；短 tap 使用／選取。
- chat、level-up、pause、result、major overlay 開啟時，world input ownership 必須撤銷且 movement 歸零。
- 多指時只允許一個 movement pointer；第二指進入 camera gesture後不得改寫 movement pointer。
- pointercancel、visibilitychange、orientationchange、blur 全部必須清除 active input。
- 若要保留 joystick：現有 CSS 圓形 joystick 不得進 formal build。只能使用核准的原始 RO texture/cursor 組合，或採「透明 hit region + 原版 cursor feedback」。沒有合法素材就停用 joystick，不做替代圖。

## 8. RO Survivors 專用 UI 如何套用 RO 視覺

新增功能可以改資料與布局，不可以新增自創裝飾：

- Stage timer／wave／kill：使用 common RO window/title/gauge parts；不可使用現代 pill/badge。
- Skill／passive build：使用 Shortcut／Slot primitive 與本機原始 skill/item icon；自動技能也可顯示等級與 cooldown 數字。
- Level-up 3 選 1：使用 RO window frame、slot、button、原始 icon；桌機三欄、手機三列。
- Boss HP：使用原始 gauge parts；如果 local profile 沒有可合法使用的長 gauge，先保留資料與純文字，不得用 CSS bar。
- Pause／Result：使用 common message／dialog window assets；按鈕必須有原始 off/hover/down states。
- 拾取、升級、傷害／系統訊息：送入 Chat／System Log；世界浮字只有在找到同 profile 的原始字體／效果規則後才可開。

## 9. 測試與驗收

### 9.1 Source／contract tests

- manifest 每筆 canonical path、CP949 raw hex、URI round-trip、size、SHA-256 PASS；
- 同一 logical role 不可有未決定的多版本 collision；
- profile compatibility test：禁止混入其他 build／skin component；
- 每個 button 的 declared state 必須有 source；
- nine-slice inset 與 native dimensions 合法；cursor hotspot 在 bounds 內；
- gateway 只能用 asset ID，任意 path request 必須拒絕。

### 9.2 Fail-closed E2E

| 情境 | 預期 |
| --- | --- |
| formal／無 gateway | blocked；0 world canvas |
| formal／synthetic gateway | refused；0 world canvas |
| formal／real scene assets、有一筆 core UI asset missing | blocked；0 world canvas；列唯一 logical ID + canonical path |
| formal／real UI asset hash drift | blocked；不可顯示 CSS substitute |
| test fixture build | 可跑 synthetic structure；必須有 TEST FIXTURE；輸出只在 test directory |
| formal／real local gateway 完整 | world + 原始 RO HUD 同時出現；0 placeholder |

### 9.3 Static formal-visual guard

對 formal bundle／CSS／TSX 建測試，至少拒絕：

- gradients；
- formal UI surface 的 border-radius／box-shadow／CSS border drawing；
- inline SVG／emoji icon；
- Canvas／WebGL UI primitive helpers；
- synthetic／placeholder import 可從 formal entry 達到；
- production HUD 的 Build／Gateway／FPS／TEST FIXTURE 文案。

不要用簡單全 repo 字串掃描誤擋 test fixture；測試要以 formal dependency graph、正式 selector／module allowlist 為範圍。

### 9.4 Interaction E2E

- ground click、hold／move、enemy target、right-drag、wheel；
- `F1–F12`、`Alt+V/E/S/Q`、Enter、Esc；
- UI click 造成的 world movement command 次數必須為 `0`；
- chat focus 時 movement／skill command 次數為 `0`；
- modal 顯示時 gameplay input 次數為 `0`；
- pointercancel／blur／orientationchange 後 axis／move state 歸零；
- drag、z-order、minimize、close、lock、viewport clamp、reload persistence；
- 390×844／844×390 的 safe area、44px hit area、多指 ownership、modal 阻擋與無重疊。

### 9.5 Visual acceptance

使用 real local gateway、固定 seed、固定 tick、固定 viewport 產生本機截圖：

- 1280×720：default HUD、Basic Info minimized、one modal、level-up；
- 1920×1080：anchor 與 window persistence；
- 390×844：playing、level-up、chat overlay；
- 844×390：playing、one major overlay。

與同 profile 的 local client reference 對照。RO pixels／reference screenshots／goldens 不得 commit；repo 只提交：

- source/reference screenshot SHA-256；
- metrics JSON；
- element bounding-box report；
- state／asset ID mapping；
- PASS／FAIL 文字報告。

CI 只能用 synthetic fixture 驗證結構與互動；不得用 synthetic PASS 冒充 real RO visual PASS。

### 9.6 Rights acceptance

- `rights:check` 必須確認 Git index 與 baseline 後歷史都沒有原始 RO UI bitmap、client screenshot、derived atlas、cursor sheet 或音訊；
- `.local-assets`、local screenshots、contact sheets、goldens 保持 gitignored；
- repo 只保留 metadata、hash、parser／renderer 程式、測試 fixture 與文件。

## 10. Commit 拆分

### 原始素材 Commit A（可以先做）

依 `CLAUDE-PHASE1-ORIGINAL-ASSETS.md`：套用 174-row whitelist、修 dependency contract。不要順手改 HUD。

### UI-A — reference profile、manifest 與 fail-closed contract

- 盤點本機 UI assets、client build、default skin 與 container priority；
- 建 manifest/schema、native dimension/state/hotspot/nine-slice 驗證；
- 建 `ui-reference-metrics.json` 與 profile compatibility tests；
- 將 core UI asset gate 接入 formal loading；
- 只做資料與 contract，不定稿 HUD；
- 提交後停下，等 reference profile 標成 `LOCKED`。

### UI-B — derived loader、primitives、cursor、window manager

- 本機抽取 UI bitmap／SPR／ACT 至 `.local-assets`；
- gateway logical IDs；
- `RoWindow/RoButton/RoGauge/RoSlot/RoTooltip/RoCursor`；
- focus、drag、magnet、minimize、lock、resize、persistence；
- formal visual static guard。

### UI-C — 桌機核心 HUD 與 InputRouter

- Basic Info、Shortcut、MiniMap、Chat／System Log；
- MOVE_TO、target、camera、hotkeys、chat ownership；
- 移除 production developer HUD；diagnostics 移到 dev-only overlay；
- 1280×720、1920×1080 interaction／metrics 驗收。

### UI-D — RO Survivors windows

- Stage、Boss、level-up、pause、result、build slots；
- 所有畫面只組合 locked profile 的原始 RO assets；
- 未找到合法 asset 的功能保持 blocked／文字，不補畫。

### UI-E — 手機布局與 gesture

- 390×844、844×390；
- safe area、transparent 44px hitboxes、single/multi-pointer ownership；
- portrait 4–6 slots、major overlay、縱向 level-up；
- 合法 joystick asset 不足時停用可見 joystick。

### UI-F — real-local acceptance 與文件

- real local visual reports、hash、metrics；
- synthetic CI 與 formal local test 結果分開記錄；
- Actions 成功後再更新 STATUS／DECISIONS／RISKS／acceptance；
- 沒有 real local screenshot review 前，不得寫「接近原版完成」。

每個 commit 必須小而可回退，且先本機測試再 push。不得把 UI-A～UI-F 壓成一個大 commit。

## 11. 完成定義

以下全部成立才可把 RO UI 標成完成：

- reference profile 已 `LOCKED`，沒有版本混搭；
- formal UI 每一個可見像素型元件都能追到 local manifest/source hash；
- core UI 缺失／drift 必定 fail-closed；
- 桌機 Basic Info、Shortcut、MiniMap、Chat 與 cursor/input 行為通過；
- Survivors level-up／pause／result 使用 RO primitives，不含自創裝飾；
- 手機兩個 viewport 通過 safe area、hit area、gesture ownership 與無重疊；
- 正式 dependency graph 無 synthetic／placeholder／自畫 UI；
- real local visual acceptance 與 rights-check PASS；
- Actions 成功；worktree clean；
- `59dcabd` 的 synthetic Phase 2 可保留，但已與 formal dependency graph 隔離，且未被當作正式 RO UI／正式素材的驗收證據。

未達成前，狀態只能寫：`RO UI reference/implementation in progress`，不可寫 `pixel-identical`、`near-identical complete` 或 `Phase 1 accepted`。
