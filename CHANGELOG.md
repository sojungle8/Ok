# Changelog

## Unreleased — Phase 1 original assets and RO UI (2026-11-17)

- Commit A (`983913f`): canonical v2 whitelist (174 rows), map dependency closure contract, formal loader stops at
  the pending GND/RSM/water/shadow/audio renderer instead of substituting anything.
- UI-A: canonical v3 whitelist (282 rows = v2 + 108 RO UI rows), exact `filesystem:System` font allowlist, UI asset
  manifest schema + local generator, reference profile `KRO2021_CLASSIC_V0_FAN` (DISCOVERED), reference metrics
  (DEFERRED_LOCAL), profile compatibility tests, core UI asset gate in the formal loader (D-028…D-030).
- Commit B: local extraction and derived scene contract (converter v2). Adds clean-room BMP, JPEG-header, GRSM 1.1–1.5
  and WAV-header readers, and parses GND 1.7 lightmaps and RSW water/sound records. Writes lossless texture PNGs, a
  lightmap atlas, model JSON, placements, water frames by ID, the official shadow with ACT alpha kept, and audio by ID.
  Fails closed on any missing or malformed dependency. Formal renderer still pending
  (`reports/phase1/COMMIT-B-DERIVED-CONTRACT.md`).
- Commit B fixes for Codex CHANGES_REQUIRED F-1…F-5:
  - legacy GRSM keyframe layout (model-level position keys with data; no per-node keys; trailing bytes rejected),
    with a golden fixture;
  - transactional extraction (staging + atomic swap; a failed re-run leaves no manifest);
  - the gateway serves derived files only through a valid manifest;
  - structured failures for RSW/GND/GAT;
  - complete provenance for composite outputs;
  - 32-bit BMP rejected.
- Commit B fixes for R-1…R-3:
  - the legacy RSM model position-key count is mandatory (truncation is detected);
  - the publish commit point is explicit, and cleanup after it is best-effort with a warning;
  - a missing core map row is reported with its fixed canonical path.
- Commit C, formal renderer (`reports/phase1/COMMIT-C-FORMAL-RENDERER.md`):
  - GND ground with texture UVs, vertex colour and embedded lightmaps;
  - GRSM props instanced at every RSW placement, and the 32 official water frames;
  - four-layer swordsman atlas with per-direction layer order, and the official shadow at alpha 128;
  - BGM 12 + positional RSW WAVs behind a 「點擊啟用音訊」 gate;
  - formal and fixture worlds split; fixture build only via `--mode fixture`.

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
