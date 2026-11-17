# Claude 下一步指令：Phase 1 原始 RO 素材閉包

狀態：Codex 唯讀驗收 `d804aa2` 後發出的施工規格。不要開始 Phase 2。

## 1. Codex 重新發行的正式素材白名單

使用同資料夾的 `fan-local-asset-whitelist-v2-174.csv`，完整取代 repo 目前 48-row 的
`docs/product-plan/handoff/fan-local-asset-whitelist.csv`。這是 Codex 授權的 v2 canonical 檔案；不要自行重排、重寫或只靠路徑猜測補列。

- rows：174（173 筆 GRF + 1 筆 filesystem BGM）
- unique asset IDs：174
- unique canonical paths：174
- LF only，無 CRLF
- SHA-256：`16A6A34F5756E09CBEBCEE15284065361845F7DBFFE5958A648F99E89E27E5FF`
- CP949 raw hex round-trip：173/173 PASS
- URI round-trip：174/174 PASS

新增的 126 筆全部從使用者 KRO 2021 `data.grf` 實際解包並重新計算 bytes/hash：

| 類別 | 數量 |
| --- | ---: |
| GND ground BMP | 21 |
| RSW unique RSM 1.4 | 23 |
| RSM 引用 BMP | 44 |
| Water JPG (`water100`–`water131`) | 32 |
| RSW ambient WAV | 4 |
| 官方 shadow SPR/ACT | 2 |

`rdata.grf` 對這 126 筆沒有同名 override；missing=0。GND 的 10,028 個 lightmap 是檔案內嵌資料，禁止虛構外部 lightmap 路徑。

替換後同步更新 `VALIDATION.md`、validator 預期值及測試：48→174、47+1→173+1，並只把 whitelist 的 canonical hash 改為上面的 v2 hash。其他三個鎖定檔 hash 不得變更。

## 2. `d804aa2` 驗收發現，必須先修

目前正式畫面沒有替代圖，是因為它永遠無法開始，尚不是可用的全原始素材畫面：

1. `apps/client/src/game/assets.ts` 對所有 map dependency 無條件加入 missing。加入白名單後仍會 blocked。改成 canonical path→asset ID 查表，逐項由 gateway 讀取；只有 whitelist、source 或 derived output 真正缺失才報 missing。
2. `renderer.ts` 仍建立程式 checker／vertex-color 綠地，且沒有 RSM renderer。這只能留在明確的 TEST FIXTURE renderer；formal code path 不得呼叫。
3. 劍士目前只載入 body。hair、sword、guard 和 body/hair palette 雖檢查存在，但沒有載入或繪製。
4. `bgm.prt_fild08` 及 `map.dependencies.sounds` 未納入 formal requirement。

## 3. 施工拆分

### Commit A — manifest 與 fail-closed dependency contract

- 套用 174-row canonical whitelist 和新 hash。
- 建立 canonical path→asset ID 索引，驗證 GND、RSW、RSM texture closure 全部解析到白名單。
- 正式必要集合包含地圖閉包、`bgm.prt_fild08`、4 WAV、`common.shadow.spr/.act`。
- 測試：完整集合 missing=0；任意刪一列時只回報該 asset ID/canonical path；不得再無條件回報全部 map dependency。
- gateway 仍只能接受 asset ID，不得新增任意 path 讀取端點。

### Commit B — 本機抽取與 derived contract

- BMP/JPG 轉成 lossless、nearest-filter 可用的本機 derived texture。
- 解析完整 GND 1.7 tile UV、surface heights、vertex color及內嵌 lightmap，不得以 GAT checker 代替。
- 新增本關所需的 GRSM 1.4 clean-room parser；解析 23 unique RSM、44 texture dependencies及 RSW 570 placements/transforms。
- 水面只使用 32 張官方 water JPG；2,504 個 water cells 以 RSW water type 1 驅動。
- 抽取官方 shadow SPR/ACT；ACT 的 alpha 128 必須保留。
- BGM/ambient audio 只由本機 gateway 提供；所有 raw/derived binary 留在 `.local-assets`，不得 commit。

### Commit C — formal renderer

- 正式地面：只用 GND textures + UV + embedded lightmap；禁止 checker、純色草地或生成貼圖。
- 正式 props：繪製 23 種 RSM、570 instances及44張官方模型貼圖；缺任何依賴即阻擋。
- 玩家：body、hair、sword、guard 四層全部載入，套用原始 palette、ACT frame offset與正確前後層級；不得只畫 body。
- 影子：使用 `data\\sprite\\shadow.spr/.act`，劍士/Poring 第一版 scale=1.0，保留 50% alpha；禁止 ellipse/CSS/shader substitute。
- BGM 使用既有 `BGM\\12.mp3`；四個 RSW WAV 使用原始定位資料。瀏覽器若需使用者手勢才能播放，顯示「點擊啟用音訊」，不能換音效。
- formal renderer 與 fixture renderer 分離；`VITE_ALLOW_SYNTHETIC=1` 必須只由明確的 test-build script 產生 `dist-test`，不可讓普通 `build` 因任意環境變數接受 fixture。

### Commit D — 驗收與文件

- Formal/no gateway：blocked、0 canvas。
- Formal/synthetic gateway：refused、0 canvas。
- Test fixture build：有 `TEST FIXTURE` banner，synthetic 僅在這裡可達。
- Formal/real local gateway：畫面必須同時看到原始 GND、水、RSM props、四層劍士、Poring及官方影子；不可有 checker/placeholder。
- 對 174 rows 執行實機 `assets:audit-whitelist` 和 extract；所有 bytes/hash、CP949、URI、dependency closure PASS。
- Actions 綠燈後再把 GAP-002/GAP-003 改為 RESOLVED；更新 D-021/D-023、RISKS 與 Phase 1 acceptance 的矛盾敘述。

## 4. 不得誤報

- Actions run #11 沒有執行 `tools/e2e/run-all.mjs`，所以不能用 #11 代表 A/B/C browser e2e 已在 CI 重跑。
- Phase 0 的 Windows `rights:check` child-process close race 仍未修好；刪除重試只是遮住 EPERM。使用者已決定可稍後處理，但不得標成 RESOLVED。
- 完成本規格前，狀態只能是「formal policy guard PASS；real original-asset scene NOT DONE」。

