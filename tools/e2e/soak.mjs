// G. Three consecutive autoplay runs on the test-fixture build (Phase 3.2.6): at each results screen
// record GPU resource counters of the live renderer and the JS heap after a forced GC. Fails when
// GPU counters differ between runs or the heap keeps climbing run over run.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const root = resolve(import.meta.dirname, "../..");
const dist = resolve(root, process.env.SOAK_DIST ?? "apps/client/dist-test");
const RUNS = Number(process.env.SOAK_RUNS ?? 3);
let playwright;
try {
  playwright = createRequire(import.meta.url)("playwright");
} catch {
  const bundledRoot = resolve(dirname(process.execPath), "../node_modules");
  const globalRoot = process.env.PLAYWRIGHT_GLOBAL_ROOT
    ?? (existsSync(join(bundledRoot, "playwright")) ? bundledRoot : execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim());
  playwright = createRequire(join(globalRoot, "noop.js"))("playwright");
}
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".webmanifest": "application/manifest+json" };
const server = createServer(async (req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
  const file = normalize(join(dist, urlPath === "/" ? "index.html" : urlPath));
  if (!file.startsWith(dist)) return void res.writeHead(403).end();
  try {
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" }).end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await playwright.chromium.launch({ args: ["--enable-unsafe-swiftshader", "--js-flags=--expose-gc"] });
const samples = [];
const errors = [];
let status;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${base}?autoplay=guardian&speed=40&seed=5`);
  await page.getByTestId("start").click({ timeout: 20_000 });
  await page.getByTestId("job-swordsman").click();
  for (let run = 1; run <= RUNS; run += 1) {
    await page.getByTestId("stage-prt_fild08").click({ timeout: 20_000 });
    await page.getByTestId("run-hud").waitFor({ timeout: 30_000 });
    await page.getByTestId("results").waitFor({ timeout: 420_000 });
    await page.waitForTimeout(300);
    const sample = await page.evaluate(() => {
      window.gc?.();
      const mem = performance.memory;
      return { render: window.__renderInfo?.() ?? null, heapMb: mem ? Math.round((mem.usedJSHeapSize / 1048576) * 10) / 10 : null, outcome: window.__results?.()?.result.outcome ?? null };
    });
    samples.push({ run, ...sample });
    await page.getByTestId("continue").click({ timeout: 10_000 });
    await page.getByTestId("stage-select").waitFor({ timeout: 10_000 });
  }
  const gpu = samples.map((s) => s.render && `${s.render.geometries}/${s.render.textures}/${s.render.programs}`);
  const heaps = samples.map((s) => s.heapMb ?? 0);
  const stableGpu = gpu.every((g) => g !== null && g === gpu[0]);
  const monotonicGrowth = heaps.every((h, i) => i === 0 || h > (heaps[i - 1] ?? 0) + 2);
  const heapGrowthMb = Math.round(((heaps.at(-1) ?? 0) - (heaps[0] ?? 0)) * 10) / 10;
  status = samples.length === RUNS && stableGpu && !monotonicGrowth && heapGrowthMb < 16 && errors.length === 0 ? "PASS" : "FAIL";
  const report = { status, runs: RUNS, samples, stableGpu, heapGrowthMb, monotonicGrowth, errors };
  mkdirSync(join(root, "reports/phase3"), { recursive: true });
  writeFileSync(join(root, "reports/phase3/soak-three-runs.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 1));
} finally {
  await browser.close();
  server.close();
}
if (status !== "PASS") process.exitCode = 1;
