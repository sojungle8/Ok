// Render spike bench: serves apps/client/dist on 127.0.0.1 and runs ?bench=N for N in 50/100/250/500
// in headless Chromium (preinstalled Playwright), plus a 4x CPU-throttled 30 FPS-capped run at 250.
// Results are CLOUD numbers (software WebGL in a container), not device measurements.
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join, normalize, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const root = resolve(import.meta.dirname, "../..");
const dist = join(root, "apps/client/dist");
if (!existsSync(join(dist, "index.html"))) {
  console.error("bench: run `pnpm build` first");
  process.exit(2);
}
let playwright;
try {
  playwright = createRequire(import.meta.url)("playwright");
} catch {
  const globalRoot = execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
  playwright = createRequire(join(globalRoot, "noop.js"))("playwright");
}
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
let bytesServed = 0;
const server = createServer(async (req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
  const file = normalize(join(dist, urlPath === "/" ? "index.html" : urlPath));
  if (!file.startsWith(dist)) return void res.writeHead(403).end();
  try {
    const body = await readFile(file);
    bytesServed += body.length;
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" }).end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/`;
const seconds = Number(process.env.BENCH_SECONDS ?? 8);
const browser = await playwright.chromium.launch({ args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const runs = [
  ...[50, 100, 250, 500].map((n) => ({ label: `desktop-${n}`, enemies: n, viewport: { width: 1280, height: 720 }, throttle: 1, fps: null })),
  { label: "throttled4x-fps30-250", enemies: 250, viewport: { width: 390, height: 844 }, throttle: 4, fps: 30 },
];
const results = [];
for (const run of runs) {
  const page = await browser.newPage({ viewport: run.viewport, deviceScaleFactor: 1 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: run.throttle });
  const gl = await page.evaluate(() => {
    const c = document.createElement("canvas").getContext("webgl2");
    const ext = c?.getExtension("WEBGL_debug_renderer_info");
    return c ? (ext ? c.getParameter(ext.UNMASKED_RENDERER_WEBGL) : c.getParameter(c.RENDERER)) : "no webgl2";
  }).catch(() => "unknown");
  bytesServed = 0;
  const t0 = Date.now();
  await page.goto(`${base}?bench=${run.enemies}&seconds=${seconds}${run.fps ? `&fps=${run.fps}` : ""}`);
  await page.waitForFunction(() => window.__bench !== undefined, null, { timeout: (seconds + 60) * 1000 });
  const r = await page.evaluate(() => window.__bench);
  results.push({ label: run.label, cpuThrottle: run.throttle, fpsCap: run.fps, webglRenderer: gl, wallMs: Date.now() - t0, transferBytes: bytesServed, ...r });
  console.log(`${run.label}: fps p50 ${r.fpsP50.toFixed(1)} / p95-low ${r.fpsP95Low.toFixed(1)}, tick p95 ${r.tickMsP95.toFixed(3)} ms max ${r.tickMsMax.toFixed(2)}, draws ${r.drawCalls}, heap ${r.jsHeapMb} MB`);
  await page.close();
}
await browser.close();
server.close();
const out = join(root, "reports/phase1");
await mkdir(out, { recursive: true });
await writeFile(join(out, "render-spike-01.cloud.json"), JSON.stringify({ at: new Date().toISOString(), environment: "cloud container, headless Chromium, software WebGL (SwiftShader)", results }, null, 2) + "\n");
console.log("wrote reports/phase1/render-spike-01.cloud.json");
