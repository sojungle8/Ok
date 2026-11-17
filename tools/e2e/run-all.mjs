// Phase 1 browser evidence, all automated:
//   A. formal build, no gateway             -> blocked screen (no world canvas)
//   B. formal build + synthetic gateway     -> fixture refused, blocked
//   C. test-fixture build + synthetic gateway -> game flow (tools/e2e/flow.mjs): autoplay to results +
//      settlement, drafts by key / touch / gamepad, keyboard movement
//   D. bench on the test-fixture build
// Synthetic fixtures are only ever served to the separate test build in apps/client/dist-test.
import { spawn, execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const node24 = process.env.NODE24 ?? process.execPath;
const port = 4179;
const run = (cmd, args, env = {}) => execFileSync(cmd, args, { cwd: root, stdio: "inherit", env: { ...process.env, ...env } });
const capture = (args, env) => {
  try {
    return { code: 0, out: execFileSync(process.execPath, args, { cwd: root, env: { ...process.env, ...env }, encoding: "utf8" }) };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
};

if (!existsSync(join(root, ".local-assets/synthetic-demo/source-lock.json"))) run(node24, ["tools/assets/synthetic-demo.ts"]);
const gw = spawn(node24, ["apps/asset-gateway/src/main.ts"], {
  cwd: root,
  env: { ...process.env, RO_GATEWAY_LOCK_FILE: ".local-assets/synthetic-demo/source-lock.json", RO_GATEWAY_DERIVED_DIR: ".local-assets/synthetic-demo/derived", RO_GATEWAY_ALLOW_SYNTHETIC: "1", RO_ASSET_GATEWAY_PORT: String(port) },
  stdio: ["ignore", "pipe", "inherit"],
});
await new Promise((ok, fail) => {
  const t = setTimeout(() => fail(new Error("gateway did not start")), 20_000);
  gw.stdout.on("data", (d) => d.toString().includes("listening") && (clearTimeout(t), ok()));
});
const summary = {};
try {
  const gwUrl = `http://127.0.0.1:${port}`;
  run("pnpm", ["--filter", "@ro-survivor/client", "build"], { VITE_ASSET_GATEWAY_URL: "", VITE_ALLOW_SYNTHETIC: "" });
  const a = capture(["tools/e2e/smoke.mjs"], { SMOKE_EXPECT: "blocked", SMOKE_TAG: "-A-formal-no-gateway", SMOKE_REASON: "未設定 asset gateway" });
  run("pnpm", ["--filter", "@ro-survivor/client", "exec", "vite", "build", "--outDir", "dist-formal-gw"], { VITE_ASSET_GATEWAY_URL: gwUrl, VITE_ALLOW_SYNTHETIC: "" });
  const b = capture(["tools/e2e/smoke.mjs"], { SMOKE_DIST: "apps/client/dist-formal-gw", SMOKE_EXPECT: "blocked", SMOKE_TAG: "-B-formal-refuses-fixture", SMOKE_REASON: "synthetic fixture" });
  run("pnpm", ["--filter", "@ro-survivor/client", "exec", "vite", "build", "--outDir", "dist-test"], { VITE_ASSET_GATEWAY_URL: gwUrl, VITE_ALLOW_SYNTHETIC: "1" });
  const c = capture(["tools/e2e/flow.mjs"], { FLOW_DIST: "apps/client/dist-test" });
  const d = process.env.SKIP_BENCH ? { code: 0, out: "skipped" } : capture(["tools/e2e/bench.mjs"], { BENCH_DIST: "apps/client/dist-test" });
  Object.assign(summary, { A: a, B: b, C: c, D: { code: d.code } });
  for (const [k, v] of Object.entries({ A: a, B: b })) writeFileSync(join(root, `reports/phase1/smoke-${k}.json`), v.out.slice(v.out.indexOf("[")));
} finally {
  gw.kill();
}
for (const [k, v] of Object.entries(summary)) console.log(`${k}: ${v.code === 0 ? "PASS" : "FAIL"}`);
if (Object.values(summary).some((v) => v.code !== 0)) process.exitCode = 1;
