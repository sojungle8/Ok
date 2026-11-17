# STATUS

Current phase: **Phase 1 — 素材與渲染技術尖峰: cloud spike done; real-asset gates DEFERRED_LOCAL (Phase 1 not complete)**.
Phase 0: **conditional acceptance** (deferred regressions listed below; Windows `autocrlf=true` re-run pending).
Phase 2 has **not** started.

## Phase 1 (cloud) — summary

Details, gates and local commands: `reports/phase1/PHASE1-ACCEPTANCE.md`; performance: `reports/render-spike-01.md`.

| Area | Status |
| --- | --- |
| Clean-room parsers (SPR 1.x–2.1, ACT 2.0–2.5, PAL, GAT, GND, RSW 1.2–2.1, GRF 0x200) | CLOUD_PASS on synthetic files · real files DEFERRED_LOCAL |
| Loopback gateway + HttpAssetGatewayClient + placeholder fallback | CLOUD_PASS (synthetic GRF) |
| audit-whitelist / extract --profile fan-local / dev:fan-local | CLOUD_PASS on synthetic sources (48/48 audit) · real DEFERRED_LOCAL |
| Contact sheets (6 slots × 8 directions, pivot, shadow), UV-mirror dedupe | CLOUD_PASS synthetic · human review of real sheets DEFERRED_LOCAL |
| Arena: player + 50 Porings, 1 spawn/s, collision, WASD + joystick, RenderSnapshot | CLOUD_PASS |
| 15/30/60 FPS identical 60 s hash | CLOUD_PASS (`4dbb7aa405a98e3b`) |
| prt_fild08 ground textures, RSM models, instanced map props | NOT DONE: not whitelisted (GAP-002) |
| 250 enemies @60 FPS desktop / phone 30 FPS | Emulated 4x CPU at 30 FPS: pass · real GPU / phone DEFERRED_LOCAL |
| Derived files only in `.local-assets` | CLOUD_PASS (marker + rights:check tests) |

