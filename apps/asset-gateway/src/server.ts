import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { basename, join, resolve, sep } from "node:path";
import { AssetWhitelist, UnknownAssetError } from "@ro-survivor/asset-contracts";
import type { SourceLockLocal, WhitelistRow } from "@ro-survivor/content-schema";
import { openGrf, type GrfArchive } from "@ro-survivor/ro-format-runtime/grf";
import { isLoopbackHost, type GatewayConfig } from "./config.ts";

export interface GatewayServerOptions {
  config: GatewayConfig;
  whitelist: AssetWhitelist;
  /** Verified local lock from `pnpm assets:verify-sources` (paths + source hashes). */
  lock: SourceLockLocal;
  buildId: string;
  /** Directory with derived files for this lock: `.local-assets/<source-hash>/<converter-version>/`. */
  derivedDir?: string | null;
  /** Maximum bytes served for one asset. */
  maxAssetBytes?: number;
}

export interface RunningGateway {
  server: Server;
  url: string;
  close(): Promise<void>;
}

const ASSET_ROUTE = /^\/v1\/assets\/([a-z0-9_]+(?:\.[a-z0-9_]+)+)$/u;
const DERIVED_ROUTE = /^\/v1\/derived\/([a-z0-9_]+(?:\.[a-z0-9_]+)+)\.(json|png)$/u;

function sha256(b: Uint8Array): string {
  return createHash("sha256").update(b).digest("hex").toUpperCase();
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(text), "cache-control": "no-store" });
  res.end(text);
}

function hostOf(req: IncomingMessage): string {
  const h = req.headers.host ?? "";
  return h.startsWith("[") ? h.slice(0, h.indexOf("]") + 1).replace(/^\[|\]$/gu, "") : (h.split(":")[0] ?? "");
}

/**
 * Loopback-only, read-only asset gateway. Only whitelisted asset IDs are accepted (never paths),
 * entries are found by raw CP949 hex and must match the whitelist size (and SHA-256 when listed).
 */
