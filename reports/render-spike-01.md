# Render spike 01 — Phase 1

Status: **cloud run with placeholder / synthetic assets only.** Real RO sprites, the real `prt_fild08`
and real devices are `DEFERRED_LOCAL`. Nothing here is a device measurement.

## Environment of this run

| Field | Value |
| --- | --- |
| Date | 2026-11-17T04:02:36.488Z |
| Build ID | `0.0.0+151c3d953247.20261117` |
| Machine | cloud Linux container, 4 vCPU, no GPU |
| Browser | headless Chromium (`HeadlessChrome/153.0.8010.12 Safari/537.36`) |
| WebGL | `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)` — **software rasteriser** |
| Assets | `placeholder` sprites (code-drawn), placeholder field 120×120 m |
| Quality | pixel ratio 1, nearest filtering, no post-processing |
| Seed | 20261117; the bench moves the player in a fixed 8-direction pattern |
| Duration | 8 s per run (first 5 frames discarded) |
| Transfer | 677,602 bytes (app shell only; no RO assets in the cloud) |

## Results (`reports/phase1/render-spike-01.cloud.json`)

| Run | Enemies | Viewport | CPU throttle | FPS cap | FPS p50 | FPS p95-low | Frame ms p95 | Tick ms p95 | Tick ms max | Draw calls | Triangles | JS heap MB | Texture MB (est.) | Dropped ticks | Load ms |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| desktop-50 | 50 | 1280x720 @1x | 1x | — | 59.9 | 30.0 | 33.3 | 0.200 | 0.38 | 4 | 29718 | 12.8 | 0.2 | 4 | 171 |
| desktop-100 | 100 | 1280x720 @1x | 1x | — | 59.9 | 29.9 | 33.4 | 0.200 | 1.40 | 4 | 30618 | 11.3 | 0.2 | 4 | 161 |
| desktop-250 | 250 | 1280x720 @1x | 1x | — | 30.0 | 29.9 | 33.4 | 0.300 | 2.05 | 4 | 33318 | 13.6 | 0.2 | 5 | 151 |
| desktop-500 | 500 | 1280x720 @1x | 1x | — | 29.9 | 20.0 | 50.0 | 0.600 | 2.94 | 4 | 37818 | 12.1 | 0.2 | 7 | 155 |
| throttled4x-fps30-250 | 250 | 390x844 @1x | 4x | 30 | 30.0 | 29.9 | 33.4 | 1.250 | 3.18 | 4 | 33318 | 14.5 | 0.2 | 19 | 457 |

Load ms = navigation start to the first simulated frame.

## Reading the numbers

- **The simulation is not the bottleneck.** Tick p95 is 0.60 ms with 500 enemies
  (budget: 4 ms desktop / 8 ms mobile) and 1.25 ms at 250 enemies under 4x CPU throttling.
  Headless Vitest also keeps 500 enemies under 16 ms p95 with no renderer.
- **Draw calls are constant (4)** at every enemy count: ground, instanced shadows, instanced enemies, player.
- **FPS in this container is limited by the software rasteriser** (SwiftShader, 4 vCPU): 50–100 enemies run at a
  60 FPS median, while 250–500 settle on the 30 FPS vsync step. This says nothing about real GPUs, so the
  60 FPS desktop / 30 FPS mobile gate must be measured on the user's machines.
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
