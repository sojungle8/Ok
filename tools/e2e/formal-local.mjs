// Local-only positive-path browser gate for the real fan-local RO source lock and derived assets.
// It never uploads or copies RO binaries: the formal build talks only to the loopback gateway and
// screenshots / machine data stay under ignored reports/local/.
import { execFileSync, spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, extname, join, normalize, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const node24 = process.env.NODE24 ?? process.execPath;
const pnpmCli = process.env.npm_execpath;
const gatewayPort = Number(process.env.FORMAL_GATEWAY_PORT ?? 4180);
const dist = join(root, "apps/client/dist-formal-local");
const out = join(root, "reports/local/formal-positive");

if (!existsSync(join(root, "assets/source-lock.local.json"))) {
  console.error("formal-local: assets/source-lock.local.json is missing; run pnpm assets:verify-sources first");
  process.exit(2);
}
if (!Number.isInteger(gatewayPort) || gatewayPort < 1024 || gatewayPort > 65535) {
  console.error(`formal-local: invalid FORMAL_GATEWAY_PORT ${String(gatewayPort)}`);
  process.exit(2);
}

const runPnpm = (args, env = {}) => {
  if (pnpmCli) return execFileSync(node24, [pnpmCli, ...args], { cwd: root, stdio: "inherit", env: { ...process.env, ...env } });
  return execFileSync("pnpm", args, { cwd: root, stdio: "inherit", env: { ...process.env, ...env } });
};

let playwright;
try {
  playwright = createRequire(import.meta.url)("playwright");
} catch {
  const bundledRoot = resolve(dirname(process.execPath), "../node_modules");
  const globalRoot = process.env.PLAYWRIGHT_GLOBAL_ROOT
    ?? (existsSync(join(bundledRoot, "playwright")) ? bundledRoot : execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim());
  playwright = createRequire(join(globalRoot, "noop.js"))("playwright");
}

const gatewayUrl = `http://127.0.0.1:${gatewayPort}`;
const gateway = spawn(node24, ["apps/asset-gateway/src/main.ts"], {
  cwd: root,
  env: { ...process.env, RO_ASSET_GATEWAY_PORT: String(gatewayPort) },
  stdio: ["ignore", "pipe", "pipe"],
});
let gatewayLog = "";
gateway.stderr.on("data", (data) => { gatewayLog += data.toString(); });

async function waitForGateway() {
  await new Promise((resolveReady, reject) => {
    const timer = setTimeout(() => reject(new Error(`real asset gateway did not start: ${gatewayLog.trim()}`)), 30_000);
    gateway.stdout.on("data", (data) => {
      gatewayLog += data.toString();
      if (!gatewayLog.includes("listening on")) return;
      clearTimeout(timer);
      resolveReady();
    });
    gateway.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`real asset gateway exited with code ${String(code)}: ${gatewayLog.trim()}`));
    });
  });
}

const contentTypes = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
};

function makeStaticServer() {
  return createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
    const file = normalize(join(dist, path === "/" ? "index.html" : path));
    if (!file.startsWith(dist)) return void res.writeHead(403).end();
    try {
      res.writeHead(200, { "content-type": contentTypes[extname(file)] ?? "application/octet-stream" }).end(await readFile(file));
    } catch {
      res.writeHead(404).end();
    }
  });
}

const viewports = [
  { tag: "desktop", width: 1280, height: 800, touch: false },
  { tag: "phone-portrait", width: 390, height: 844, touch: true },
  { tag: "tablet-portrait", width: 768, height: 1024, touch: true },
  { tag: "phone-landscape", width: 844, height: 390, touch: true },
];

async function dragTouch(context, page, box) {
  const session = await context.newCDPSession(page);
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const to = { x: box.x + box.width - 8, y: from.y };
  const point = (x, y) => ({ x, y, id: 1, radiusX: 8, radiusY: 8, force: 1 });
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point(from.x, from.y)] });
  for (let step = 1; step <= 5; step += 1) {
    const x = from.x + (to.x - from.x) * step / 5;
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point(x, to.y)] });
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(300);
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await session.detach();
}

