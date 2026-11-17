# Phase 0 acceptance — cloud handoff

Date: 2026-11-17 · Branch: `claude/ro-survivor-handoff-p1xb2o` (from `claude/ro-survivor-fangame-handoff` @ `ec77ae0`)
Environment: cloud Linux container, Node 24.21.0, pnpm 10.28.0, Chromium 153 (preinstalled Playwright).
No GRF, RO client, BGM or old RO trees were available or fetched. All asset-related evidence here
is **placeholder / synthetic** and is not real-material validation.

## Commands run in the cloud

| Command | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` (clean `node_modules`) | PASS |
| `pnpm lint` | PASS (0 problems; rule probe confirmed `Math.random`, floating promise, `require-await` are errors) |
| `pnpm typecheck` | PASS (6 workspace projects + tools) |
| `pnpm test` | PASS — 11 files, 68 tests (after Issue #2 fixes) |
| `pnpm build` | PASS — `apps/client/dist` (index.html, 1 CSS, 1 JS ≈125 kB) |
| `pnpm rights:check` | PASS (index, untracked, whole working tree, history `b6d70c2fd527..HEAD` paths + blob bytes, dist) |
| intentional failure: ignored `test.grf` at repo root → `pnpm rights:check` | FAIL as expected (exit 1); after removal PASS — `reports/phase0/rights-check-demo.txt` |
| `pnpm assets:test-synthetic` | PASS — 6 files, 44 tests (rights-check, verify-sources, old-trees, whitelist/placeholder, CP949 golden, CP949 generator) |
| `pnpm assets:validate-handoff` | PASS — 21/21 incl. worktree and Git blob hashes, fail-closed — `reports/phase0/handoff-validation.txt` |
| `node tools/e2e/smoke.mjs` | Chromium desktop + 390 px mobile PASS; WebKit NOT_RUN (not installed) — screenshots in this folder |

Deterministic core: golden final state hash `991c54eee7df3deb` (seed 12345, 3,600 ticks); seed 777
gives one identical hash at 15, 30 and 60 render FPS with 0 dropped ticks.

GitHub Actions: run #5 <https://github.com/sojungle8/Ok/actions/runs/44010045832> on `a600c32` — success.

## Gate status

| Gate | Status |
| --- | --- |
| Monorepo, Node lock, TS strict, Vite/Preact client, core-sim, content-schema, testkit | CLOUD_PASS |
| GPLv3 LICENSE + THIRD-PARTY-NOTICES (source fields, nothing copied) | CLOUD_PASS |
| STATUS / DECISIONS / RISKS / CHANGELOG / .env.example / .gitignore | CLOUD_PASS |
| rights:check + positive / intentional-failure tests | CLOUD_PASS |
| Same seed + commands → same state hash | CLOUD_PASS |
| CI-equivalent pipeline (`pnpm ci:local`) | CLOUD_PASS |
| Git index free of GRF/SPR/ACT/raw audio/credentials/.env.local | CLOUD_PASS |
| Placeholder page shows build ID — Chrome | CLOUD_PASS |
| Source-hash tool and example lock (synthetic sources) | CLOUD_PASS |
| Old-tree fingerprint tool (synthetic repos) | CLOUD_PASS |
| Real `data.grf` / `rdata.grf` / BGM SHA-256 vs plan | DEFERRED_LOCAL |
| Real roBrowserLegacy / remote-client commit, license, dirty summary | DEFERRED_LOCAL |
| Old RO directories `git status` unchanged before/after | DEFERRED_LOCAL |
| Placeholder page shows build ID — Safari / WebKit | DEFERRED_LOCAL |

## Local wiring (Windows PowerShell, in this repo's checkout)

```powershell
git fetch origin claude/ro-survivor-handoff-p1xb2o
git checkout claude/ro-survivor-handoff-p1xb2o
node -v                                   # expect v24.21.0
corepack enable; pnpm -v                  # expect 10.28.0
pnpm install --frozen-lockfile

Copy-Item .env.example .env.local         # then edit .env.local with the real read-only paths
                                          # (see docs/LOCAL-SOURCE-PATHS.example.md)

pnpm local:old-trees snapshot before      # old RO trees: commit, license, dirty summary (no file names)
pnpm assets:verify-sources                # data.grf / rdata.grf / BGM SHA-256 vs assets/source-lock.example.json
pnpm ci:local                             # lint, typecheck, test, build, rights:check, synthetic assets
pnpm build; node tools/e2e/smoke.mjs      # Chromium (+ WebKit if installed); also open `pnpm preview` in Safari
pnpm local:old-trees snapshot after
pnpm local:old-trees compare before after # every tree must print UNCHANGED
git status --short                        # must show no .env.local, lock, GRF or derived files
pnpm rights:check
```

Expected outputs:

- `assets:verify-sources`: `PASS data.grf bytes` 2966717458, `PASS data.grf sha256` `FA3B7BBD…C3B6`,
  `PASS rdata.grf bytes` 306697843, `PASS rdata.grf sha256` `FA6367B8…124E`, `PASS bgm:12.mp3`
  1476608/`814A8484…A58E`, `mp3 count` 185 (WARN if different), then `LOCAL_PASS` and an ignored
  `assets/source-lock.local.json`. Any FAIL: stop, keep the lock unchanged, send `reports/local/verify-sources.json`.
- `local:old-trees snapshot`: roBrowserLegacy head `5435cf67642e`, remote-client head `cd51fcab4534`,
  license first line `GNU GENERAL PUBLIC LICENSE`; dirty counts are recorded (plan: roBrowserLegacy has
  13 modified files plus untracked files; remote-client has a modified `index.js`).
- `compare before after`: four lines `UNCHANGED`, exit 0.

Report back `reports/local/verify-sources.json` and both `reports/local/old-trees-*.json` (they contain
hashes and counts, no file names; `verify-sources.json` contains no paths). The local lock with paths stays local.

## Not done (by design)

No asset gateway server or HTTP client, no SPR/ACT/map parsing, no Three.js, no characters, maps,
combat, accounts or networking. These start only with an explicit Phase 1 instruction.
