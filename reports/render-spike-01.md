# Render spike 01 — Phase 1

Status: **cloud run with synthetic test fixtures only (automated test build).** Real RO sprites, the real `prt_fild08`
and real devices are `DEFERRED_LOCAL`. Nothing here is a device measurement.

## Environment of this run

| Field | Value |
| --- | --- |
| Date | 2026-11-17T04:19:00.312Z |
| Build ID | `0.0.0+ca4390b29646.20261117` |
| Machine | cloud Linux container, 4 vCPU, no GPU |
| Browser | headless Chromium (`HeadlessChrome/153.0.8010.12 Safari/537.36`) |
| WebGL | `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)` — **software rasteriser** |
| Assets | `synthetic-test-fixture`: SYNTHETIC test fixtures served to the separate test build (synthetic 64×64 GAT map). Formal builds refuse them |
| Quality | pixel ratio 1, nearest filtering, no post-processing |
| Seed | 20261117; the bench moves the player in a fixed 8-direction pattern |
| Duration | 8 s per run (first 5 frames discarded) |
| Transfer | 677,744 bytes (app shell only; no RO assets in the cloud) |

## Results (`reports/phase1/render-spike-01.cloud.json`)

| Run | Enemies | Viewport | CPU throttle | FPS cap | FPS p50 | FPS p95-low | Frame ms p95 | Tick ms p95 | Tick ms max | Draw calls | Triangles | JS heap MB | Texture MB (est.) | Dropped ticks | Load ms |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| desktop-50 | 50 | 1280x720 @1x | 1x | — | 59.9 | 59.5 | 16.8 | 0.200 | 0.60 | 3 | 8294 | 9.5 | 0.13 | 0 | 152 |
| desktop-100 | 100 | 1280x720 @1x | 1x | — | 59.9 | 30.1 | 33.2 | 0.200 | 1.55 | 3 | 8394 | 9.5 | 0.13 | 1 | 209 |
| desktop-250 | 250 | 1280x720 @1x | 1x | — | 59.9 | 30.0 | 33.3 | 0.300 | 1.95 | 3 | 8694 | 9.5 | 0.13 | 0 | 158 |
| desktop-500 | 500 | 1280x720 @1x | 1x | — | 59.9 | 29.9 | 33.4 | 0.600 | 3.60 | 3 | 9194 | 9.5 | 0.13 | 0 | 147 |
| throttled4x-fps30-250 | 250 | 390x844 @1x | 4x | 30 | 30.0 | 29.9 | 33.4 | 1.350 | 3.48 | 3 | 8694 | 10.7 | 0.13 | 3 | 486 |

Load ms = navigation start to the first simulated frame.

## Reading the numbers

- **The simulation is not the bottleneck.** Tick p95 is 0.60 ms with 500 enemies
  (budget: 4 ms desktop / 8 ms mobile) and 1.35 ms at 250 enemies under 4x CPU throttling.
  Headless Vitest also keeps 500 enemies under 16 ms p95 with no renderer.
- **Draw calls are constant (3)** at every enemy count: ground, instanced enemies, player (no engine-drawn shadows, GAP-003).
- **FPS in this container is limited by the software rasteriser** (SwiftShader, 4 vCPU): median FPS
  50 → 59.9, 100 → 59.9, 250 → 59.9, 500 → 59.9; the p95-low values sit on 30/20 FPS
  vsync steps. This says nothing about real GPUs, so the 60 FPS desktop / 30 FPS mobile gate must be measured
  on the user's machines with real RO assets.
- **Dropped ticks** come from the 5-tick catch-up cap on long frames (start-up and throttled hitches). Game time
  then runs slower than wall time; the result for the same input stream is unchanged (15/30/60 FPS hash tests).
- Mirrored directions reuse atlas pixels through a per-instance UV flip; no second texture is created
  (the extractor test checks that every `flipX` frame shares its rectangle with an unflipped one).

## Phase 1 performance gate

| Gate | Status |
| --- | --- |
| 250 enemies at 60 FPS on desktop | DEFERRED_LOCAL: the cloud has no GPU. The profile above shows simulation and draw calls are within budget |
| 30 FPS on a mid-range phone or under throttled emulation | Emulated in the cloud: 250 enemies, 4x CPU throttle, 30 FPS cap → p50 30.0, p95-low 29.9. Real phone: DEFERRED_LOCAL |

## If the local GPU run misses 60 FPS at 250 enemies

1. Profile with the Chrome DevTools Performance panel and `renderer.info` to separate GPU time from main-thread time.
2. Ground: the GAT mesh has one vertex per cell (about 320k triangles for a 400×400 map). Switch to the 200×200 GND grid or chunked LOD.
3. Billboards: reuse one `Matrix4` instead of allocating per instance, and upload only the dirty ranges.
4. Shadows: merge them into the enemy batch (a second quad per instance) to save a draw call.
5. Lower the render pixel ratio on high-DPI screens. Never reduce the simulation tick rate.

## Reproduce

```sh
pnpm build && node tools/e2e/bench.mjs && node tools/e2e/bench-report.mjs
# Real assets (local only):
pnpm assets:verify-sources && pnpm assets:extract --profile fan-local
VITE_ASSET_GATEWAY_URL=http://127.0.0.1:4178 pnpm build   # then run pnpm gateway in another terminal, then the bench
```
