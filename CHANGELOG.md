# Changelog

## Unreleased — Phase 0 (2026-11-17)

- pnpm monorepo: `apps/client` (Vite + Preact placeholder page), `apps/asset-gateway` (loopback config contract),
  `packages/core-sim`, `packages/content-schema`, `packages/asset-contracts`, `packages/testkit`.
- Deterministic core: seeded PRNG streams, canonical state hash, fixed-step sim and clock with tests.
- `rights:check` with positive and intentional-failure tests.
- `assets:verify-sources` (local GRF/BGM SHA-256 against `assets/source-lock.example.json`).
- `local:old-trees` read-only before/after fingerprint of the previous RO trees.
- `assets:validate-handoff` offline re-validation of the Codex handoff package.
- GPLv3 `LICENSE`, `THIRD-PARTY-NOTICES.md`, `.env.example`, CI workflow.
