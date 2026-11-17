# RO Survivors Codex → Claude 交付索引

日期：2026-11-17  
目標 branch：`claude/ro-survivor-fangame-handoff`  
正式 UI profile：`KRO2021_CLASSIC_V0_FAN`
自動協作 Draft PR：[#3](https://github.com/sojungle8/Ok/pull/3)

## 目前狀態

- Claude 的 `59dcabd` synthetic Phase 2 可以保留，不需要回退。
- Synthetic 測試成功不能當成正式 RO 素材或正式 RO UI 驗收。
- 場景素材 profile 已由 Codex 本機核對；UI asset selection 已 `LOCKED_BY_CODEX`。
- 真實 KRO 素材的最終截圖、bounding boxes 與操作手感仍是 `PENDING_LOCAL_ACCEPTANCE`。
- GitHub 只收文字規格與素材 metadata；沒有 GRF、BMP、SPR、ACT、RSM、字型、音訊、atlas 或遊戲截圖。

## Claude 必读順序

1. `CLAUDE-CODEX-AUTOPILOT.md`
2. `CLAUDE-PHASE1-ORIGINAL-ASSETS.md`
3. `fan-local-asset-whitelist-v2-174.csv`
4. `CLAUDE-PHASE1-RO-UI.md`
5. `RO-UI-REFERENCE-EVIDENCE.md`
6. `ro-ui-original-assets-NOTES.md`
7. `ro-ui-original-assets.csv`
8. `fan-local-asset-whitelist-v3-282.csv`

## Canonical 檔案

| 檔案 | 用途 | Rows／Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `CLAUDE-CODEX-AUTOPILOT.md` | Claude/Codex 自動交接、留言格式與停止條件 | 6,221 bytes | `BC23C0138A5F6749D0BF767BD0B566679D10013B169C989EF4A3DBAC049FBC99` |
| `CLAUDE-PHASE1-ORIGINAL-ASSETS.md` | 原始地圖、角色、影子、音訊施工規格 | 5,408 bytes | `252138A3A00898A6727F87F9405F80CB641B1D5F2E167E07511013EA19CFCBCF` |
| `fan-local-asset-whitelist-v2-174.csv` | 場景／角色 canonical 白名單 | 174 rows／65,311 bytes | `16A6A34F5756E09CBEBCEE15284065361845F7DBFFE5958A648F99E89E27E5FF` |
| `CLAUDE-PHASE1-RO-UI.md` | 正式 RO UI 架構、施工與驗收 | 28,195 bytes | `278B18539D26C142D86882797F4259978D180F11382A9F22AA67CCF26B10D28A` |
| `RO-UI-REFERENCE-EVIDENCE.md` | Observed／Inferred／Original-design 證據分級 | 9,242 bytes | `87691934EB3EDD61AFD1657C03D7C50A62DDC8EBE6B708A44AC50E4F5EC73C0D` |
| `ro-ui-original-assets-NOTES.md` | UI 素材閉包、限制、決策與 GAP | 6,413 bytes | `2CD634F689A28174D44DA0515111EE5CD054FBE0CB730BDA8A5DB7B5297E0F42` |
| `ro-ui-original-assets.csv` | UI-only 增補白名單 | 108 rows／60,031 bytes | `B40096677791009A616015BA068FA60A8949F461D2ED086B13793E5435F4707E` |
| `fan-local-asset-whitelist-v3-282.csv` | v2 + UI 的最終合併參考 | 282 rows／125,131 bytes | `63EA6798B842AA6DCC65B00E09D3BBD88AA74467BC75594B5A9490F0C5C6A4DB` |

所有 CSV 均為 UTF-8、LF only、末尾單一 LF；asset ID 與 canonical path 全部唯一。

## 施工順序

### A. 先完成原始素材 Commit A

若正式 repo 仍是 48-row whitelist，先依原始素材文件完整套用 v2 174 rows，修正 dependency lookup 與 fail-closed contract。不要順手定稿 HUD。

### B. 再做 UI-A

將 `ro-ui-original-assets.csv` 的 header 以下 108 rows 附加到 v2；結果必須逐 byte 等於 `fan-local-asset-whitelist-v3-282.csv`，最終 SHA-256 必須是：

```text
63EA6798B842AA6DCC65B00E09D3BBD88AA74467BC75594B5A9490F0C5C6A4DB
```

如果 Commit A 尚未動工，也不可把 A 與 UI-A 壓成一個難以驗收的大 commit；仍應先提交場景 contract，再提交 UI profile／manifest。

### C. UI-B 以後

依 `CLAUDE-PHASE1-RO-UI.md` 的拆分施工。每個正式可見 raster 必須由 logical asset ID 經本機 gateway 取得；正式 dependency graph 不得引用 synthetic／placeholder／自繪 UI。

## 已鎖定的產品決策

- 採「RO Survivors 的公開可觀察功能與相對錨點 + Classic RO V0 原始 skin」，不複製 HANS／原版專有藍白卡面、CSS、DOM 或封閉程式碼。
- Basic Info 使用 `basewin_bg.bmp` 280×120／`basewin_mini.bmp` 280×34 與完整八顆 V0 功能按鈕；禁止混入 V1、V5 `menu_icon` 或 minimap V2。
- 正式手機版找不到官方搖桿素材，因此先用點地／拖曳移動與官方 cursor feedback；目前 CSS 圓形 joystick 只准留在 TEST FIXTURE。
- `skill.sw.shield_wave` 核准語意重用官方 `CR_SHIELDBOOMERANG` 圖示；這只代表使用原 RO 圖，不把原創技能冒充官方技能。
- SCDream4／6 來自 KRO client 自己的 `System\Font`，不是 Windows Fonts；gateway 只能精確 allowlist 這兩條路徑。
- 正式 HUD 不得顯示 Build、Gateway、FPS、tick、draw calls 或 TEST FIXTURE；診斷資料只准 dev/test overlay。

## Claude 每個階段的回報格式

每個 commit 請列：

1. commit SHA 與變更檔；
2. 實際 row count、manifest hash、source／derived contract；
3. synthetic CI 與 real-local 驗證分開報告；
4. 缺件時列 logical asset ID、container、canonical CP949 path；
5. `git status --short`；
6. Actions run URL。

沒有 real-local visual acceptance 前，狀態只能是 `RO UI reference/implementation in progress`，不可寫 `pixel-identical complete`、`near-identical complete` 或 `Phase 1 accepted`。