export function createGateway(options: GatewayServerOptions): { handler: (req: IncomingMessage, res: ServerResponse) => void; close(): void } {
  const { lock, whitelist, config } = options;
  const maxBytes = options.maxAssetBytes ?? 64 * 1024 * 1024;
  for (const id of ["data.grf", "rdata.grf"] as const) {
    const s = lock.sources[id];
    if (!existsSync(s.path) || statSync(s.path).size !== s.bytes) {
      throw new Error(`${id} at the locked path is missing or its size changed; re-run pnpm assets:verify-sources`);
    }
  }
  const archives: Partial<Record<"data.grf" | "rdata.grf", GrfArchive>> = {};
  const archive = (id: "data.grf" | "rdata.grf"): GrfArchive => (archives[id] ??= openGrf(lock.sources[id].path));
  const sourceHashes = { "data.grf": lock.sources["data.grf"].sha256, "rdata.grf": lock.sources["rdata.grf"].sha256, bgm: lock.sources.bgm.manifestSha256 };

  const readAsset = (row: WhitelistRow): { bytes: Uint8Array; source: string } => {
    if (row.source_container === "filesystem:BGM") {
      const name = basename(row.canonical_cp949_path.replaceAll("\\", "/"));
      const file = lock.sources.bgm.files.find((f) => f.name.toLowerCase() === name.toLowerCase());
      if (!file) throw new HttpError(404, `BGM ${name} is not in the verified manifest`);
      const bytes = readFileSync(join(lock.sources.bgm.path, file.name));
      if (sha256(bytes) !== file.sha256) throw new HttpError(409, `BGM ${name} changed since assets:verify-sources`);
      return { bytes, source: sourceHashes.bgm };
    }
    const id = row.rdata_override === "true" ? "rdata.grf" : "data.grf";
    const entry = archive(id).byRawHex.get(row.raw_name_hex);
    if (!entry) throw new HttpError(404, `${row.asset_id} not found in ${id} by raw hex`);
    if (entry.realSize !== row.bytes) throw new HttpError(409, `${row.asset_id} is ${entry.realSize} bytes in ${id}, whitelist says ${row.bytes}`);
    if (entry.realSize > maxBytes) throw new HttpError(413, `${row.asset_id} exceeds ${maxBytes} bytes`);
    const bytes = archive(id).read(entry);
    if (row.sha256 !== "" && sha256(bytes) !== row.sha256.toUpperCase()) throw new HttpError(409, `${row.asset_id} SHA-256 differs from the whitelist`);
    return { bytes, source: sourceHashes[id] };
  };

  const handler = (req: IncomingMessage, res: ServerResponse): void => {
    try {
      const host = hostOf(req);
      if (!isLoopbackHost(host) && !(config.lanProfile && host === config.host)) {
        throw new HttpError(421, "host header is not an allowed gateway host");
      }
      const origin = req.headers.origin;
      if (origin) {
        let originHost = "";
        try {
          originHost = new URL(origin).hostname.replace(/^\[|\]$/gu, "");
        } catch {
          throw new HttpError(403, "bad origin");
        }
        if (!isLoopbackHost(originHost) && !(config.lanProfile && originHost === config.host)) throw new HttpError(403, "origin not allowed");
        res.setHeader("access-control-allow-origin", origin);
        res.setHeader("access-control-expose-headers", "x-ro-source-sha256, x-ro-asset-id, x-ro-entry-sha256");
        res.setHeader("vary", "origin");
      }
      if (req.method !== "GET" && req.method !== "HEAD") throw new HttpError(405, "only GET is allowed");
      const path = (req.url ?? "/").split("?")[0] ?? "/";
      if (path === "/health") {
        json(res, 200, { ok: true, mode: "fan-local", buildId: options.buildId, sourceHashes });
        return;
      }
      const m = ASSET_ROUTE.exec(path);
      if (m) {
        const row = whitelist.get(m[1] as string);
        const { bytes, source } = readAsset(row);
        res.writeHead(200, {
          "content-type": "application/octet-stream",
          "content-length": bytes.length,
          "cache-control": "no-store",
          "x-ro-asset-id": row.asset_id,
          "x-ro-source-sha256": source,
          "x-ro-entry-sha256": sha256(bytes),
        });
        res.end(req.method === "HEAD" ? undefined : bytes);
        return;
      }
      const d = DERIVED_ROUTE.exec(path);
      if (d) {
        whitelist.get(d[1] as string);
        if (!options.derivedDir) throw new HttpError(404, "no derived assets; run pnpm assets:extract --profile fan-local");
        const root = resolve(options.derivedDir);
        const file = resolve(root, `${d[1] as string}.${d[2] as string}`);
        if (!file.startsWith(root + sep) || !existsSync(file)) throw new HttpError(404, `derived ${d[1] as string}.${d[2] as string} not found`);
        const bytes = readFileSync(file);
        res.writeHead(200, { "content-type": d[2] === "png" ? "image/png" : "application/json; charset=utf-8", "content-length": bytes.length, "cache-control": "no-store" });
        res.end(req.method === "HEAD" ? undefined : bytes);
        return;
      }
      throw new HttpError(404, "not found");
    } catch (err) {
      if (err instanceof UnknownAssetError) json(res, 404, { error: "unknown-asset", message: err.message });
      else if (err instanceof HttpError) json(res, err.status, { error: `http-${err.status}`, message: err.message });
      else json(res, 500, { error: "internal", message: err instanceof Error ? err.message : String(err) });
    }
  };
  return {
    handler,
    close(): void {
      for (const a of Object.values(archives)) a.close();
    },
  };
}

class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function startGateway(options: GatewayServerOptions): Promise<RunningGateway> {
  const gw = createGateway(options);
  const server = createServer(gw.handler);
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(options.config.port, options.config.host, () => resolveListen());
  });
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : options.config.port;
  const host = options.config.host.includes(":") ? `[${options.config.host}]` : options.config.host;
  return {
    server,
    url: `http://${host}:${port}`,
    close: () =>
      new Promise<void>((r) => {
        server.close(() => {
          gw.close();
          r();
        });
        server.closeAllConnections();
      }),
  };
}
