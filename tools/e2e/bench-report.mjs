// Render reports/render-spike-01.md from reports/phase1/render-spike-01.cloud.json.
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const d = JSON.parse(readFileSync(join(root, "reports/phase1/render-spike-01.cloud.json"), "utf8"));
const R = Object.fromEntries(d.results.map((r) => [r.label, r]));
const r0 = d.results[0];
const f = (n, k = 1) => Number(n).toFixed(k);
const rows = d.results.map((r) =>
  `| ${r.label} | ${r.enemies} | ${r.viewport} @${r.pixelRatio}x | ${r.cpuThrottle}x | ${r.fpsCap ?? "—"} | ${f(r.fpsP50)} | ${f(r.fpsP95Low)} | ${f(r.frameMsP95)} | ${f(r.tickMsP95, 3)} | ${f(r.tickMsMax, 2)} | ${r.drawCalls} | ${r.triangles} | ${r.jsHeapMb} | ${r.textureMbEstimate} | ${r.droppedTicks} | ${r.loadMs} |`,
);
const md = `# Render spike 01 — Phase 1

Status: **cloud run with synthetic test fixtures only (automated test build).** Real RO sprites, the real \`prt_fild08\`
and real devices are \`DEFERRED_LOCAL\`. Nothing here is a device measurement.

## Environment of this run

| Field | Value |
| --- | --- |
| Date | ${d.at} |
| Build ID | \`${r0.buildId}\` |
| Machine | cloud Linux container, 4 vCPU, no GPU |
| Browser | headless Chromium (\`${r0.userAgent.split(") ").pop()}\`) |
| WebGL | \`${r0.webglRenderer}\` — **software rasteriser** |
| Assets | \`${r0.assetSource}\`: SYNTHETIC test fixtures served to the separate test build (synthetic 64×64 GAT map). Formal builds refuse them |
| Quality | pixel ratio 1, nearest filtering, no post-processing |
| Seed | 20261117; the bench moves the player in a fixed 8-direction pattern |
| Duration | ${r0.seconds} s per run (first 5 frames discarded) |
| Transfer | ${r0.transferBytes.toLocaleString("en-US")} bytes (app shell only; no RO assets in the cloud) |

## Results (\`reports/phase1/render-spike-01.cloud.json\`)

| Run | Enemies | Viewport | CPU throttle | FPS cap | FPS p50 | FPS p95-low | Frame ms p95 | Tick ms p95 | Tick ms max | Draw calls | Triangles | JS heap MB | Texture MB (est.) | Dropped ticks | Load ms |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${rows.join("\n")}

Load ms = navigation start to the first simulated frame.

## Reading the numbers

- **The simulation is not the bottleneck.** Tick p95 is ${f(R["desktop-500"].tickMsP95, 2)} ms with 500 enemies
  (budget: 4 ms desktop / 8 ms mobile) and ${f(R["throttled4x-fps30-250"].tickMsP95, 2)} ms at 250 enemies under 4x CPU throttling.
  Headless Vitest also keeps 500 enemies under 16 ms p95 with no renderer.
- **Draw calls are constant (${r0.drawCalls})** at every enemy count: ground, instanced enemies, player (no engine-drawn shadows, GAP-003).
- **FPS in this container is limited by the software rasteriser** (SwiftShader, 4 vCPU): median FPS
  ${d.results.filter((r) => r.cpuThrottle === 1).map((r) => `${r.enemies} → ${f(r.fpsP50)}`).join(", ")}; the p95-low values sit on 30/20 FPS
  vsync steps. This says nothing about real GPUs, so the 60 FPS desktop / 30 FPS mobile gate must be measured
  on the user's machines with real RO assets.
- **Dropped ticks** come from the 5-tick catch-up cap on long frames (start-up and throttled hitches). Game time
  then runs slower than wall time; the result for the same input stream is unchanged (15/30/60 FPS hash tests).
- Mirrored directions reuse atlas pixels through a per-instance UV flip; no second texture is created
  (the extractor test checks that every \`flipX\` frame shares its rectangle with an unflipped one).

## Phase 1 performance gate

| Gate | Status |
| --- | --- |
| 250 enemies at 60 FPS on desktop | DEFERRED_LOCAL: the cloud has no GPU. The profile above shows simulation and draw calls are within budget |
| 30 FPS on a mid-range phone or under throttled emulation | Emulated in the cloud: 250 enemies, 4x CPU throttle, 30 FPS cap → p50 ${f(R["throttled4x-fps30-250"].fpsP50)}, p95-low ${f(R["throttled4x-fps30-250"].fpsP95Low)}. Real phone: DEFERRED_LOCAL |

## If the local GPU run misses 60 FPS at 250 enemies

1. Profile with the Chrome DevTools Performance panel and \`renderer.info\` to separate GPU time from main-thread time.
2. Ground: the GAT mesh has one vertex per cell (about 320k triangles for a 400×400 map). Switch to the 200×200 GND grid or chunked LOD.
3. Billboards: reuse one \`Matrix4\` instead of allocating per instance, and upload only the dirty ranges.
4. Shadows: merge them into the enemy batch (a second quad per instance) to save a draw call.
5. Lower the render pixel ratio on high-DPI screens. Never reduce the simulation tick rate.

## Reproduce

\`\`\`sh
pnpm build && node tools/e2e/bench.mjs && node tools/e2e/bench-report.mjs
# Real assets (local only):
pnpm assets:verify-sources && pnpm assets:extract --profile fan-local
VITE_ASSET_GATEWAY_URL=http://127.0.0.1:4178 pnpm build   # then run pnpm gateway in another terminal, then the bench
\`\`\`
`;
writeFileSync(join(root, "reports/render-spike-01.md"), md);
console.log("wrote reports/render-spike-01.md");
