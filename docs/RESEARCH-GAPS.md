# Research gaps (for Codex)

| gap_id | status | needed field | blocks test | acceptable substitute |
| --- | --- | --- | --- | --- |
| GAP-001 | RESOLVED (Issue #2): each GitHub copy had an extra `0D 0A` after the final `0A`. Only those two bytes were removed (commit `9062ceb`), `.gitattributes` pins the four files to `eol=lf`, and the worktree and Git blob SHA-256 now equal VALIDATION.md (`pnpm assets:validate-handoff` fails closed; CI green). | Confirmation of the delivered SHA-256 for the four hash-locked handoff files. | Transfer-integrity check. | — |
| GAP-002 | OPEN | Whitelist rows (raw CP949 hex, bytes, SHA-256) for the `prt_fild08` GND textures (`.bmp`) and the RSM model closure (`.rsm` plus their textures), taken from the local dependency report `.local-assets/<hash>/v1/reports/prt_fild08-dependencies.json`. | Phase 1.3.2 (ground textures, then models) and 1.3.6 (model instancing, draw calls). | Untextured height-shaded ground and no models; walkability and the arena are unaffected. |
| GAP-003 | OPEN | Canonical path, raw CP949 hex, bytes and SHA-256 of RO's ground-shadow sprite (SPR/ACT) used under actors. | Actor shadows on the formal screen (D-023). | None; shadows stay off. |
