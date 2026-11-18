// Browser smoke check of one built client (headless Chromium via the preinstalled Playwright).
// SMOKE_DIST     dist directory (default apps/client/dist)
// SMOKE_EXPECT   "blocked" (formal build without RO assets) or "running" (test-fixture build)
// SMOKE_REASON   substring expected in the blocked reason
// SMOKE_TAG      screenshot name tag; SMOKE_DEBUG_OVERLAY=1 toggles the GAT overlay before the shot
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const root = resolve(import.meta.dirname, "../..");
const dist = resolve(root, process.env.SMOKE_DIST ?? "apps/client/dist");
const expect = process.env.SMOKE_EXPECT ?? "blocked";
const tag = process.env.SMOKE_TAG ?? "";
if (!existsSync(join(dist, "index.html"))) {
  console.error(`smoke: ${dist} has no build`);
  process.exit(2);
}
let playwright;
try {
  playwright = createRequire(import.meta.url)("playwright");
} catch {
  const bundledRoot = resolve(dirname(process.execPath), "../node_modules");
  const globalRoot = process.env.PLAYWRIGHT_GLOBAL_ROOT
    ?? (existsSync(join(bundledRoot, "playwright")) ? bundledRoot : execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim());
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
      const buildId = (await page.getByTestId("build-id").innerText()).trim();
      const profile = (await page.getByTestId("build-profile").innerText()).trim();
      const title = (await page.getByTestId("project-name").innerText()).trim();
      let ok = title === "RO Survivor Fan Game" && profile === "fan-local" && /\+[0-9a-f]{12}\.\d{8}$|^ci-/.test(buildId);
      const detail = {};
      if (expect === "blocked") {
        await page.getByTestId("start").click({ timeout: 15_000 });
        await page.getByTestId("job-swordsman").click();
        await page.getByTestId("stage-prt_fild08").click();
        await page.getByTestId("blocked").waitFor({ timeout: 15_000 });
        detail.reason = (await page.getByTestId("blocked-reason").innerText()).trim();
        detail.worldCanvas = await page.getByTestId("world").count();
        detail.missingRows = await page.locator("[data-testid=missing-assets] tbody tr").count();
        ok = ok && detail.worldCanvas === 0 && (!process.env.SMOKE_REASON || detail.reason.includes(process.env.SMOKE_REASON));
      } else {
        await page.getByTestId("sim-stats").filter({ hasText: "FPS" }).waitFor({ timeout: 20_000 });
        detail.fixtureBanner = await page.getByTestId("fixture-banner").count();
        const p0 = await page.evaluate(() => window.__arena.player());
        await page.keyboard.down("KeyD");
        await page.waitForTimeout(700);
        await page.keyboard.up("KeyD");
        const p1 = await page.evaluate(() => window.__arena.player());
        const stick = await page.getByTestId("joystick").boundingBox();
        await page.mouse.move(stick.x + stick.width / 2, stick.y + stick.height / 2);
        await page.mouse.down();
        await page.mouse.move(stick.x + stick.width / 2, stick.y - 10, { steps: 4 });
        await page.waitForTimeout(700);
        await page.mouse.up();
        const p2 = await page.evaluate(() => window.__arena.player());
        detail.input = { keyboardEast: p1.x > p0.x, joystickNorth: p2.y > p1.y, facingAfterStick: p2.dir };
        if (process.env.SMOKE_DEBUG_OVERLAY) await page.keyboard.press("KeyG");
        await page.waitForTimeout(800);
        ok = ok && detail.fixtureBanner === 1 && detail.input.keyboardEast && detail.input.joystickNorth;
      }
      ok = ok && errors.length === 0;
      const shot = join(outDir, `smoke${tag}-${browser.browserType().name()}-${viewport.tag}.png`);
      await page.screenshot({ path: shot, fullPage: true });
      results.push({ browser: `${browser.browserType().name()} ${browser.version()}`, viewport: viewport.tag, expect, status: ok ? "PASS" : "FAIL", buildId, profile, ...detail, errors, screenshot: shot.slice(root.length + 1) });
      await page.close();
    }
  } finally {
    await browser.close();
  }
}
server.close();
console.log(JSON.stringify(results, null, 2));
if (results.some((r) => r.status === "FAIL") || !results.some((r) => r.status === "PASS")) process.exitCode = 1;
