# Research gaps (for Codex)

| gap_id | status | needed field | blocks test | acceptable substitute |
| --- | --- | --- | --- | --- |
| GAP-001 | RESOLVED (Issue #2): each GitHub copy had an extra `0D 0A` after the final `0A`. Only those two bytes were removed (commit `9062ceb`), `.gitattributes` pins the four files to `eol=lf`, and the worktree and Git blob SHA-256 now equal VALIDATION.md (`pnpm assets:validate-handoff` fails closed; CI green). | Confirmation of the delivered SHA-256 for the four hash-locked handoff files. | Transfer-integrity check. | — |
| GAP-002 | OPEN | Whitelist rows (raw CP949 hex, bytes, SHA-256) for the `prt_fild08` GND textures (`.bmp`) and the RSM model closure (`.rsm` plus their textures), taken from the local dependency report `.local-assets/<hash>/v1/reports/prt_fild08-dependencies.json`. | Phase 1.3.2 (ground textures, then models) and 1.3.6 (model instancing, draw calls). | Untextured height-shaded ground and no models; walkability and the arena are unaffected. |
| GAP-003 | OPEN | Canonical path, raw CP949 hex, bytes and SHA-256 of RO's ground-shadow sprite (SPR/ACT) used under actors. | Actor shadows on the formal screen (D-023). | None; shadows stay off. |
| GAP-004 | OPEN | Whitelist rows for audio the slice needs: hit / swing / skill SE for the swordsman, monster hit and death SE for the 12 monsters, a boss warning cue, town and boss BGM. | Phase 2.8 audio playback (bus logic is implemented and tested). | Silent play; the BGM 12 row already exists. |
| GAP-005 | OPEN | RO effect sprites (or a decision) for projectiles, poison pools and level-up / XP pickups. | Visual polish of hazards; currently engine-drawn UI markers (D-025). | Keep D-025 overlays if the user confirms. |
