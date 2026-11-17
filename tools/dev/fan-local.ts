// pnpm dev:fan-local — start the loopback asset gateway, then the client. If the gateway cannot
// start (no verified lock, sources moved, port busy) the client still starts on the placeholder
// gateway and shows the reason.
import { spawn, type ChildProcess } from "node:child_process";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const port = process.env.RO_ASSET_GATEWAY_PORT ?? "4178";
const children: ChildProcess[] = [];
const stopAll = (): void => {
  for (const c of children) c.kill();
};
process.on("SIGINT", () => {
  stopAll();
  process.exit(0);
});

const gateway = spawn(process.execPath, [join(root, "apps/asset-gateway/src/main.ts")], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
children.push(gateway);
const ready = await new Promise<string | null>((resolveReady) => {
  const timer = setTimeout(() => resolveReady("gateway did not report listening within 15 s"), 15_000);
  gateway.stdout.on("data", (d: Buffer) => {
    process.stdout.write(d);
    if (d.toString().includes("listening on")) {
      clearTimeout(timer);
      resolveReady(null);
    }
  });
  gateway.stderr.on("data", (d: Buffer) => process.stderr.write(d));
  gateway.on("exit", (code) => {
    clearTimeout(timer);
    resolveReady(`gateway exited with code ${code ?? "null"}`);
  });
});
if (ready) console.warn(`dev:fan-local: ${ready}; starting the client with the placeholder gateway.`);
const client = spawn("pnpm", ["--filter", "@ro-survivor/client", "dev"], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, VITE_ASSET_GATEWAY_URL: ready ? "" : `http://127.0.0.1:${port}` },
});
children.push(client);
client.on("exit", () => {
  stopAll();
  process.exit(0);
});
