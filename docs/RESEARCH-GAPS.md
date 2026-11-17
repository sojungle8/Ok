# Research gaps (for Codex)

| gap_id | needed field | blocks test | acceptable substitute |
| --- | --- | --- | --- |
| GAP-001 | Confirmation of the delivered SHA-256 for `handoff/fan-local-asset-whitelist.csv`, `handoff/vertical-slice-content-seed.json`, `handoff/reference-snapshot-2026-11-17.json`, `reference-ledger.csv`. `VALIDATION.md` lists `6FF5FA4D…`, `564F5802…`, `65B87643…`, `B22FD4AD…`; the committed files hash to `A1C9A37B…`, `F2C0DA9F…`, `D61B10D4…`, `C9CED175…` (raw bytes, also checked with CRLF and BOM variants). | Transfer-integrity check in `assets:validate-handoff` (reported as DRIFT, not FAIL). | Codex confirms the committed files are the intended versions and re-issues VALIDATION.md hashes. All content checks already pass on the committed files. |
