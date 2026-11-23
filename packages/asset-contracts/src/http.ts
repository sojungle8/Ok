import type { SourceId } from "@ro-survivor/content-schema";
import type { AssetGateway, AssetGatewayHealth, AssetSourceMode } from "./gateway.ts";
import { PlaceholderAssetGateway } from "./placeholder.ts";
import { AssetWhitelist } from "./whitelist.ts";

/** Which verified source a whitelist row is served from. */
export function sourceIdForRow(row: { source_container: string; rdata_override: string }): SourceId {
  if (row.source_container === "filesystem:BGM") return "bgm";
  if (row.source_container === "filesystem:System") return "system";
  return row.rdata_override === "true" ? "rdata.grf" : "data.grf";
}

export type FetchLike = (input: string, init?: { signal?: AbortSignal; method?: string }) => Promise<Response>;

export interface HttpGatewayOptions {
  baseUrl: string;
  whitelist: AssetWhitelist;
  fetch?: FetchLike;
  timeoutMs?: number;
  /** Explicit private-LAN profile; without it only http://127.0.0.1 / [::1] / localhost are accepted. */
  allowLan?: boolean;
  /** Upper bound for any single response (bytes). */
  maxBytes?: number;
}

export class GatewayError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "GatewayError";
    this.code = code;
  }
}

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "[::1]", "localhost"]);
const PRIVATE_LAN = /^(10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+)$/u;

export function validateGatewayUrl(baseUrl: string, allowLan = false): URL {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new GatewayError("bad-url", `invalid gateway URL ${JSON.stringify(baseUrl)}`);
  }
  if (url.protocol !== "http:") throw new GatewayError("bad-url", "gateway URL must be http:// (local only)");
  if (url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) {
    throw new GatewayError("bad-url", "gateway URL must be a bare origin");
  }
  const host = url.hostname;
  if (!LOOPBACK_HOSTS.has(host) && !(allowLan && PRIVATE_LAN.test(host))) {
    throw new GatewayError("not-loopback", `gateway host ${host} is not loopback${allowLan ? " or a private LAN address" : " (enable an explicit LAN profile first)"}`);
  }
  return url;
}

