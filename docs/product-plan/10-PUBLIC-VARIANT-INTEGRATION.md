# 公開版本資料與公告整合規格

本文件規定如何把 RO Survivors 官方站與 HANS 站的公開資料、更新公告及一般玩家可見行為，轉成我方可追溯的設計參考。兩站都是參考來源，不是程式碼或正式數值的上游。

## 三層資料模型

| 層級 | 識別 | 用途 | 是否能直接改 runtime |
| --- | --- | --- | --- |
| 官方基準 | `official` | 官方首頁、法律頁、Credits、manifest、公開公告及一般遊玩行為 | 否 |
| HANS 擴充 | `hans` | 繁中版公開公告、營運功能、活動及玩法差異 | 否 |
| 本作決策 | `fan-local` | 使用者需求、我方設計、平衡、測試與正式內容 overlay | 只有 `accepted` decision 可以 |

官方與 HANS 永遠各自保存，不得互相覆寫。若兩邊對同一功能有不同說法，必須保留兩筆 observation，再由 `fan-local` decision 選擇採官方、採 HANS、融合重做或不採用。

## 公告資料契約

每份公開公告只保存我方重寫的短摘要與證據資料，不鏡像完整公告正文：

```text
PublicSource
  sourceId
  variant: official | hans
  sourceType: site | legal | credits | manifest | news | notice | status
  url
  observedAt
  publishedAt?
  versionLabel?
  httpStatus
  etag?
  lastModified?
  contentSha256
  authority: primary | author-post | secondary
```

```text
AnnouncementObservation
  announcementId
  sourceId
  sourceVersion?
  revision?
  titleSummary
  factSummaries[]
  categories[]
  confidence: observed | reported | inferred
  copyrightClass: fact | idea | text-do-not-copy | code-do-not-copy
  supersedesObservationIds[]
```

```text
DesignDecisionLink
  decisionId
  observationIds[]
  action: watch | adapt | reject | test
  status: proposed | accepted | superseded
  contentOverlayRef?
  testIds[]
  rationale
```

跨版本同一功能若出現矛盾，另以 `RulesetComparison` 明列官方與 HANS 的 observation IDs；`conflict=true` 時必須引用一筆 `fan-local` resolution decision，否則驗證失敗。驗證器不會靠文字相似度自行猜測衝突。

## 2026-11-18 可用候選

| 候選 | 公開來源 | 我方處理 |
| --- | --- | --- |
| 暫存尚未選擇的升級卡與寶箱 | HANS V0.13.5 | `adapt`；轉成單機中斷復原與待選佇列，不沿用其內部資料或 UI |
| 同場雙王與闖入者事件 | HANS V0.13.5 | `test`；擴充 stage event schema，另做自己的時間、數值與招式 |
| 節慶活動與活動裝備 | HANS V0.13.5 | `watch`；先建立 content pack／有效期欄位，不阻擋首版 |
| 角色改名 | HANS V0.13.5 | `defer`；等帳號／雲端存檔階段，再自行設計費用與限制 |
| 聊天泡泡與查看配裝 | HANS V0.13.5 | `defer`；只保留 UI contract，首版單機不施工 |
| 信件到期 | HANS notice rev 29 | `defer`；未來 mail schema 可用 `expiresAt`，不複製其營運天數 |
| 新章節與爬塔方向 | HANS notice rev 29、官方法律頁 | `watch`；先保證 deterministic replay，再考慮排行榜 |
| PWA、任意方向及跨裝置介面 | 官方 manifest／首頁 | `adapt`；納入手機、平板、桌面驗收 |

公告中的人數、價格、掉落、裝備、周目與技能數值只屬外部版本事實，不是我方平衡表。任何數字要進 runtime，必須建立獨立 decision、測試 ID、目標指標與回滾條件。

## 施工與驗收規則

1. Production build、測試、CI 與遊戲啟動全部離線，不可即時依賴外站。
2. 只有人工或低頻 maintenance command 可以更新公開來源；優先使用 ETag／Last-Modified，最多 24 小時檢查一次。
3. 新快照 append-only。舊 snapshot、ledger segment 與 hash 不得重寫。
4. `reference-index.json` 指定 active snapshot，Claude 只讀 index，不猜最新檔名。
5. 公告只產生 `proposed` decision；未變成 `accepted` 前不得寫入 gameplay、掉落、技能、波次或 UI runtime。
6. `accepted` decision 必須引用 observation、至少一個 test ID，且 content overlay 必須與外部 snapshot 分檔。
7. 驗證器必須拒絕重複 ID、未知 variant、缺 URL／時間／hash、過長原文、登入資訊、script／bundle／source-map 內容及未裁決的 variant 衝突。
8. HANS 是衍生版本參考，不可標成官方公告；官方封閉程式、介面與文字也不得複製。
9. 本作只顯示自己的更新公告。外部公告最多在研究工具顯示版本、日期、我方摘要與來源連結。

## Claude 第一個有界工作包

Claude 先做資料契約與驗證，不改 gameplay：

1. 新增 `packages/content-schema/src/publicReference.ts` 與 export。
2. 驗證 `reference-index.json`、所有 snapshot 與 ledger segment 的 SHA-256。
3. 新增 `pnpm reference:validate` 並納入 `ci:local`。
4. 測試 official／HANS 可同時保存、跨 segment ID 唯一、舊 hash 不變、外站離線可 build、公告不會直接成為 runtime content。
5. 不修改 `vertical-slice-content-seed.json`、技能平衡、素材白名單或正式畫面。

完成後再由 Codex 選擇哪些 `proposed` candidates 進下一個玩法 commit。
