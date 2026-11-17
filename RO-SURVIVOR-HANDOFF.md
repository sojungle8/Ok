# RO Survivor Fan Game — Claude handoff

This branch is the dedicated clean-room handoff for the RO survivor fan-game project.

Read in this order:

1. [docs/product-plan/00-START-HERE.md](docs/product-plan/00-START-HERE.md)
2. [docs/product-plan/09-GITHUB-CLOUD-WORKFLOW.md](docs/product-plan/09-GITHUB-CLOUD-WORKFLOW.md)
3. [docs/product-plan/06-CLAUDE-COMMANDS.md](docs/product-plan/06-CLAUDE-COMMANDS.md)

For GitHub/Claude cloud work, document 09 overrides Windows paths and local-asset acceptance steps. The repository root is the new game project root.

## Asset model

This branch intentionally contains no Gravity client binaries and no RO Survivors/HANS source code.

Claude can build the deterministic game core, placeholder renderer, schemas, tests, extraction commands and read-only asset gateway from the supplied plan. Real RO sprites, maps and audio are resolved only on the user's Windows computer from the whitelist in `docs/product-plan/handoff/fan-local-asset-whitelist.csv`. Derived files stay under `.local-assets/` and never enter Git.

When local assets are unavailable, use `PlaceholderAssetGateway` and synthetic fixtures so build, tests and CI remain fully runnable. Mark real-asset checks `DEFERRED_LOCAL`; never claim that mock results are real-material validation.

## Current task

Execute only Phase 0. Report `CLOUD_PASS` and `DEFERRED_LOCAL` separately, then stop.
