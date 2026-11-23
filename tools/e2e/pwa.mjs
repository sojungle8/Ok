// F. Offline app shell on the formal build (no gateway): the service worker precaches only the built
// shell, the page reloads while offline, and no cached URL is RO data or outside the shell.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const root = resolve(import.meta.dirname, "../..");
const dist = resolve(root, process.env.PWA_DIST ?? "apps/client/dist");
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
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await playwright.chromium.launch();
const result = { status: "FAIL" };
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(url);
  await page.getByTestId("title").waitFor({ timeout: 30_000 });
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  const manifest = await page.evaluate(async () => (await fetch("./manifest.webmanifest")).json());
  const cached = await page.evaluate(async () => {
    const out = [];
    for (const key of await caches.keys()) for (const req of await (await caches.open(key)).keys()) out.push({ cache: key, path: new URL(req.url).pathname });
    return out;
  });
  await context.setOffline(true);
  await page.reload();
  await page.getByTestId("title").waitFor({ timeout: 30_000 });
  const offlineTitle = (await page.getByTestId("title").innerText()).trim();
  const worldCanvas = await page.getByTestId("world").count();
  const forbidden = cached.filter((c) => /\.(?:grf|spr|act|gnd|gat|rsw|rsm|str|bmp|tga|wav|mp3|png|jpe?g)$|\/(?:data|bgm|system|\.local-assets)\//iu.test(c.path));
  const ok = cached.length > 0 && forbidden.length === 0 && cached.every((c) => c.cache.startsWith("ro-survivor-shell-"))
    && offlineTitle.length > 0 && worldCanvas === 0 && manifest.start_url === "./" && errors.length === 0;
  Object.assign(result, { status: ok ? "PASS" : "FAIL", cachedFiles: cached.length, forbidden, offlineTitle: offlineTitle.slice(0, 60), worldCanvas, manifestName: manifest.name, errors });
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify(result, null, 2));
if (result.status !== "PASS") process.exitCode = 1;
