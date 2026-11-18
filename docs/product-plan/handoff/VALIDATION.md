# 交付包驗證結果

驗證日期：2026-11-17（Asia/Taipei）。

## 結果

- JSON 解析：PASS。
- CSV 解析：PASS。
- 素材列：300；`asset_id` 300 個且唯一（canonical v5 = v4 288 rows + 12 筆官方 RO 技能特效來源：7 TGA、1 STR、4 BMP）。
- 每筆 GRF 的 CP949 raw hex → canonical path round trip：297 筆適用列全部 PASS（另 3 筆 filesystem rows：`bgm.prt_fild08` 為 filesystem BGM、`ui.font.scdream4/6` 為 `filesystem:System`，沒有 raw hex，不適用）。
- 每筆 normalized request URI → canonical path round trip：300 筆全部 PASS。
- 技能特效最小依賴閉包：12 筆全部 `required=true`、帶 SHA-256，且只允許從固定的 `data.grf` raw CP949 路徑讀取。
- RO UI rows：108 筆，全部 `required=true`、帶 SHA-256，`notes` 以 `profile=KRO2021_CLASSIC_V0_FAN;` 開頭。
- 內容 seed：8 skills、4 passives、3 keystones、10 normal、2 elite、1 miniboss、1 MVP。
- 關卡 timeline 的 entity／pool reference：PASS。
- reference ledger：20 rows，ID 唯一。
- public client fingerprints：8 rows，每個 SHA-256 為 64 位大寫十六進位，`retained_in_project=false`。
- Markdown code fence：全部成對。
- GRF／SPR／ACT／RSM／GND／GAT／RSW／STR／RO 音訊實檔進企劃目錄：0。
- 官網 raw bundle／source map 進企劃目錄：0。
- BGM 12 現場 hash／bytes：PASS。

## 交付物 SHA-256

| 檔案 | SHA-256 |
| --- | --- |
| `fan-local-asset-whitelist.csv` | `ECE20DDDD09A4868CE9264B04E2DC602EA947F6C19929E49E81C1FCF5FBF480A` |
| `vertical-slice-content-seed.json` | `564F580207054898876A549B6BF67CA904A366E10D491949D0CFFC576BDF6EEC` |
| `reference-snapshot-2026-11-17.json` | `65B8764394D20FEEDE5406BA6108D237155D238E1FA0C4387B30F5E2E80D4096` |
| `../reference-ledger.csv` | `B22FD4AD7F2605AF3F72E82B660323748AA9E031C4C7BF57ACF5FA43BBFC8077` |

如果任一檔案之後變更，Claude 必須重新跑同等驗證並更新 hash；不能沿用本頁的 PASS。

