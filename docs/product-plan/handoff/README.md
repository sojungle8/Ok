# Claude 施工資料包

這個目錄是 Codex 交給 Claude 的唯一外部研究入口。Claude 負責施工，不負責抓取 RO Survivors／HANS 官網。

## 使用順序

1. 讀 `../00-START-HERE.md` 至 `../09-GITHUB-CLOUD-WORKFLOW.md`；若在 GitHub 雲端工作，以 09 的路徑與驗收覆寫規則為準。
2. 驗證 `reference-snapshot-2026-11-17.json` 可解析。
3. 讀 `public-client-artifacts.csv`，只用 hash 判斷研究版本，不下載對應檔案。
4. 讀 `../reference-ledger.csv`，只採用 `review_status=reviewed` 的觀察。
5. Phase 1 前讀 `fan-local-asset-whitelist.csv`；只解析白名單路徑。
6. 同時讀 `ASSET-AUDIT.md`，依 parser 與 gateway 驗收條件產生證據。
7. 讀 `VALIDATION.md`，確認交付物 hash 沒有在傳遞途中改變。
8. Phase 2 前讀 `vertical-slice-content-seed.json`；把 `source_reference` 與 `runtime_balance` 分開。

## 硬規則

- 不自行上網研究、不抓 bundle、source map、私有 API 或下載包。
- 不把 `observation` 當成可直接複製的數值表；只用 `our_decision` 與 `acceptance`。
- 不把本機 GRF、SPR、ACT、地圖或音訊提交 Git。
- 遇到資料缺口，新增 `RESEARCH-GAPS.md`，每列寫 `gap_id`、需要的欄位、阻擋的測試與可接受替代值，交回 Codex。
- 任何 `fact`、`inference`、`decision` 不得混在同一欄。程式碼只實作 `decision`。

## 目前檔案狀態

| 檔案 | 狀態 | 用途 |
| --- | --- | --- |
| `reference-snapshot-2026-11-17.json` | ready | 官網、攻略、玩家回饋與我方需求的機器可讀快照 |
| `public-client-artifacts.csv` | ready | 被分析的公開 client 指紋；不含原始碼 |
| `ASSET-AUDIT.md` | ready | 首版素材的解包、格式、命名陷阱、地圖與 parser 驗收證據 |
| `VALIDATION.md` | ready | JSON／CSV／路徑／引用／權利掃描與交付 hash |
| `fan-local-asset-whitelist.csv` | ready | Canonical v5：300 筆本機 RO 素材白名單（v4 288 + 12 筆官方技能特效來源：7 TGA、1 STR、4 BMP），SHA-256 `ECE20DDDD09A4868CE9264B04E2DC602EA947F6C19929E49E81C1FCF5FBF480A`；含 CP949 路徑、URI、raw bytes hex、bytes、ACT 版本與地圖／音訊／技能特效 hash |
| `vertical-slice-content-seed.json` | ready | 劍士、8 個技能候選、4 被動、3 流派、10 普通怪、2 菁英、Vocal、Mastering 與 10 分鐘波次 |

兩個檔案已完成唯讀核對。Claude 可從 Phase 0 開始；Phase 1 只能讀白名單列出的素材，新增任何路徑都要先交回 Codex 重新核對。