Test counts at commit `151c3d9` (Actions run #7 <https://github.com/sojungle8/Ok/actions/runs/44014237315>: success): 101 unit/integration tests, 70 synthetic tests.

---

# Phase 0 — conditional acceptance (Codex)

Codex accepted Phase 0 **conditionally** so Phase 1 could proceed. Phase 0 is **not** declared
unconditionally accepted. The deferred regressions below must be closed, and `pnpm ci:local` re-run in a
fresh Windows clone with `core.autocrlf=true`, before Windows delivery, a formal merge or a release.

| Deferred Phase 0 regression | State |
| --- | --- |
| CRLF checkout breaks the CP949 generator byte-exact test | Fixed in `113ca25` (`.gitattributes eol=lf` for the generated table; Actions run #9 success). Reproduced and verified with a fresh `core.autocrlf=true` clone on Linux: `pnpm ci:local` passes. **Windows clone re-run pending** |
| rights:check child process may raise `EPERM` on Windows | Defensive fix in `113ca25` (no child signal; pipe destroyed; temp-dir cleanup retries). Not reproducible on Linux: **Windows re-run pending** |
| `RESEARCH-GAPS.md` stale wording | Rewritten in `c9f5606` (GAP-001 row no longer describes DRIFT as non-failing) |
| History object count misreported | Corrected: `b6d70c2..a600c32` = 45 objects (run #5), `b6d70c2..3157380` = **60** (final Phase 0 commit). The count grows with every commit; it is a per-HEAD figure, not a constant |

Phase 0 cloud gates CLOUD_PASS; Codex reported the local evidence (GRF hashes, old trees unchanged, WebKit smoke) in Issue #2.

Environment of record (cloud): Linux container, Node 24.21.0 (`.nvmrc`), pnpm 10.28.0,
Chromium 153 (preinstalled Playwright). No GRF / RO client / old RO trees available.

## Phase 0 gates

| # | Gate | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Project root inventoried, nothing overwritten | CLOUD_PASS | repo root = project root (doc 09); `git status` clean before work; branch `claude/ro-survivor-handoff-p1xb2o` fast-forwarded from `claude/ro-survivor-fangame-handoff` |
| 2 | pnpm monorepo, Node lock, TS strict, Vite + Preact client, core-sim, content-schema, testkit (+ asset-contracts, asset-gateway config) | CLOUD_PASS | `pnpm typecheck`, `pnpm build` |
| 3 | GPLv3 `LICENSE`, `THIRD-PARTY-NOTICES.md` with source fields | CLOUD_PASS | files at repo root |
| 4 | Plan docs in `docs/product-plan` | CLOUD_PASS | already in repo (doc 09: no copy needed) |
| 5 | STATUS / DECISIONS / RISKS / CHANGELOG / `.env.example` / safe `.gitignore` | CLOUD_PASS | files at repo root |
| 6 | `rights:check` (index, untracked, working tree, Git history after trusted baseline incl. blob bytes, dist; magic bytes) + positive and intentional-failure tests | CLOUD_PASS | `tools/rights-check/rights-check.synthetic.test.ts` (17 tests) and `pnpm rights:check` |
| 7a | SHA-256 verification tool + committed example lock without absolute paths | CLOUD_PASS | `tools/assets/verify-sources.synthetic.test.ts`, `assets/source-lock.example.json` |
| 7b | Real `data.grf` / `rdata.grf` / BGM hashes compared with the plan | DEFERRED_LOCAL | `pnpm assets:verify-sources` on Windows |
| 8a | Read-only old-tree fingerprint tool (commit, license, dirty summary, no file names, no index writes) | CLOUD_PASS | `tools/local/old-trees.synthetic.test.ts` |
| 8b | Real roBrowserLegacy / remote-client commit, license, dirty summary | DEFERRED_LOCAL | `pnpm local:old-trees snapshot before` |
| 9 | Deterministic sim: same seed + commands → same state hash (also 15/30/60 FPS) | CLOUD_PASS | `packages/core-sim/test/determinism.test.ts`, golden hash `991c54eee7df3deb` |
| 10 | CI pipeline lint → typecheck → test → build → rights:check (+ synthetic assets, handoff validation) | CLOUD_PASS | `pnpm ci:local`; Actions run #5 success |
| G1 | Old RO directories' `git status` unchanged before/after | DEFERRED_LOCAL | cloud never had access; run snapshot/compare locally |
| G2 | `pnpm lint && typecheck && test && build && rights:check` all pass | CLOUD_PASS | see `reports/phase0/PHASE0-ACCEPTANCE.md` |
| G3 | Git index has no .grf/.spr/.act/raw RO audio/credentials/.env.local | CLOUD_PASS | `pnpm rights:check` |
| G4a | Placeholder site shows build ID in Chrome | CLOUD_PASS | `node tools/e2e/smoke.mjs` (Chromium 153, desktop + 390px mobile), screenshots in `reports/phase0/` |
| G4b | Placeholder site shows build ID in Safari-compatible browser | DEFERRED_LOCAL | WebKit not installed in the cloud container; run smoke with WebKit / real Safari locally |

## Phase 0 fixes — Codex audit Issue #2 (accepted and implemented)

Code commits `9062ceb`, `c1e90e9`, `a600c32`; GitHub Actions run #5
<https://github.com/sojungle8/Ok/actions/runs/44010045832> on `a600c32`: **success**
(install, lint, typecheck, 68 tests, build, rights:check, 44 synthetic tests, validate-handoff).

| Finding | Status | Evidence |
| --- | --- | --- |
| A handoff transfer integrity | ACCEPTED · CLOUD_PASS | trailing `0D 0A` removed; `.gitattributes eol=lf`; worktree **and Git blob** SHA-256 = VALIDATION.md for all four files |
| B DRIFT was green | ACCEPTED · CLOUD_PASS | `assets:validate-handoff` exits 1 on FAIL/DRIFT, 21/21 PASS, in `ci:local` and CI; tests cover worktree and staged-blob drift |
| C CP949 contract | ACCEPTED · CLOUD_PASS | fixed official table: 17,048 double-byte mappings, stream SHA-256 `1ed8d8e4d8095248317a77a2976f4ec8e76e551b11caa1f7249476bf109961cd`, € / ® supported, 188 EUDC rejected, 11,172 Hangul round-trip, strict errors; generator verifies source `f57e6fef…` and is maintenance-only (no network in build/test/CI) |
| D history blob scanning | ACCEPTED · CLOUD_PASS | baseline `b6d70c2fd5271dae32e926210ea7d49fdea9023c` (full SHA, fail-closed); `baseline..HEAD` paths + blobs incl. merged branches; 17 rights tests pass |
| Docs (47 + 1 rows, counts) | ACCEPTED · done | VALIDATION.md line corrected; this file; RISKS; DECISIONS D-014–D-016; RESEARCH-GAPS GAP-001 RESOLVED |

Counts are taken from the runner output of run #5 and a clean local `pnpm install --frozen-lockfile && pnpm ci:local`.

## Next minimal step

Run the Phase 1 local commands in `reports/phase1/PHASE1-ACCEPTANCE.md` (audit, extract, contact-sheet
review, dev:fan-local, GPU bench), return the audit and dependency reports, and wait for an explicit
instruction before Phase 2.
