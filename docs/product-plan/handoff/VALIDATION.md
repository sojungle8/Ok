# 交付包驗證結果

驗證日期：2026-11-17（Asia/Taipei）。

## 結果

- JSON 解析：PASS。
- CSV 解析：PASS。
- 素材列：48；`asset_id` 48 個且唯一。
- 每筆 `data.grf` 的 CP949 raw hex → canonical path round trip：48 筆適用列全部 PASS。
- 每筆 normalized request URI → canonical path round trip：48 筆全部 PASS。
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
| `fan-local-asset-whitelist.csv` | `6FF5FA4D6C8052B4AD0FF00EF0F727ECEA0954431D27E71A5343B76BD1568B7A` |
| `vertical-slice-content-seed.json` | `564F580207054898876A549B6BF67CA904A366E10D491949D0CFFC576BDF6EEC` |
| `reference-snapshot-2026-11-17.json` | `65B8764394D20FEEDE5406BA6108D237155D238E1FA0C4387B30F5E2E80D4096` |
| `../reference-ledger.csv` | `B22FD4AD7F2605AF3F72E82B660323748AA9E031C4C7BF57ACF5FA43BBFC8077` |

如果任一檔案之後變更，Claude 必須重新跑同等驗證並更新 hash；不能沿用本頁的 PASS。

