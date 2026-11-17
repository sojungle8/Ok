# STATUS

Current phase: **Phase 0 — 建立安全的新專案（cloud handoff complete; local gates DEFERRED_LOCAL）**
Phase 1 has **not** started.

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
| 6 | `rights:check` (index, untracked, Git history, dist; magic bytes) + positive and intentional-failure tests | CLOUD_PASS | `tools/rights-check/rights-check.synthetic.test.ts` (10 tests) and `pnpm rights:check` |
| 7a | SHA-256 verification tool + committed example lock without absolute paths | CLOUD_PASS | `tools/assets/verify-sources.synthetic.test.ts`, `assets/source-lock.example.json` |
| 7b | Real `data.grf` / `rdata.grf` / BGM hashes compared with the plan | DEFERRED_LOCAL | `pnpm assets:verify-sources` on Windows |
| 8a | Read-only old-tree fingerprint tool (commit, license, dirty summary, no file names, no index writes) | CLOUD_PASS | `tools/local/old-trees.synthetic.test.ts` |
| 8b | Real roBrowserLegacy / remote-client commit, license, dirty summary | DEFERRED_LOCAL | `pnpm local:old-trees snapshot before` |
| 9 | Deterministic sim: same seed + commands → same state hash (also 15/30/60 FPS) | CLOUD_PASS | `packages/core-sim/test/determinism.test.ts`, golden hash `991c54eee7df3deb` |
| 10 | CI pipeline lint → typecheck → test → build → rights:check (+ synthetic assets, handoff validation) | CLOUD_PASS (local run) | `pnpm ci:local`; `.github/workflows/ci.yml` |
| G1 | Old RO directories' `git status` unchanged before/after | DEFERRED_LOCAL | cloud never had access; run snapshot/compare locally |
| G2 | `pnpm lint && typecheck && test && build && rights:check` all pass | CLOUD_PASS | see `reports/phase0/PHASE0-ACCEPTANCE.md` |
| G3 | Git index has no .grf/.spr/.act/raw RO audio/credentials/.env.local | CLOUD_PASS | `pnpm rights:check` |
| G4a | Placeholder site shows build ID in Chrome | CLOUD_PASS | `node tools/e2e/smoke.mjs` (Chromium 153, desktop + 390px mobile), screenshots in `reports/phase0/` |
| G4b | Placeholder site shows build ID in Safari-compatible browser | DEFERRED_LOCAL | WebKit not installed in the cloud container; run smoke with WebKit / real Safari locally |

Handoff package re-validation: content checks PASS; four delivered SHA-256 values in
`handoff/VALIDATION.md` differ from this checkout (see RISKS R-07, `docs/RESEARCH-GAPS.md` GAP-001).

## Next minimal step

Wait for the user's local run of the DEFERRED_LOCAL commands in
`reports/phase0/PHASE0-ACCEPTANCE.md` and for an explicit Phase 1 instruction.
