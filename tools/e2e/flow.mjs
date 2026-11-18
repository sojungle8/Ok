// Phase 2 browser flow checks on the TEST-FIXTURE build (synthetic sprites; never the formal screen).
// FLOW_DIST (default apps/client/dist-test). Writes reports/phase2/flow-*.json and screenshots.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const root = resolve(import.meta.dirname, "../..");
const dist = resolve(root, process.env.FLOW_DIST ?? "apps/client/dist-test");
let playwright;
try {
  playwright = createRequire(import.meta.url)("playwright");
} catch {
  const bundledRoot = resolve(dirname(process.execPath), "../node_modules");
  const globalRoot = process.env.PLAYWRIGHT_GLOBAL_ROOT
    ?? (existsSync(join(bundledRoot, "playwright")) ? bundledRoot : execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim());
  playwright = createRequire(join(globalRoot, "noop.js"))("playwright");
}
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const server = createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
  const file = normalize(join(dist, p === "/" ? "index.html" : p));
  if (!file.startsWith(dist)) return void res.writeHead(403).end();
  try {
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" }).end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/`;
const out = join(root, "reports/phase2");
mkdirSync(out, { recursive: true });
const browser = await playwright.chromium.launch({ args: ["--enable-unsafe-swiftshader"] });
const results = {};

async function enterRun(page, query) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${base}?${query}`);
  await page.getByTestId("start").click({ timeout: 20_000 });
  await page.getByTestId("job-swordsman").click();
  await page.getByTestId("stage-prt_fild08").click();
  await page.getByTestId("run-hud").waitFor({ timeout: 30_000 });
  // Synthetic sources are only ever shown with the explicit TEST FIXTURE banner.
  if ((await page.getByTestId("fixture-banner").count()) !== 1) throw new Error("TEST FIXTURE banner missing in the test-fixture build");
  return errors;
}

// A. Autoplay (bot) to results; settlement once; reload does not duplicate.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => {
    window.__resultPadA = false;
    navigator.getGamepads = () => [{ connected: true, axes: [0, 0], buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: i === 0 && window.__resultPadA === true, value: 0 })) }];
  });
  const page = await ctx.newPage();
  const errors = await enterRun(page, "autoplay=fury&speed=40&seed=3");
  const flowSeen = new Set();
  const t0 = Date.now();
  while (Date.now() - t0 < 420_000) {
    const s = await page.evaluate(() => window.__flow?.());
    flowSeen.add(s);
    if (s === "results") break;
    await page.waitForTimeout(500);
  }
  await page.getByTestId("results").waitFor({ timeout: 10_000 });
  await page.screenshot({ path: join(out, "flow-results.png") });
  const res = await page.evaluate(() => window.__results?.());
  const settledText = await page.getByTestId("settled").innerText();
  const resultSurface = {
    world: await page.getByTestId("world").count(),
    runHud: await page.getByTestId("run-hud").count(),
    joystick: await page.getByTestId("joystick").count(),
  };
  const count = () => page.evaluate(() => new Promise((ok) => {
    const r = indexedDB.open("ro-survivor");
    r.onsuccess = () => {
      const tx = r.result.transaction(["runResults", "pendingResults", "inventory"], "readonly");
      const c = {};
      let left = 3;
      for (const s of ["runResults", "pendingResults", "inventory"]) {
        const q = tx.objectStore(s).count();
        q.onsuccess = () => { c[s] = q.result; if (--left === 0) ok(c); };
      }
    };
  }));
  const before = await count();
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("data-testid"));
  await page.evaluate(() => { window.__resultPadA = true; });
  await page.waitForTimeout(200);
  await page.evaluate(() => { window.__resultPadA = false; });
  await page.getByTestId("stage-select").waitFor({ timeout: 10_000 });
  const afterContinue = await page.evaluate(() => window.__flow?.());
  await page.reload();
  await page.getByTestId("start").waitFor({ timeout: 20_000 });
  const after = await count();
  results.autoplay = { flowSeen: [...flowSeen], outcome: res?.result.outcome, applied: res?.applied, settledText, resultSurface, focused, continueInput: "gamepad-a", afterContinue, before, after, errors,
    pass: res?.applied === true && resultSurface.world === 1 && resultSurface.runHud === 0 && resultSurface.joystick === 0 && focused === "continue" && afterContinue === "stage-select" && before.runResults === 1 && JSON.stringify(before) === JSON.stringify(after) && errors.length === 0 };
  await ctx.close();
}

// B. Manual drafts: number key, touch tap, gamepad (stubbed Gamepad API), keystone confirm; keyboard movement.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => {
    window.__padA = false;
    navigator.getGamepads = () => [{ connected: true, axes: [0, 0], buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: i === 0 && window.__padA === true, value: 0 })) }];
  });
  const page = await ctx.newPage();
  const errors = await enterRun(page, "autoplay=guardian&manualDraft=1&seed=4");
  const picks = [];
  const waitDraft = async () => {
    await page.locator("[data-testid=draft], [data-testid=keystone-confirm]").first().waitFor({ timeout: 120_000 });
    return (await page.getByTestId("keystone-confirm").count()) > 0 ? "confirm" : "draft";
  };
  const level = () => page.evaluate(() => window.__run?.()?.player.active.length + window.__run?.()?.player.passive.length + window.__run?.()?.player.basicRank);
  for (const method of ["key", "touch", "gamepad"]) {
    let kind = await waitDraft();
    while (kind === "confirm") {
      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);
      kind = await waitDraft();
    }
    if (method === "draft-shot") break;
    if (picks.length === 0) await page.screenshot({ path: join(out, "flow-draft-mobile.png") });
    const before = await level();
    if (method === "key") await page.keyboard.press("1");
    else if (method === "touch") await page.getByTestId("option-1").tap();
    else {
      await page.evaluate(() => { window.__padA = true; });
      await page.waitForTimeout(200);
      await page.evaluate(() => { window.__padA = false; });
    }
    await page.waitForFunction(() => window.__run?.()?.phase !== "draft", null, { timeout: 5000 }).catch(() => undefined);
    const after = await level();
    picks.push({ method, applied: after > before || (await page.evaluate(() => window.__run?.()?.player.keystone)) !== null });
  }
  results.manual = { picks, errors, pass: picks.every((p) => p.applied) && errors.length === 0 };
  await ctx.close();
}

// C. Keyboard movement without the bot.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = await enterRun(page, "seed=5");
  const x0 = await page.evaluate(() => window.__run?.()?.player.x);
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(800);
  await page.keyboard.up("KeyD");
  const x1 = await page.evaluate(() => window.__run?.()?.player.x);
  await page.keyboard.press("KeyG");
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(out, "flow-running-desktop.png") });
  results.keyboard = { x0, x1, errors, pass: x1 > x0 && errors.length === 0 };
  await ctx.close();
}
await browser.close();
server.close();
writeFileSync(join(out, "flow-results.json"), JSON.stringify(results, null, 2) + "\n");
console.log(JSON.stringify(results, null, 1));
if (!Object.values(results).every((r) => r.pass)) process.exitCode = 1;