async function readLimited(res: Response, limit: number): Promise<Uint8Array> {
  const declared = res.headers.get("content-length");
  if (declared !== null && Number(declared) > limit) throw new GatewayError("too-large", `response declares ${declared} bytes > limit ${limit}`);
  if (!res.body) return new Uint8Array(0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) {
      await reader.cancel();
      throw new GatewayError("too-large", `response exceeded ${limit} bytes`);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

/** HTTP client for the local fan-local asset gateway (loopback by default). */
export class HttpAssetGatewayClient implements AssetGateway {
  readonly #base: URL;
  readonly #whitelist: AssetWhitelist;
  readonly #fetch: FetchLike;
  readonly #timeoutMs: number;
  readonly #maxBytes: number;
  #health: AssetGatewayHealth | null = null;

  constructor(options: HttpGatewayOptions) {
    this.#base = validateGatewayUrl(options.baseUrl, options.allowLan ?? false);
    this.#whitelist = options.whitelist;
    this.#fetch = options.fetch ?? ((input, init) => fetch(input, init));
    this.#timeoutMs = options.timeoutMs ?? 10_000;
    this.#maxBytes = options.maxBytes ?? 64 * 1024 * 1024;
  }

  mode(): AssetSourceMode {
    return "fan-local";
  }

  async #request(path: string, signal: AbortSignal | undefined, contentType: RegExp, limit: number): Promise<{ body: Uint8Array; res: Response }> {
    const timeout = AbortSignal.timeout(this.#timeoutMs);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    let res: Response;
    try {
      res = await this.#fetch(new URL(path, this.#base).toString(), { signal: combined, method: "GET" });
    } catch (err) {
      if (timeout.aborted) throw new GatewayError("timeout", `gateway request timed out after ${this.#timeoutMs} ms`);
      throw err instanceof Error && err.name === "AbortError" ? err : new GatewayError("offline", `gateway unreachable: ${String(err)}`);
    }
    if (!res.ok) {
      const text = new TextDecoder().decode(await readLimited(res, 4096).catch(() => new Uint8Array()));
      throw new GatewayError(`http-${res.status}`, `gateway returned ${res.status}: ${text.slice(0, 200)}`);
    }
    const ct = res.headers.get("content-type") ?? "";
    if (!contentType.test(ct)) throw new GatewayError("bad-content-type", `unexpected content-type ${ct}`);
    return { body: await readLimited(res, limit), res };
  }

  async health(): Promise<AssetGatewayHealth> {
    const { body } = await this.#request("/health", undefined, /^application\/json\b/u, 64 * 1024);
    const value = JSON.parse(new TextDecoder().decode(body)) as AssetGatewayHealth;
    if (value.mode !== "fan-local" || typeof value.buildId !== "string" || typeof value.sourceHashes !== "object") {
      throw new GatewayError("bad-health", "health response does not match the contract");
    }
    this.#health = value;
    return value;
  }

  async getSourceHash(sourceId: SourceId): Promise<string | null> {
    const h = this.#health ?? (await this.health());
    return h.sourceHashes[sourceId] ?? null;
  }

  async getBinary(assetId: string, signal?: AbortSignal): Promise<ArrayBuffer> {
    const row = this.#whitelist.get(assetId); // unknown IDs fail before any HTTP request
    const limit = Math.min(row.bytes, this.#maxBytes);
    const { body, res } = await this.#request(`/v1/assets/${encodeURIComponent(assetId)}`, signal, /^application\/octet-stream\b/u, limit);
    if (body.length !== row.bytes) throw new GatewayError("size-mismatch", `${assetId}: got ${body.length} bytes, whitelist says ${row.bytes}`);
    const source = res.headers.get("x-ro-source-sha256");
    if (!source || !/^[0-9A-F]{64}$/u.test(source)) throw new GatewayError("no-source-hash", `${assetId}: missing x-ro-source-sha256`);
    const expectedSource = await this.getSourceHash(sourceIdForRow(row));
    if (expectedSource !== source) throw new GatewayError("source-mismatch", `${assetId}: source hash ${source} differs from gateway health ${expectedSource ?? "null"}`);
    return body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer;
  }

  /** Verify a source entry without downloading it (HEAD): status, size == whitelist bytes, source hash. */
  async checkSource(assetId: string, signal?: AbortSignal): Promise<void> {
    const row = this.#whitelist.get(assetId);
    const timeout = AbortSignal.timeout(this.#timeoutMs);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    let res: Response;
    try {
      res = await this.#fetch(new URL(`/v1/assets/${encodeURIComponent(assetId)}`, this.#base).toString(), { signal: combined, method: "HEAD" });
    } catch (err) {
      throw new GatewayError(timeout.aborted ? "timeout" : "offline", `${assetId}: ${String(err)}`);
    }
    if (!res.ok) throw new GatewayError(`http-${res.status}`, `${assetId}: gateway returned ${res.status}`);
    const len = Number(res.headers.get("content-length") ?? "-1");
    if (len !== row.bytes) throw new GatewayError("size-mismatch", `${assetId}: ${len} bytes, whitelist says ${row.bytes}`);
    if (!/^[0-9A-F]{64}$/u.test(res.headers.get("x-ro-source-sha256") ?? "")) throw new GatewayError("no-source-hash", `${assetId}: missing x-ro-source-sha256`);
  }

  /** Derived metadata JSON produced by `assets:extract` for a whitelisted asset. */
  async getJson<T>(assetId: string, signal?: AbortSignal): Promise<T> {
    this.#whitelist.get(assetId);
    const { body } = await this.#request(`/v1/derived/${encodeURIComponent(assetId)}.json`, signal, /^application\/json\b/u, 16 * 1024 * 1024);
    return JSON.parse(new TextDecoder().decode(body)) as T;
  }

  /** Derived atlas PNG produced by `assets:extract` for a whitelisted asset. */
  async getDerivedImage(assetId: string, signal?: AbortSignal): Promise<Uint8Array> {
    this.#whitelist.get(assetId);
    const { body } = await this.#request(`/v1/derived/${encodeURIComponent(assetId)}.png`, signal, /^image\/png\b/u, 32 * 1024 * 1024);
    return body;
  }

  resolvePath(assetId: string): Promise<string> {
    try {
      const row = this.#whitelist.get(assetId);
      return Promise.resolve(`fan-local://${row.source_container}/${row.normalized_request_path.replace(/^\//u, "")}`);
    } catch (err) {
      return Promise.reject(err instanceof Error ? err : new Error(String(err)));
    }
  }
}

/**
 * Try the local gateway; on failure return the test-only placeholder gateway with a reason.
 * For tooling and tests only — the formal client uses connectFormalGateway and stops instead (D-022).
 */
export async function connectAssetGateway(options: HttpGatewayOptions & { buildId: string }): Promise<AssetGateway & { reason?: string }> {
  try {
    const client = new HttpAssetGatewayClient({ ...options, timeoutMs: options.timeoutMs ?? 2_000 });
    await client.health();
    return client;
  } catch (err) {
    const why = err instanceof GatewayError ? `${err.code}: ${err.message}` : String(err);
    return new PlaceholderAssetGateway({
      whitelist: options.whitelist,
      buildId: options.buildId,
      reason: `asset gateway 未連線（${why}）。本機請執行 pnpm dev:fan-local；目前使用 placeholder。`,
    });
  }
}
