# RO Survivor Fan Game

Non-commercial, unofficial RO survivor fan game — clean-room code, GPL-3.0-only.
Not affiliated with or licensed by Gravity, any RO operator, or RO Survivors / Reven4nt / HANS.
No RO client files are in this repository; see `RO-SURVIVOR-HANDOFF.md` and `docs/product-plan/`.

## Quick start (no RO assets needed)

```sh
corepack enable            # or install pnpm 10.28.0
pnpm install --frozen-lockfile
pnpm ci:local              # lint, typecheck, test, build, rights:check, assets:test-synthetic
pnpm dev                   # placeholder page on http://127.0.0.1:5173
```

Node 24.21.0 is required (`.nvmrc`).

## Status

See `STATUS.md` and `reports/phase0/PHASE0-ACCEPTANCE.md`.
