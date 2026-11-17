# RISKS

| ID | Risk | Impact | Mitigation / status |
| --- | --- | --- | --- |
| R-01 | Real GRF hashes differ from the plan (re-downloaded or patched client). | Phase 1 extraction would target unknown content. | `assets:verify-sources` stops on mismatch and never updates the lock. DEFERRED_LOCAL. |
| R-02 | Old RO trees modified by tooling (index refresh, cleanup). | Loss of previous work. | No cloud access; local tool uses `--no-optional-locks`, reads metadata only; before/after compare. DEFERRED_LOCAL. |
| R-03 | RO material or derived atlas committed by mistake. | Rights violation; history rewrite needed. | `.gitignore` + `rights:check` on index, untracked, history and dist, with magic-byte sniffing; CI runs it on every push. |
| R-04 | Platform EUC-KR decoders differ (UHC missing, silent byte loss). | Wrong GRF entry or missing asset. | Own strict codec (D-005); all 11,172 Hangul syllables round-trip; whitelist raw hex verified. Real GRF lookup DEFERRED_LOCAL (Phase 1). |
| R-05 | Placeholder results mistaken for real-material validation. | False acceptance. | Placeholder binaries carry a magic header; JSON has `realMaterial: false`; reports split CLOUD_PASS / LOCAL_PASS / DEFERRED_LOCAL. |
| R-06 | Safari/WebKit rendering not verified in cloud. | Build ID page could fail on iPhone. | Page uses plain DOM/CSS; DEFERRED_LOCAL run on Safari. |
| R-07 | `handoff/VALIDATION.md` delivered SHA-256 values do not match the four files in this checkout (whitelist, content seed, reference snapshot, ledger). | Files may have changed after Codex validated them, or were hashed in another encoding/line-ending form. | All content checks were re-run and pass; drift recorded in `docs/RESEARCH-GAPS.md` GAP-001 for Codex to confirm. |
| R-08 | Toolchain drift (TS 7, Preact 11, Node 24.22+). | Breakage on upgrade. | Exact versions + frozen lockfile; upgrades on separate branches (doc 03). |
| R-09 | Old-tree "not a git repo" (RO-Amatsu, RO-Server roots may not be repos). | Only top-level listing can be compared. | Tool records top-level listing hash; deeper trees covered by roBrowserLegacy / remote-client git status. |
