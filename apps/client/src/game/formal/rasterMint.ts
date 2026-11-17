/**
 * UI-B2 — loader-only mint for verified raster handles. Production code may import / call
 * `mintRasterSet` only from `game/formal/ui.ts` (static guard over all of apps/client/src). The public
 * primitive API (`ui/ro/raster.ts`) exposes read-only handles and `isVerifiedRaster`, never an issuer.
 * URLs are always created here from the verified bytes with the browser's Blob URLs — callers cannot
 * inject a URL factory.
 */
import { UI_REGISTRY } from "@ro-survivor/asset-contracts";
import type { UiManifestEntry } from "@ro-survivor/content-schema";
import { missingRaster as missing, type RasterRegistry, type VerifiedRaster } from "../../ui/ro/raster.ts";

const minted = new WeakSet<object>();
const canonicalIds = new Set(UI_REGISTRY.map((e) => e[0]));
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Brand check used by `isVerifiedRaster` (no minting capability). */
export function isMintedRaster(x: unknown): boolean {
  return typeof x === "object" && x !== null && minted.has(x);
}

/** Trusted, fixed URL source: a Blob URL of the verified PNG bytes. */
const createUrl = (bytes: Uint8Array): string => URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "image/png" }));
const revokeUrl = (url: string): void => URL.revokeObjectURL(url);

function deepFreeze<T>(v: T): T {
  if (v && typeof v === "object" && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const k of Object.keys(v)) deepFreeze((v as Record<string, unknown>)[k]);
  }
  return v;
}

async function sha256Upper(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

class Handle implements VerifiedRaster {
  readonly assetId: string;
  readonly width: number;
  readonly height: number;
  readonly entry: Readonly<UiManifestEntry>;
  #url: string | null;

  /** `entry` is already an independent frozen copy; the constructor cannot fail. */
  constructor(assetId: string, width: number, height: number, entry: Readonly<UiManifestEntry>, url: string) {
    this.assetId = assetId;
    this.width = width;
    this.height = height;
    this.entry = entry;
    this.#url = url;
    Object.freeze(this);
  }

  get url(): string {
    if (this.#url === null) throw new Error(`raster ${this.assetId} was disposed`);
    return this.#url;
  }

  get disposed(): boolean {
    return this.#url === null;
  }

  dispose(): void {
    if (this.#url === null) return;
    const u = this.#url;
    this.#url = null;
    revokeUrl(u);
  }
}

export interface MintItem {
  assetId: string;
  bytes: Uint8Array;
  /** SHA-256 the per-asset JSON declared for these PNG bytes. */
  sha256: string;
  width: number;
  height: number;
  entry: UiManifestEntry;
}

/** Revoke every URL best-effort; returns the errors instead of stopping at the first one. */
function revokeAll(urls: readonly string[]): unknown[] {
  const errors: unknown[] = [];
  for (const u of urls) {
    try {
      revokeUrl(u);
    } catch (err) {
      errors.push(err);
    }
  }
  return errors;
}

/**
 * Issue every handle as one transaction:
 * 1. validate every item (canonical ID, entry ID, size, PNG signature, SHA-256 of the bytes) and make
 *    its independent frozen metadata — no URL exists yet, so a failure here leaks nothing;
 * 2. create the URLs; if any creation fails, every URL already created is revoked best-effort (each
 *    exactly once, continuing past revoke errors) and the original error is rethrown with
 *    `cleanupErrors` attached. A partial registry is never returned.
 */
export async function mintRasterSet(items: readonly MintItem[]): Promise<RasterRegistry> {
  const prepared: { it: MintItem; entry: Readonly<UiManifestEntry> }[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    if (!canonicalIds.has(it.assetId)) throw new Error(`${it.assetId} is not in the canonical UI registry`);
    if (it.entry.logical_asset_id !== it.assetId) throw new Error(`entry is for ${it.entry.logical_asset_id}, not ${it.assetId}`);
    if (seen.has(it.assetId)) throw new Error(`raster ${it.assetId} issued twice`);
    seen.add(it.assetId);
    if (!Number.isInteger(it.width) || !Number.isInteger(it.height) || it.width < 1 || it.height < 1) throw new Error(`${it.assetId}: bad size ${it.width}x${it.height}`);
    if (it.entry.format === "bmp" && (it.width !== it.entry.native_width || it.height !== it.entry.native_height)) throw new Error(`${it.assetId}: ${it.width}x${it.height} != native ${it.entry.native_width ?? "?"}x${it.entry.native_height ?? "?"}`);
    if (!PNG_SIGNATURE.every((b, i) => it.bytes[i] === b)) throw new Error(`${it.assetId}: bytes are not a PNG`);
    const got = await sha256Upper(it.bytes);
    if (got !== it.sha256.toUpperCase()) throw new Error(`${it.assetId}: PNG SHA-256 ${got} != declared ${it.sha256}`);
    prepared.push({ it, entry: deepFreeze(structuredClone(it.entry)) });
  }
  const created: string[] = [];
  const handles = new Map<string, Handle>();
  try {
    for (const { it, entry } of prepared) {
      const url = createUrl(it.bytes);
      created.push(url);
      handles.set(it.assetId, new Handle(it.assetId, it.width, it.height, entry, url));
    }
  } catch (err) {
    const cleanupErrors = revokeAll(created);
    if (err && typeof err === "object") Object.assign(err, { cleanupErrors });
    throw err;
  }
  for (const h of handles.values()) minted.add(h);
  let disposed = false;
  const registry: RasterRegistry = {
    get(assetId) {
      const h = handles.get(assetId);
      if (!h || h.disposed) throw missing(assetId, h ? "verified raster was disposed" : "no verified raster for this logical ID");
      return h;
    },
    has: (assetId) => handles.get(assetId)?.disposed === false,
    ids: () => [...handles.keys()].sort(),
    get disposed() {
      return disposed;
    },
    dispose() {
      disposed = true;
      const errors: unknown[] = [];
      for (const h of handles.values()) {
        try {
          h.dispose();
        } catch (err) {
          errors.push(err);
        }
      }
      if (errors.length > 0) throw new AggregateError(errors, "some raster URLs could not be revoked");
    },
  };
  return Object.freeze(registry);
}
