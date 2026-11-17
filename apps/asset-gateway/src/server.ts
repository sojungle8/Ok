import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { AssetWhitelist, UnknownAssetError } from "@ro-survivor/asset-contracts";
import type { SourceLockLocal } from "@ro-survivor/content-schema";
import { AssetReadError, createAssetReader } from "./reader.ts";
import { createDerivedStore, DerivedUnavailableError } from "./derived.ts";
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
  const reader = createAssetReader(lock, options.maxAssetBytes === undefined ? {} : { maxAssetBytes: options.maxAssetBytes });
  const sourceHashes = reader.sourceHashes;
  const derived = options.derivedDir ? createDerivedStore(options.derivedDir, sourceHashes, lock.lockId) : null;

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
        json(res, 200, { ok: true, mode: "fan-local", buildId: options.buildId, sourceHashes, fixture: isFixtureLock(lock), lockId: lock.lockId, derived: derived?.identity() ?? null });
        return;
      }
      const m = ASSET_ROUTE.exec(path);
      if (m) {
        const row = whitelist.get(m[1] as string);
        const { bytes, sourceSha256: source, entrySha256 } = reader.read(row);
        res.writeHead(200, {
          "content-type": "application/octet-stream",
          "content-length": bytes.length,
          "cache-control": "no-store",
          "x-ro-asset-id": row.asset_id,
          "x-ro-source-sha256": source,
          "x-ro-entry-sha256": entrySha256,
        });
        res.end(req.method === "HEAD" ? undefined : bytes);
        return;
      }
      const d = DERIVED_ROUTE.exec(path);
      if (d) {
        whitelist.get(d[1] as string);
        if (!derived) throw new HttpError(404, "no derived assets; run pnpm assets:extract --profile fan-local");
        const bytes = derived.read(`${d[1] as string}.${d[2] as string}`);
        res.writeHead(200, { "content-type": d[2] === "png" ? "image/png" : "application/json; charset=utf-8", "content-length": bytes.length, "cache-control": "no-store" });
        res.end(req.method === "HEAD" ? undefined : bytes);
        return;
      }
      throw new HttpError(404, "not found");
    } catch (err) {
      if (err instanceof UnknownAssetError) json(res, 404, { error: "unknown-asset", message: err.message });
      else if (err instanceof HttpError || err instanceof AssetReadError || err instanceof DerivedUnavailableError) json(res, err.status, { error: `http-${err.status}`, message: err.message });
      else json(res, 500, { error: "internal", message: err instanceof Error ? err.message : String(err) });
    }
  };
  return {
    handler,
    close(): void {
      reader.close();
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

/** Locks produced by the synthetic test generator; never valid for the formal game. */
export function isFixtureLock(lock: SourceLockLocal): boolean {
  return lock.tool === "synthetic-sources" || lock.lockId === "synthetic";
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
