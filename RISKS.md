# RISKS

| ID | Risk | Impact | Mitigation / status |
| --- | --- | --- | --- |
| R-01 | Real GRF hashes differ from the plan (re-downloaded or patched client). | Phase 1 extraction would target unknown content. | `assets:verify-sources` stops on mismatch and never updates the lock. DEFERRED_LOCAL. |
| R-02 | Old RO trees modified by tooling (index refresh, cleanup). | Loss of previous work. | No cloud access; local tool uses `--no-optional-locks`, reads metadata only; before/after compare. DEFERRED_LOCAL. |
| R-03 | RO material or derived atlas committed by mistake. | Rights violation; history rewrite needed. | `.gitignore` + `rights:check` on index, untracked, history and dist, with magic-byte sniffing; CI runs it on every push. |
| R-04 | Platform EUC-KR decoders differ (UHC missing, silent byte loss). | Wrong GRF entry or missing asset. | Fixed official Unicode/Microsoft CP949 table (D-014): 17,048 mappings, stream hash golden test, EUDC rejected, strict decode. Real GRF lookup DEFERRED_LOCAL (Phase 1). |
| R-05 | Placeholder results mistaken for real-material validation. | False acceptance. | Placeholder binaries carry a magic header; JSON has `realMaterial: false`; reports split CLOUD_PASS / LOCAL_PASS / DEFERRED_LOCAL. |
| R-06 | Safari/WebKit rendering not verified in cloud. | Build ID page could fail on iPhone. | Page uses plain DOM/CSS; DEFERRED_LOCAL run on Safari. |
| R-07 | `handoff/VALIDATION.md` hashes vs checkout. | Silent transfer corruption. | RESOLVED (Issue #2): trailing `0D 0A` removed, `.gitattributes eol=lf`, validator checks worktree and Git blob bytes and fails on DRIFT. |
| R-08 | Toolchain drift (TS 7, Preact 11, Node 24.22+). | Breakage on upgrade. | Exact versions + frozen lockfile; upgrades on separate branches (doc 03). |
| R-09 | Old-tree "not a git repo" (RO-Amatsu, RO-Server roots may not be repos). | Only top-level listing can be compared. | Tool records top-level listing hash; deeper trees covered by roBrowserLegacy / remote-client git status. |
| R-10 | `trustedHistoryBaseline` (`b6d70c2…`) stops being an ancestor of HEAD (rebase / history rewrite) or is missing from a shallow clone. | rights:check fails. | Intended fail-closed behaviour; CI uses `fetch-depth: 0`. Changing the baseline requires an explicit config change and a DECISIONS entry. |
| R-11 | History scanning covers only objects reachable from HEAD after the baseline. | Other branches of this shared repository are not protected by this branch's CI. | Out of scope by design; once merged into the RO branch, their objects enter `baseline..HEAD` and are scanned (tested). |
| R-12 | Real SPR/ACT/GND/RSW files deviate from the clean-room format assumptions (RGBA byte order, ACT field layout, RSW version). | Wrong animation or map. | Synthetic round-trips only prove self-consistency; `assets:audit-whitelist` on real files is the first gate (DEFERRED_LOCAL). Fallback: port the specific roBrowserLegacy loader with full GPL notices. |
| R-13 | Cloud FPS numbers (SwiftShader) are mistaken for device performance. | False acceptance. | The report labels every number as cloud; device gates stay DEFERRED_LOCAL. |
| R-14 | prt_fild08 renders without textures and models until GAP-002 is closed. | Visual review limited to heights and walkability. | Dependency report produced locally; the whitelist is extended by Codex. |
| R-15 | Full 400×400 GAT ground mesh (~320k triangles) may be heavy on phones. | Mobile FPS. | Planned: GND 200×200 grid or chunked LOD (render-spike report). |
| R-16 | Windows-only failures (CRLF checkouts, process signalling, file locks) not visible on Linux CI. | Local delivery breaks on the user's machine. | `.gitattributes` for byte-compared files; tests run in a `core.autocrlf=true` clone; a Windows clone re-run of `pnpm ci:local` is required before delivery or merge (Codex condition). |
