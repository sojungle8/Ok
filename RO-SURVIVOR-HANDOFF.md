# RO Survivor Fan Game — Claude handoff

Start with [docs/product-plan/00-START-HERE.md](docs/product-plan/00-START-HERE.md), then follow the master and Phase 0 instructions in [docs/product-plan/06-CLAUDE-COMMANDS.md](docs/product-plan/06-CLAUDE-COMMANDS.md).

## Asset model

This branch intentionally contains no Gravity client binaries and no RO Survivors/HANS source code.

Claude can build the deterministic game core, placeholder renderer, schemas, tests and read-only asset gateway from the supplied plan. Real RO sprites, maps and audio are resolved only on the user's Windows computer from the local GRF whitelist in `docs/product-plan/handoff/fan-local-asset-whitelist.csv`. Derived files stay under `.local-assets/` and never enter Git.

When local assets are unavailable, use placeholder assets so build, tests and CI remain fully runnable.

## Scope

Execute only Phase 0 first. Do not start Phase 1 until every Phase 0 acceptance gate passes.
