# Claude ↔ Codex 自動協作協議

版本：1.0（2026-11-17）  
Repository：`sojungle8/Ok`  
Claude 工作 branch：`claude/ro-survivor-handoff-p1xb2o`  
Codex 唯讀 handoff branch：`claude/ro-survivor-fangame-handoff`  
協作 Draft PR：[#3](https://github.com/sojungle8/Ok/pull/3)  
歷史研究／稽核：Issue #2

## 1. 分工

- **Claude**：唯一施工者。修改程式、測試、文件，建立小 commit，push 工作 branch，等待 Actions。
- **Codex**：研究、原始素材 metadata、施工規格、唯讀驗收與下一步授權。Codex 不直接修改 Claude 工作 branch。
- **使用者**：只處理新的產品選擇、權限、登入、付費、不可逆動作或 Codex／Claude 無法自行解決的外部阻礙。

## 2. 唯一協作通道

PR #3 是即時工作佇列與狀態帳本。Issue #2 保留歷史稽核；新的施工交接全部放 PR #3，避免兩處狀態分裂。

只使用下列標記：

```text
[CLAUDE→CODEX READY_FOR_REVIEW]
[CODEX→CLAUDE APPROVED_NEXT]
[CODEX→CLAUDE CHANGES_REQUIRED]
[HUMAN_DECISION_REQUIRED]
[BLOCKED_EXTERNAL]
```

每個標記必須放在留言第一行。沒有標記的討論不改變施工授權。

## 3. Claude 啟動設定

Claude 每次新 session／context reset 都先執行：

1. 確認 repository 是 `sojungle8/Ok`。
2. checkout `claude/ro-survivor-handoff-p1xb2o`，fetch remote，確認工作樹狀態；不得清除使用者或未知來源的未提交變更。
3. handoff branch 只讀；不要 merge、rebase 或 cherry-pick handoff branch。以 GitHub 或 `git show origin/claude/ro-survivor-fangame-handoff:<path>` 讀取文件。
4. 完整讀取 `docs/product-plan/handoff/HANDOFF-INDEX.md` 列出的檔案與 hash。
5. 讀 PR #3 最新 comments，找最後一筆 Codex 標記與最後一筆 Claude `READY_FOR_REVIEW`。
6. 若 Codex 最新標記是 `CHANGES_REQUIRED`，只修該批問題；若是 `APPROVED_NEXT`，只做留言授權的下一個 commit；若沒有授權，不自行跨 phase。
7. 不以聊天記憶取代 branch、PR comment 或 canonical 檔案。

## 4. Claude 施工迴圈

每一輪只能完成一個可驗收的小 commit：

1. 根據最新 `APPROVED_NEXT` 建立明確 task list。
2. 施工前記錄 HEAD、worktree 狀態與將修改的檔案。
3. 實作、加入針對性測試、執行最低必要驗證，再跑完整專案驗證。
4. commit 並 push 到工作 branch；禁止 force-push、禁止 rebase 已送審 commit。
5. 等該 commit 的 GitHub Actions 結束。
6. 在 PR #3 留下 `READY_FOR_REVIEW` 結構化留言。
7. 在 Codex 回覆前，不開始下一個 commit；session 可每三分鐘唯讀檢查一次 PR #3。沒有新標記就保持安靜，不重複留言。

Claude 留言格式：

```text
[CLAUDE→CODEX READY_FOR_REVIEW]

Authorized step: <Codex 授權名稱>
Commit: <完整 40 字 SHA>
Parent: <完整 40 字 SHA>
Changed files:
- <path>

Validation:
- <command>: PASS/FAIL + 實際數字

Actions: <run URL 與 conclusion>
Manifest rows/hash: <如適用>
Formal vs synthetic: <分開說明>
Real-local validation: PASS / FAIL / DEFERRED_LOCAL（附命令）
git status --short: <空或逐項列出>
Known gaps: <無則 none>
Requested next step: <只描述，不自行開始>
```

## 5. Codex 驗收迴圈

Codex 每次偵測到新的 `READY_FOR_REVIEW`：

1. 以 PR 留言中的 commit SHA 為固定驗收目標，不驗收浮動 HEAD。
2. 比較 parent→commit；核對授權範圍、canonical handoff、測試、Actions、rights 與正式／synthetic 隔離。
3. 只做唯讀檢查；不得把 Codex 的修正直接提交到 Claude branch。
4. PASS 時在 PR #3 留 `APPROVED_NEXT`，寫出下一個且只有一個授權步驟、禁止事項與驗收條件。
5. FAIL 時留 `CHANGES_REQUIRED`，列 finding、證據、精確修改範圍與重測要求；下一步授權保持凍結。
6. 需要新產品選擇／權限時留 `HUMAN_DECISION_REQUIRED`，只問最小必要問題。
7. 對同一 commit／同一 conclusion 去重，不重複留言。

Codex PASS 留言格式：

```text
[CODEX→CLAUDE APPROVED_NEXT]

Accepted commit: <SHA>
Evidence: <簡短核對結果>
Authorized next step: <單一 commit 目標>
Must not change: <邊界>
Acceptance commands/results required: <清單>
Stop after: push + Actions + READY_FOR_REVIEW
```

## 6. 必須立即停止的情況

- canonical hash／row count 不符；
- 需要未列入 manifest 的 RO 素材；
- 需要把 GRF、BMP、SPR、ACT、RSM、音訊、字型、atlas 或遊戲截圖提交 Git；
- 需要登入資料、token、付費、對外發布或 merge main；
- formal build 只能靠 synthetic／placeholder／CSS 自繪才能繼續；
- branch／commit／Actions 對不上；
- 產品選擇會改變既定 profile、玩法或權利邊界。

遇到上述情況，Claude 留 `HUMAN_DECISION_REQUIRED` 或 `BLOCKED_EXTERNAL`，列出證據與唯一必要輸入，不自行猜測。

## 7. 安全與 Git 規則

- PR #3 維持 Draft；只有使用者明確要求且正式驗收完成才可 ready／merge。
- handoff branch 由 Codex管理，Claude只讀；工作 branch 由 Claude 管理，Codex只讀。
- 不得把本機絕對來源路徑、登入資料、`.env.local`、token 或原始 RO binary 放進 GitHub。
- Synthetic fixture 只准 test build，正式 dependency graph 必須拒絕。
- Actions 綠燈不是 real-local RO visual PASS；兩者要分開回報。
- 不得以「非營利同人」為理由略過 manifest、rights check 或來源隔離。

## 8. 第一次啟動時 Claude 應做的事

Claude 收到本協議後：

1. 在 PR #3 留一筆 `[CLAUDE→CODEX READY_FOR_REVIEW]`，只報告 Codex 最後觀察到的 HEAD `983913fd35ba405dbadec6d6f49e62d8a444e7e1`（若 branch 已前進，改報實際 HEAD 並說明差異）、最新 Actions 與 worktree；不要修改程式。
2. 完整讀取 handoff index 與七個 canonical 檔案，逐一比對 hash。
3. 若目前工作 branch 尚未套用 174-row Commit A，在留言中請求 Codex 授權該步；不要直接跳到 UI。
4. 等 Codex 在 PR #3 回覆 `APPROVED_NEXT` 後才施工。

這一次初始化完成後，使用者不再需要人工複製 Codex／Claude 的長篇交接內容。
