/**
 * UI-B2 — loader-only mint for verified raster handles. Production code may call `mintRasterSet` only
 * from `game/formal/ui.ts` (enforced by a static call-site test). The public primitive API
 * (`ui/ro/raster.ts`) exposes read-only handles and `isVerifiedRaster`, never an issuer.
 */
import { UI_REGISTRY } from "@ro-survivor/asset-contracts";
import type { UiManifestEntry } from "@ro-survivor/content-schema";
import { missingRaster as missing, type RasterRegistry, type RasterUrlFactory, type VerifiedRaster } from "../../ui/ro/raster.ts";

const minted = new WeakSet<object>();
const canonicalIds = new Set(UI_REGISTRY.map((e) => e[0]));

/** Brand check used by `isVerifiedRaster` (no minting capability). */
export function isMintedRaster(x: unknown): boolean {
  return typeof x === "object" && x !== null && minted.has(x);
}

function deepFreeze<T>(v: T): T {
  if (v && typeof v === "object") {
    for (const k of Object.keys(v)) deepFreeze((v as Record<string, unknown>)[k]);
    Object.freeze(v);
  }
  return v;
}

class Handle implements VerifiedRaster {
  readonly assetId: string;
  readonly width: number;
  readonly height: number;
  readonly entry: Readonly<UiManifestEntry>;
  #url: string | null;
  readonly #urls: RasterUrlFactory;

  constructor(assetId: string, width: number, height: number, entry: UiManifestEntry, url: string, urls: RasterUrlFactory) {
    this.assetId = assetId;
    this.width = width;
    this.height = height;
    // Independent, recursively frozen copy: neither consumers nor the loader can change it afterwards.
    this.entry = deepFreeze(structuredClone(entry));
    this.#url = url;
    this.#urls = urls;
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
    this.#urls.revoke(u);
  }
}

export interface MintItem {
  assetId: string;
  bytes: Uint8Array;
  width: number;
  height: number;
  entry: UiManifestEntry;
}

/**
 * Issue every handle as one transaction: any validation or URL-creation failure revokes every URL
 * created so far exactly once and rethrows; a partial set is never returned.
 */
export function mintRasterSet(items: readonly MintItem[], urls: RasterUrlFactory): RasterRegistry {
  const handles = new Map<string, Handle>();
  try {
    for (const it of items) {
      if (!canonicalIds.has(it.assetId)) throw new Error(`${it.assetId} is not in the canonical UI registry`);
      if (it.entry.logical_asset_id !== it.assetId) throw new Error(`entry is for ${it.entry.logical_asset_id}, not ${it.assetId}`);
      if (handles.has(it.assetId)) throw new Error(`raster ${it.assetId} issued twice`);
      if (!Number.isInteger(it.width) || !Number.isInteger(it.height) || it.width < 1 || it.height < 1) throw new Error(`${it.assetId}: bad size ${it.width}x${it.height}`);
      if (it.entry.format === "bmp" && (it.width !== it.entry.native_width || it.height !== it.entry.native_height)) throw new Error(`${it.assetId}: ${it.width}x${it.height} != native ${it.entry.native_width ?? "?"}x${it.entry.native_height ?? "?"}`);
      const h = new Handle(it.assetId, it.width, it.height, it.entry, urls.create(it.bytes), urls);
      handles.set(it.assetId, h);
    }
  } catch (err) {
    for (const h of handles.values()) h.dispose();
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
      for (const h of handles.values()) h.dispose();
      disposed = true;
    },
  };
  return Object.freeze(registry);
}

