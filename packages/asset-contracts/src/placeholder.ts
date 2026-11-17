import type { SourceId } from "@ro-survivor/content-schema";
import type { AssetGateway, AssetGatewayHealth, AssetSourceMode } from "./gateway.ts";
import { AssetWhitelist } from "./whitelist.ts";

export interface PlaceholderAsset {
  placeholder: true;
  assetId: string;
  category: string;
  /** Explicit marker so placeholder results can never be mistaken for real-material validation. */
  realMaterial: false;
}

const PLACEHOLDER_MAGIC = "RO-SURVIVOR-PLACEHOLDER\n";

/** Run synchronously but surface any throw as a rejected promise (contract is async). */
function attempt<T>(fn: () => T): Promise<T> {
  try {
    return Promise.resolve(fn());
  } catch (err) {
    return Promise.reject(err instanceof Error ? err : new Error(String(err)));
  }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw signal.reason instanceof Error ? signal.reason : new DOMException("aborted", "AbortError");
  }
}

/**
 * Network-free gateway for AUTOMATED TESTS ONLY (CI without RO sources). The formal client never
 * uses it: without the user's RO client the game stops and lists missing canonical paths (D-022).
 * It only answers whitelisted IDs and never returns RO material.
 */
export class PlaceholderAssetGateway implements AssetGateway {
  readonly #whitelist: AssetWhitelist;
  readonly #buildId: string;
  readonly #reason: string;

  constructor(options: { whitelist: AssetWhitelist; buildId: string; reason?: string }) {
    this.#whitelist = options.whitelist;
    this.#buildId = options.buildId;
    this.#reason = options.reason ?? "fan-local asset gateway not connected";
  }

  get reason(): string {
    return this.#reason;
  }

  mode(): AssetSourceMode {
    return "placeholder";
  }

  getBinary(assetId: string, signal?: AbortSignal): Promise<ArrayBuffer> {
    return attempt(() => {
      throwIfAborted(signal);
      this.#whitelist.get(assetId);
      const bytes = new TextEncoder().encode(`${PLACEHOLDER_MAGIC}${assetId}\n`);
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    });
  }

  getJson<T>(assetId: string, signal?: AbortSignal): Promise<T> {
    return attempt(() => {
      throwIfAborted(signal);
      const row = this.#whitelist.get(assetId);
      const value: PlaceholderAsset = { placeholder: true, assetId, category: row.category, realMaterial: false };
      return value as T;
    });
  }

  resolvePath(assetId: string): Promise<string> {
    return attempt(() => {
      this.#whitelist.get(assetId);
      return `placeholder://${assetId}`;
    });
  }

  getSourceHash(_sourceId: SourceId): Promise<string | null> {
    return Promise.resolve(null);
  }

  health(): Promise<AssetGatewayHealth> {
    return Promise.resolve({
      ok: true,
      mode: "placeholder",
      buildId: this.#buildId,
      sourceHashes: { "data.grf": null, "rdata.grf": null, bgm: null, system: null },
    });
  }
}

export function isPlaceholderBinary(buffer: ArrayBuffer): boolean {
  const head = new TextDecoder().decode(buffer.slice(0, PLACEHOLDER_MAGIC.length));
  return head === PLACEHOLDER_MAGIC;
}
