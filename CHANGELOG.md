# Changelog

## Unreleased — Phase 2 vertical slice (2026-11-17)

- Seed compiler + integer runtime content (`73a33f9`); run simulation, drafts, bosses, bot, tuning layer (`d4e6687`).
- Flow state machine, run results, transactional settlement (`4e63988`); input adapters, automated acceptance (`30dae38`).
- Client game flow, run renderer, settlement UI, mixer rules (`6f310d9`); fix: the run no longer restarts on phase
  changes; compact in-run header; browser flow e2e (`reports/phase2/`).

## Unreleased — Phase 1 cloud spike (2026-11-17)

- Clean-room RO format parsers + synthetic writers (`704e75e`).
- Loopback asset gateway and HttpAssetGatewayClient with placeholder fallback (`9d686e1`).
- assets:audit-whitelist, assets:extract --profile fan-local, dev:fan-local, derived-output marker (`8bfcd48`).
- Deterministic arena with RenderSnapshot (`2f213e6`).
- Three.js arena client, synthetic fan-local demo, e2e smoke and bench (`151c3d9`).
- Reports: render-spike-01, Phase 1 acceptance; GAP-002 for map textures and models.
- Formal-screen rule (D-022): no placeholder/self-drawn/synthetic art in the game; missing RO assets stop the
  client with canonical paths; synthetic fixtures only in the separate test build; shadows off (GAP-003).

## Unreleased — Phase 0 fixes for Issue #2 (2026-11-17)

- Handoff transfer integrity: removed the extra trailing CRLF from four hash-locked files, `.gitattributes eol=lf`,
  fail-closed `assets:validate-handoff` (worktree + Git blob), now part of `ci:local`. (`9062ceb`)
- CP949 from the fixed official Unicode/Microsoft mapping with golden tests and a maintenance-only verified generator;
  Unicode License v3 notice. (`c1e90e9`)
- rights:check scans history paths and blob bytes after the trusted baseline, fail-closed baseline validation,
  bounded blob reads. (`a600c32`)
- Documentation corrections (VALIDATION.md 47 + 1 rows, STATUS, RISKS, DECISIONS, RESEARCH-GAPS).

## Unreleased — Phase 0 (2026-11-17)

- pnpm monorepo: `apps/client` (Vite + Preact placeholder page), `apps/asset-gateway` (loopback config contract),
  `packages/core-sim`, `packages/content-schema`, `packages/asset-contracts`, `packages/testkit`.
- Deterministic core: seeded PRNG streams, canonical state hash, fixed-step sim and clock with tests.
- `rights:check` with positive and intentional-failure tests.
- `assets:verify-sources` (local GRF/BGM SHA-256 against `assets/source-lock.example.json`).
- `local:old-trees` read-only before/after fingerprint of the previous RO trees.
- `assets:validate-handoff` offline re-validation of the Codex handoff package.
- GPLv3 `LICENSE`, `THIRD-PARTY-NOTICES.md`, `.env.example`, CI workflow.
