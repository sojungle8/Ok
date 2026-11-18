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
  const npmCli = [
    join(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"),
    resolve(dirname(process.execPath), "../lib/node_modules/npm/bin/npm-cli.js"),
    resolve(dirname(process.execPath), "../node_modules/npm/bin/npm-cli.js"),
  ].find((candidate) => existsSync(candidate));
  const npmGlobalRoot = () => {
    if (!npmCli) {
      throw new Error("formal-local: cannot locate npm-cli.js; set PLAYWRIGHT_GLOBAL_ROOT to the directory containing playwright");
    }
    return execFileSync(node24, [npmCli, "root", "-g"], { encoding: "utf8" }).trim();
  };
  const globalRoot = process.env.PLAYWRIGHT_GLOBAL_ROOT
    ?? (existsSync(join(bundledRoot, "playwright")) ? bundledRoot : npmGlobalRoot());
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
const mobileControlAssetIds = ["ui.arrow.up", "ui.arrow.right", "ui.arrow.down", "ui.arrow.left"];

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
      let actorPreview = null;
      if (name === "character-select") {
        const actor = page.getByTestId("swordsman-actor-preview");
        await actor.waitFor({ timeout: 60_000 });
        const firstFrame = await actor.getAttribute("data-ro-frame");
        await page.waitForFunction((frame) => document.querySelector('[data-testid="swordsman-actor-preview"]')?.getAttribute("data-ro-frame") !== frame, firstFrame, { timeout: 3_000 });
        actorPreview = {
          count: await actor.count(),
          source: await actor.getAttribute("data-ro-source"),
          kind: await actor.getAttribute("data-ro-actor"),
          firstFrame,
          nextFrame: await actor.getAttribute("data-ro-frame"),
        };
      }
      await page.screenshot({ path: screenshot });
      shellLayouts.push({ screen: name, ...evidence, actorPreview, screenshot: screenshot.slice(root.length + 1) });
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

    const mobileControl = await page.evaluate(() => {
      const stick = document.querySelector('[data-testid="joystick"]');
      const hint = document.querySelector('[data-testid="ro-mobile-control-hint"]');
      if (!(stick instanceof HTMLElement) || !(hint instanceof HTMLElement)) return { count: 0 };
      const hintStyle = getComputedStyle(hint);
      const directionElements = [...hint.querySelectorAll(".ro-mobile-control-direction")];
      const noSynthesizedSurface = [hint, ...directionElements].every((element) => {
        const style = getComputedStyle(element);
        return style.backgroundImage === "none"
          && (style.backgroundColor === "rgba(0, 0, 0, 0)" || style.backgroundColor === "transparent")
          && style.borderTopWidth === "0px"
          && style.boxShadow === "none"
          && style.filter === "none"
          && style.opacity === "1";
      });
      const visible = hintStyle.display !== "none";
      const stickBox = stick.getBoundingClientRect();
      const hintBox = hint.getBoundingClientRect();
      return {
        count: 1,
        visible,
        coarsePointer: matchMedia("(pointer: coarse)").matches,
        ariaLabel: stick.getAttribute("aria-label"),
        controlKind: hint.getAttribute("data-ro-control"),
        pointerEvents: hintStyle.pointerEvents,
        assetIds: [...hint.querySelectorAll("[data-ro-asset]")].map((element) => element.getAttribute("data-ro-asset")),
        directions: directionElements.map((element) => element.getAttribute("data-ro-direction")),
        insideStick: !visible || (hintBox.left >= stickBox.left - 1 && hintBox.top >= stickBox.top - 1 && hintBox.right <= stickBox.right + 1 && hintBox.bottom <= stickBox.bottom + 1),
        noSynthesizedSurface,
      };
    });

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

    // Test-only deterministic presentation probe: use the live authoritative state so the formal
    // renderer must ingest a real Shield Wave cast/hit event and draw the verified RO bitmap.
    const shieldFxSource = await page.getByTestId("world").getAttribute("data-ro-skill-fx-source");
    await page.waitForFunction(() => {
      const state = window.__run?.();
      const activeFx = Number(document.querySelector('[data-testid="world"]')?.getAttribute("data-ro-skill-fx-active") ?? "0");
      return state?.phase === "running" && state.enemies.filter((enemy) => enemy.hp > 0).length >= 3 && activeFx === 0;
    }, null, { timeout: 10_000 });
    const shieldProbe = await page.evaluate(() => {
      const state = window.__run?.();
      if (!state) return { injected: false, enemyCount: 0 };
      const targets = state.enemies.filter((enemy) => enemy.hp > 0).slice(0, 3);
      const offsets = [-280, 0, 280];
      window.__roShieldProbeRestore = {
        player: {
          active: structuredClone(state.player.active),
          passive: structuredClone(state.player.passive),
          keystone: state.player.keystone,
          basicReadyAt: state.player.basicReadyAt,
          basicHitAt: state.player.basicHitAt,
          castSlot: state.player.castSlot,
          castEndAt: state.player.castEndAt,
          castDx: state.player.castDx,
          castDy: state.player.castDy,
        },
        stats: structuredClone(state.stats),
        targets: targets.map((enemy) => structuredClone(enemy)),
      };
      targets.forEach((enemy, index) => {
        enemy.x = state.player.x + (offsets[index] ?? 0);
        enemy.y = state.player.y - 4_350;
        enemy.hp = 100_000;
        enemy.maxHp = 100_000;
      });
      state.player.active = [{ id: "skill.sw.shield_wave", rank: 3, readyAt: state.runTick }];
      state.player.passive = [];
      state.player.keystone = null;
      state.player.basicReadyAt = Number.MAX_SAFE_INTEGER;
      state.player.basicHitAt = -1;
      state.player.castSlot = -1;
      return {
        injected: targets.length === 3,
        enemyCount: targets.length,
        damageBefore: state.stats.damageBySource["skill.sw.shield_wave"] ?? 0,
      };
    });
    await page.waitForFunction(
      (damageBefore) => {
        const active = Number(document.querySelector('[data-testid="world"]')?.getAttribute("data-ro-skill-fx-active") ?? "0");
        const damage = window.__run?.()?.stats.damageBySource["skill.sw.shield_wave"] ?? 0;
        return active > 0 && damage > damageBefore;
      },
      shieldProbe.damageBefore,
      { timeout: 10_000 },
    );
    const shieldFxEvidence = await page.evaluate((damageBefore) => ({
      active: Number(document.querySelector('[data-testid="world"]')?.getAttribute("data-ro-skill-fx-active") ?? "0"),
      hitDamage: (window.__run?.()?.stats.damageBySource["skill.sw.shield_wave"] ?? 0) - damageBefore,
    }), shieldProbe.damageBefore);
    const shieldFxScreenshot = join(out, `formal-${viewport.tag}-shield-wave.png`);
    await page.screenshot({ path: shieldFxScreenshot });
    await page.evaluate(() => {
      const state = window.__run?.();
      const restore = window.__roShieldProbeRestore;
      if (!state || !restore) return;
      Object.assign(state.player, structuredClone(restore.player));
      state.stats = structuredClone(restore.stats);
      for (const snapshot of restore.targets) {
        const enemy = state.enemies.find((candidate) => candidate.id === snapshot.id);
        if (enemy) Object.assign(enemy, structuredClone(snapshot));
      }
      delete window.__roShieldProbeRestore;
    });
    await page.waitForFunction(
      () => Number(document.querySelector('[data-testid="world"]')?.getAttribute("data-ro-skill-fx-active") ?? "0") === 0,
      null,
      { timeout: 10_000 },
    );

    // Endure uses its own deterministic skill event and the verified original 64x64 TGA-derived
    // image. It follows the live player position, then the bounded presentation must expire.
    const endureFxSource = await page.getByTestId("world").getAttribute("data-ro-endure-fx-source");
    await page.waitForFunction(
      () => Number(document.querySelector('[data-testid="world"]')?.getAttribute("data-ro-endure-fx-active") ?? "0") === 0,
      null,
      { timeout: 10_000 },
    );
    const endureProbe = await page.evaluate(() => {
      const state = window.__run?.();
      if (!state) return { injected: false };
      window.__roEndureProbeRestore = {
        active: structuredClone(state.player.active),
        passive: structuredClone(state.player.passive),
        keystone: state.player.keystone,
        basicReadyAt: state.player.basicReadyAt,
        basicHitAt: state.player.basicHitAt,
        castSlot: state.player.castSlot,
        castEndAt: state.player.castEndAt,
        castDx: state.player.castDx,
        castDy: state.player.castDy,
        lastDamagedTick: state.player.lastDamagedTick,
        endureUntil: state.player.endureUntil,
        endureReduction: state.player.endureReduction,
      };
      state.player.active = [{ id: "skill.sw.endure", rank: 3, readyAt: state.runTick }];
      state.player.passive = [];
      state.player.keystone = null;
      state.player.basicReadyAt = Number.MAX_SAFE_INTEGER;
      state.player.basicHitAt = -1;
      state.player.castSlot = -1;
      state.player.lastDamagedTick = state.runTick;
      return { injected: true };
    });
    await page.waitForFunction(
      () => Number(document.querySelector('[data-testid="world"]')?.getAttribute("data-ro-endure-fx-active") ?? "0") > 0,
      null,
      { timeout: 10_000 },
    );
    // The source-alpha cue intentionally fades in from zero. Wait past the transparent first frame
    // before taking visual evidence, then prove that its single bounded slot is still active.
    await page.waitForTimeout(220);
    await page.waitForFunction(
      () => Number(document.querySelector('[data-testid="world"]')?.getAttribute("data-ro-endure-fx-active") ?? "0") === 1,
      null,
      { timeout: 10_000 },
    );
    const endureFxEvidence = await page.evaluate(() => ({
      active: Number(document.querySelector('[data-testid="world"]')?.getAttribute("data-ro-endure-fx-active") ?? "0"),
    }));
    const endureFxScreenshot = join(out, `formal-${viewport.tag}-endure.png`);
    await page.screenshot({ path: endureFxScreenshot });
    await page.evaluate(() => {
      const state = window.__run?.();
      const restore = window.__roEndureProbeRestore;
      if (!state || !restore) return;
      Object.assign(state.player, structuredClone(restore));
      delete window.__roEndureProbeRestore;
    });
    await page.waitForFunction(
      () => Number(document.querySelector('[data-testid="world"]')?.getAttribute("data-ro-endure-fx-active") ?? "0") === 0,
      null,
      { timeout: 10_000 },
    );
    const endureExpired = true;
    await page.waitForTimeout(900);

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
      mobileControlHint: await page.getByTestId("ro-mobile-control-hint").count(),
      fixtureBanner: await page.getByTestId("fixture-banner").count(),
    };
    const layout = await page.evaluate(() => {
      const ids = ["run-hud", "ro-basic-info", "timer", "damage-stats", "ro-right-rail", "ro-shortcut", "ro-minimap", "joystick", "ro-mobile-control-hint"];
      const boxes = Object.fromEntries(ids.map((id) => {
        const element = document.querySelector(`[data-testid="${id}"]`);
        const r = element?.getBoundingClientRect();
        return [id, r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null];
      }));
      const inside = Object.values(boxes).every((r) => r === null || (r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1));
      const overlaps = (a, b) => a !== null && b !== null && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      const disjointPairs = [["ro-basic-info", "timer"], ["ro-basic-info", "ro-right-rail"], ["timer", "ro-right-rail"], ["ro-basic-info", "ro-shortcut"], ["ro-right-rail", "ro-shortcut"], ["joystick", "ro-shortcut"], ["ro-mobile-control-hint", "ro-shortcut"]];
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
      && surface.mobileControlHint === 1
      && surface.fixtureBanner === 0
      && shieldFxSource === "effect.skill.sw.shield_wave.projectile"
      && shieldProbe.injected === true
      && shieldProbe.enemyCount === 3
      && shieldFxEvidence.active > 0
      && shieldFxEvidence.hitDamage > 0
      && endureFxSource === "effect.skill.sw.endure"
      && endureProbe.injected === true
      && endureFxEvidence.active === 1
      && endureExpired
      && mobileControl.count === 1
      && mobileControl.visible === viewport.touch
      && mobileControl.coarsePointer === viewport.touch
      && mobileControl.ariaLabel === "拖曳移動區"
      && mobileControl.controlKind === "original-ro-raster-drag-hint"
      && mobileControl.pointerEvents === "none"
      && JSON.stringify(mobileControl.assetIds) === JSON.stringify(mobileControlAssetIds)
      && JSON.stringify(mobileControl.directions) === JSON.stringify(["up", "right", "down", "left"])
      && mobileControl.insideStick === true
      && mobileControl.noSynthesizedSurface === true
      && shellLayouts.length === 3
      && shellLayouts.every((entry) => entry.originalRoRaster && entry.inside && entry.noPageOverflow)
      && shellLayouts.some((entry) => entry.screen === "character-select"
        && entry.actorPreview?.count === 1
        && entry.actorPreview.source === "player.swordsman.male.body"
        && entry.actorPreview.kind === "original-ro-four-layer"
        && entry.actorPreview.firstFrame !== entry.actorPreview.nextFrame)
      && draftLayout.inside
      && draftLayout.overlapPairs.length === 0
      && draftLayout.noPageOverflow
      && layout.inside
      && layout.overlapPairs.length === 0
      && layout.noPageOverflow
      && errors.length === 0;
    results.push({ viewport: viewport.tag, size: `${viewport.width}x${viewport.height}`, buildId, moved, audioStarted, shieldFxSource, shieldProbe, shieldFxEvidence, endureFxSource, endureProbe, endureFxEvidence, endureExpired, mobileControl, shellLayouts, surface, draftLayout, layout, canceledRequests, errors, draftScreenshot: draftScreenshot.slice(root.length + 1), shieldFxScreenshot: shieldFxScreenshot.slice(root.length + 1), endureFxScreenshot: endureFxScreenshot.slice(root.length + 1), screenshot: screenshot.slice(root.length + 1), status: pass ? "PASS" : "FAIL" });
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