let server;
let browser;
const results = [];
try {
  await waitForGateway();
  runPnpm(["--filter", "@ro-survivor/client", "exec", "vite", "build", "--outDir", "dist-formal-local"], {
    VITE_ASSET_GATEWAY_URL: gatewayUrl,
  });
  if (!existsSync(join(dist, "index.html"))) throw new Error("formal build did not produce apps/client/dist-formal-local/index.html");
  server = makeStaticServer();
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const base = `http://127.0.0.1:${server.address().port}/`;
  mkdirSync(out, { recursive: true });
  browser = await playwright.chromium.launch({ args: ["--enable-unsafe-swiftshader"] });

  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.touch ? 2 : 1,
      hasTouch: viewport.touch,
      isMobile: viewport.touch,
    });
    const page = await context.newPage();
    const errors = [];
    let canceledRequests = 0;
    page.on("pageerror", (error) => errors.push(`pageerror: ${String(error)}`));
    page.on("requestfailed", (request) => {
      const reason = request.failure()?.errorText ?? "";
      // Chromium reports fetches canceled by our screen-transition AbortControllers as ERR_ABORTED.
      // Keep the count as diagnostics, but fail only on genuine transport errors.
      if (reason === "net::ERR_ABORTED") canceledRequests += 1;
      else errors.push(`requestfailed: ${request.method()} ${request.url()} ${reason}`);
    });
    await page.goto(`${base}?seed=17`, { waitUntil: "domcontentloaded" });
    const buildId = (await page.locator("main.app").getAttribute("data-build-id")) ?? "unknown";
    const shellLayouts = [];
    const captureShell = async (testId, name) => {
      const shell = page.locator(`[data-testid="${testId}"][data-ro-shell="original-ro-raster"]`);
      await shell.waitFor({ timeout: 60_000 });
      const evidence = await shell.evaluate((element) => {
        const r = element.getBoundingClientRect();
        return {
          originalRoRaster: element.getAttribute("data-ro-shell") === "original-ro-raster",
          box: { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
          inside: r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1,
          noPageOverflow: document.documentElement.scrollWidth <= innerWidth + 1 && document.documentElement.scrollHeight <= innerHeight + 1,
        };
      });
      const screenshot = join(out, `formal-${viewport.tag}-${name}.png`);
      await page.screenshot({ path: screenshot });
      shellLayouts.push({ screen: name, ...evidence, screenshot: screenshot.slice(root.length + 1) });
    };
    await captureShell("title", "title");
    await page.getByTestId("start").click({ timeout: 60_000 });
    await captureShell("character-select", "character-select");
    await page.getByTestId("job-swordsman").click();
    await captureShell("stage-select", "stage-select");
    await page.getByTestId("stage-prt_fild08").click();
    await page.getByTestId("world").waitFor({ timeout: 60_000 });
    await page.getByTestId("run-hud").waitFor({ timeout: 60_000 });
    await page.waitForFunction(() => window.__run?.()?.phase === "running", null, { timeout: 20_000 });
    const audioGate = page.getByTestId("audio-gate");
    if (await audioGate.count()) await audioGate.click();
    await page.waitForFunction(() => document.querySelector("main.app")?.getAttribute("data-audio-state") === "started", null, { timeout: 10_000 });
    const audioStarted = (await page.locator("main.app").getAttribute("data-audio-state")) === "started";

    const before = await page.evaluate(() => ({ x: window.__run?.()?.player.x, y: window.__run?.()?.player.y }));
    if (viewport.touch) {
      const stick = await page.getByTestId("joystick").boundingBox();
      if (!stick) throw new Error(`${viewport.tag}: joystick has no bounding box`);
      await dragTouch(context, page, stick);
    } else {
      await page.keyboard.down("KeyD");
      await page.waitForTimeout(700);
      await page.keyboard.up("KeyD");
    }
    const after = await page.evaluate(() => ({ x: window.__run?.()?.player.x, y: window.__run?.()?.player.y }));
    const moved = typeof before.x === "number" && typeof after.x === "number" && (after.x !== before.x || after.y !== before.y);

    const draft = page.locator("[data-testid=draft], [data-testid=keystone-confirm]").first();
    await draft.waitFor({ timeout: 45_000 });
    const draftLayout = await page.evaluate(() => {
      const elements = [...document.querySelectorAll('[data-testid="draft"], [data-testid="keystone-confirm"], [data-testid^="option-"]')];
      const boxes = elements.map((element) => {
        const r = element.getBoundingClientRect();
        return { id: element.getAttribute("data-testid"), left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      });
      const optionBoxes = boxes.filter((box) => box.id?.startsWith("option-"));
      const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      const overlapPairs = [];
      for (let i = 0; i < optionBoxes.length; i += 1) {
        for (let j = i + 1; j < optionBoxes.length; j += 1) {
          if (overlaps(optionBoxes[i], optionBoxes[j])) overlapPairs.push([optionBoxes[i].id, optionBoxes[j].id]);
        }
      }
      return {
        boxes,
        overlapPairs,
        inside: boxes.length >= 2 && boxes.every((r) => r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1),
        noPageOverflow: document.documentElement.scrollWidth <= innerWidth + 1 && document.documentElement.scrollHeight <= innerHeight + 1,
      };
    });
    const draftScreenshot = join(out, `formal-${viewport.tag}-draft.png`);
    await page.screenshot({ path: draftScreenshot });
    if (await page.getByTestId("keystone-confirm").count()) await page.getByTestId("confirm").click();
    else await page.getByTestId("option-0").click();
    await page.waitForFunction(() => window.__run?.()?.phase === "running", null, { timeout: 10_000 });
    await page.waitForTimeout(1800);

    const surface = {
      world: await page.getByTestId("world").count(),
      hud: await page.getByTestId("run-hud").count(),
      shortcut: await page.getByTestId("ro-shortcut").count(),
      minimap: await page.getByTestId("ro-minimap").count(),
      basicInfo: await page.getByTestId("ro-basic-info").count(),
      timer: await page.getByTestId("timer").count(),
      damageStats: await page.getByTestId("damage-stats").count(),
      rightRail: await page.getByTestId("ro-right-rail").count(),
      joystick: await page.getByTestId("joystick").count(),
      fixtureBanner: await page.getByTestId("fixture-banner").count(),
    };
    const layout = await page.evaluate(() => {
      const ids = ["run-hud", "ro-basic-info", "timer", "damage-stats", "ro-right-rail", "ro-shortcut", "ro-minimap", "joystick"];
      const boxes = Object.fromEntries(ids.map((id) => {
        const element = document.querySelector(`[data-testid="${id}"]`);
        const r = element?.getBoundingClientRect();
        return [id, r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null];
      }));
      const inside = Object.values(boxes).every((r) => r === null || (r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1));
      const overlaps = (a, b) => a !== null && b !== null && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      const disjointPairs = [["ro-basic-info", "timer"], ["ro-basic-info", "ro-right-rail"], ["timer", "ro-right-rail"], ["ro-basic-info", "ro-shortcut"], ["ro-right-rail", "ro-shortcut"], ["joystick", "ro-shortcut"]];
      const overlapPairs = disjointPairs.filter(([a, b]) => overlaps(boxes[a], boxes[b]));
      return {
        boxes,
        inside,
        overlapPairs,
        noPageOverflow: document.documentElement.scrollWidth <= innerWidth + 1 && document.documentElement.scrollHeight <= innerHeight + 1,
      };
    });
    const screenshot = join(out, `formal-${viewport.tag}.png`);
    await page.screenshot({ path: screenshot });
    const pass = moved
      && audioStarted
      && surface.world === 1
      && surface.hud === 1
      && surface.shortcut === 1
      && surface.minimap === 1
      && surface.basicInfo === 1
      && surface.timer === 1
      && surface.damageStats === 1
      && surface.rightRail === 1
      && surface.joystick === 1
      && surface.fixtureBanner === 0
      && shellLayouts.length === 3
      && shellLayouts.every((entry) => entry.originalRoRaster && entry.inside && entry.noPageOverflow)
      && draftLayout.inside
      && draftLayout.overlapPairs.length === 0
      && draftLayout.noPageOverflow
      && layout.inside
      && layout.overlapPairs.length === 0
      && layout.noPageOverflow
      && errors.length === 0;
    results.push({ viewport: viewport.tag, size: `${viewport.width}x${viewport.height}`, buildId, moved, audioStarted, shellLayouts, surface, draftLayout, layout, canceledRequests, errors, draftScreenshot: draftScreenshot.slice(root.length + 1), screenshot: screenshot.slice(root.length + 1), status: pass ? "PASS" : "FAIL" });
    await context.close();
  }
} finally {
  if (browser) await browser.close();
  if (server) await new Promise((resolveClose) => server.close(resolveClose));
  if (gateway.exitCode === null) {
    gateway.kill();
    await new Promise((resolveClose) => {
      const timer = setTimeout(resolveClose, 5_000);
      gateway.once("close", () => { clearTimeout(timer); resolveClose(); });
    });
  }
}

mkdirSync(out, { recursive: true });
writeFileSync(join(out, "formal-positive.json"), JSON.stringify({ sourceLock: JSON.parse(readFileSync(join(root, "assets/source-lock.local.json"), "utf8")).lockId, results }, null, 2) + "\n");
console.log(JSON.stringify(results, null, 2));
if (results.length !== viewports.length || results.some((result) => result.status !== "PASS")) process.exitCode = 1;
