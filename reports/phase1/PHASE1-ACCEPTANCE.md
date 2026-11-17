# Phase 1 acceptance — cloud spike

Date: 2026-11-17 · Branch `claude/ro-survivor-handoff-p1xb2o`. Phase 1 is **not complete**: per
`09-GITHUB-CLOUD-WORKFLOW.md` it cannot be declared done until the real-asset gates are `LOCAL_PASS`.
Everything below marked CLOUD_PASS used placeholder or **synthetic** data (code-drawn shapes stored
under the real whitelist raw names). No RO client, GRF, bundle or asset pack was downloaded.

## Work items (04-CONSTRUCTION-PLAN.md Phase 1)

| Item | Status | Evidence |
| --- | --- | --- |
| 1.1.1–2 Verify existing remote-client on loopback, record its API | DEFERRED_LOCAL | Not available in the cloud. The new repo has its own clean-room gateway instead (D-019), so remote-client is no longer on the critical path |
| 1.1.3 `AssetGatewayClient` (`getBinary` / `getJson` / `resolvePath` / `getSourceHash`) | CLOUD_PASS | `packages/asset-contracts/src/http.ts`; `apps/asset-gateway/test/server.synthetic.test.ts` |
| 1.1.4 `PlaceholderAssetGateway`, tests run without RO assets | CLOUD_PASS | CI |
| 1.1.5 New GPL gateway with minimal modules | CLOUD_PASS (synthetic GRF) | `apps/asset-gateway`; nothing copied from roBrowserLegacy / remote-client |
| 1.1.6 Size, traversal, extension (ID-only), loopback, timeout guards | CLOUD_PASS | 7 gateway tests: Host/Origin checks, 405, unknown ID refused before HTTP, byte limits, timeout |
| 1.2.1–2 Swordsman, Poring and Mastering SPR/ACT: palette, RGBA, actions, directions, frame time, pivot, sound events | Parsers CLOUD_PASS (synthetic, ACT 2.0/2.3/2.4/2.5) · real files DEFERRED_LOCAL | `packages/ro-format-runtime`; `pnpm assets:audit-whitelist` |
| 1.2.3 Contact sheets + JSON metadata | Pipeline CLOUD_PASS (synthetic) · real DEFERRED_LOCAL | `reports/phase1/synthetic/*.png` |
| 1.2.4 idle/walk/attack/hit/death/cast with explicit fallback | CLOUD_PASS (synthetic) | metadata `slots.*.fallback` (monster cast falls back to attack) |
| 1.2.5 UV mirror adds no texture memory | CLOUD_PASS | `flipX` frames share pixels (extract test); shader flips UVs |
| 1.2.6 Snapshot test of input hash → output metadata | CLOUD_PASS (deterministic outputs on synthetic sources) · real golden DEFERRED_LOCAL | extract determinism test; manifest records entry and output SHA-256 |
| 1.3.1 prt_fild08 RSW/GND/GAT/RSM dependency closure | Tool CLOUD_PASS · real report DEFERRED_LOCAL | `reports/prt_fild08-dependencies.json` written under `.local-assets` |
| 1.3.2 Ground heights + texture, then models | Heights CLOUD_PASS (synthetic). **Textures and RSM models NOT DONE**: not whitelisted (GAP-002) | renderer ground mesh |
| 1.3.3 Orthographic camera, Y-up / foot-pivot world spec | CLOUD_PASS | D-020 |
| 1.3.4 GAT walk grid + debug overlay | CLOUD_PASS (synthetic) | `smoke-fanlocal-synthetic-*.png` (G overlay) |
| 1.3.5 Path flood from spawn | CLOUD_PASS (synthetic: 3680/3780, the enclosed pond is unreachable as designed). The boss-area target needs stage zones (Phase 2) | `synthetic-extract-summary.json` |
| 1.3.6 Instanced trees/rocks; draw call, triangle and texture stats | Actors instanced CLOUD_PASS · map models DEFERRED (depend on GAP-002) | bench JSON |
| 1.4.1–4 Player + 50 Porings, circle collision, WASD + joystick, 1 spawn/s, renderer reads only RenderSnapshot | CLOUD_PASS | `packages/core-sim/test/arena.test.ts`; `smoke-*.json` (keyboard east, joystick north) |
| 1.4.5 Same state hash at 15/30/60 FPS after 60 s | CLOUD_PASS | golden `4dbb7aa405a98e3b` |
| 1.5 Performance report | CLOUD numbers only | `reports/render-spike-01.md` |

## Phase 1 gates

| Gate | Status |
| --- | --- |
| 8 directions, pivot and ground shadow pass manual review | Synthetic contact sheets reviewed in the cloud · **real sprites DEFERRED_LOCAL** (human review of `contact-sheets/*.png`) |
| No major misalignment between map visuals and the debug walk area | Synthetic CLOUD_PASS · **real prt_fild08 DEFERRED_LOCAL** |
| 250 enemies at 60 FPS desktop; 30 FPS on a mid-range phone or emulation | Emulated mobile (4x CPU, 30 FPS cap): p50 30.0 / p95-low 29.9 · **desktop GPU and real phone DEFERRED_LOCAL** (cloud is software WebGL; profile and improvement plan in the report) |
| Headless simulation tests pass with the renderer removed | CLOUD_PASS (core-sim has no DOM / Three.js; lint bans wall clock) |
| Derived textures only in `.local-assets`, never in Git | CLOUD_PASS (marker rule + tests) · real extraction check DEFERRED_LOCAL |

## Local wiring (Windows PowerShell)

```powershell
git checkout claude/ro-survivor-handoff-p1xb2o; git pull
pnpm install --frozen-lockfile
pnpm assets:verify-sources                     # Phase 0 lock (writes assets/source-lock.local.json)
pnpm assets:audit-whitelist                    # expect 48/48 PASS -> reports/local/audit-whitelist.json
pnpm assets:extract --profile fan-local        # .local-assets/<hash>/v1/: atlases, metadata, contact sheets, map, dependency report
#   review .local-assets/<hash>/v1/contact-sheets/*.png  (8 directions, pivot cross, shadow)
#   send .local-assets/<hash>/v1/reports/prt_fild08-dependencies.json to Codex (GAP-002)
pnpm dev:fan-local                             # gateway on 127.0.0.1:4178 + client; press G for the GAT overlay
pnpm build; node tools/e2e/bench.mjs; node tools/e2e/bench-report.mjs   # on the real GPU (rename the JSON for the device)
pnpm rights:check; git status --short          # no derived files outside .local-assets
```

Expected results: the audit prints `48/48 PASS`; any FAIL (for example an ACT parser error on a real file)
is a Phase 1 finding, so send `reports/local/audit-whitelist.json` back. The client HUD shows
`已連線 · mode=fan-local`.
