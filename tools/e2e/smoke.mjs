// Placeholder-site smoke test: serves apps/client/dist on 127.0.0.1 and checks the
// project name, profile, build ID and gateway status in Chromium (and WebKit if installed).
// Uses the machine's preinstalled Playwright; it is intentionally not a project dependency.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join, normalize, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const root = resolve(import.meta.dirname, "../..");
const dist = join(root, "apps/client/dist");
if (!existsSync(join(dist, "index.html"))) {
  console.error("e2e:smoke: run `pnpm build` first");
  process.exit(2);
}
let playwright;
try {
  playwright = createRequire(import.meta.url)("playwright");
} catch {
  const globalRoot = execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
  playwright = createRequire(join(globalRoot, "noop.js"))("playwright");
}
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };
const server = createServer(async (req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
  const file = normalize(join(dist, urlPath === "/" ? "index.html" : urlPath));
  if (!file.startsWith(dist)) return void res.writeHead(403).end();
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" }).end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/`;
const outDir = join(root, process.env.SMOKE_OUT ?? "reports/phase1");
const expectMode = process.env.SMOKE_EXPECT_MODE ?? "placeholder";
const tag = process.env.SMOKE_TAG ?? "";
mkdirSync(outDir, { recursive: true });

const results = [];
for (const name of ["chromium", "webkit"]) {
  let browser;
  try {
    browser = await playwright[name].launch();
  } catch (err) {
    results.push({ browser: name, status: "NOT_RUN", detail: String(err).split("\n")[0] });
    continue;
  }
  try {
    for (const viewport of [{ width: 1280, height: 800, tag: "desktop" }, { width: 390, height: 844, tag: "mobile" }]) {
      const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(url);
      await page.getByTestId("gateway-status").filter({ hasText: `mode=${expectMode}` }).waitFor({ timeout: 15_000 });
      await page.getByTestId("sim-stats").filter({ hasText: "FPS" }).waitFor({ timeout: 15_000 });
      if (process.env.SMOKE_DEBUG_OVERLAY) await page.keyboard.press("KeyG");
      await page.waitForTimeout(1500);
      const buildId = (await page.getByTestId("build-id").innerText()).trim();
      const profile = (await page.getByTestId("build-profile").innerText()).trim();
      const name = (await page.getByTestId("project-name").innerText()).trim();
      const ok = name === "RO Survivor Fan Game" && profile === "fan-local" && /\+[0-9a-f]{12}\.\d{8}$|^ci-/.test(buildId) && errors.length === 0;
      const shot = join(outDir, `smoke${tag}-${browserName(browser)}-${viewport.tag}.png`);
      await page.screenshot({ path: shot, fullPage: true });
      results.push({ browser: `${browserName(browser)} ${browser.version()}`, viewport: viewport.tag, status: ok ? "PASS" : "FAIL", buildId, profile, errors, screenshot: shot.slice(root.length + 1) });
      await page.close();
    }
  } finally {
    await browser.close();
  }
}
function browserName(b) {
  return b.browserType().name();
}
server.close();
console.log(JSON.stringify(results, null, 2));
if (results.some((r) => r.status === "FAIL") || !results.some((r) => r.status === "PASS")) process.exitCode = 1;
