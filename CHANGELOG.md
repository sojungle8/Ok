# Changelog

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
