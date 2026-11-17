# RO Survivor Fan Game

Non-commercial, unofficial RO survivor fan game — clean-room code, GPL-3.0-only.
Not affiliated with or licensed by Gravity, any RO operator, or RO Survivors / Reven4nt / HANS.
No RO client files are in this repository; see `RO-SURVIVOR-HANDOFF.md` and `docs/product-plan/`.

## Quick start

Development and CI need no RO assets. The game screen itself only ever shows original RO assets from the
user's own client: without them it stops and lists the missing canonical paths (DECISIONS D-022).

```sh
corepack enable            # or install pnpm 10.28.0
pnpm install --frozen-lockfile
pnpm ci:local              # lint, typecheck, test, build, rights:check, assets:test-synthetic
pnpm dev:fan-local         # local only: gateway + client with your own RO client's assets
pnpm e2e:smoke             # automated browser checks (synthetic fixtures only in a separate test build)
```

Node 24.21.0 is required (`.nvmrc`).

## Status

See `STATUS.md` and `reports/phase0/PHASE0-ACCEPTANCE.md`.
