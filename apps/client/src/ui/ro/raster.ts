/**
 * UI-B2 — verified raster handles. A handle can only be issued by the FormalUiAssetLoader after the
 * UI-B1 identity / hash / schema / dimension checks; primitives accept nothing else (no URLs, no paths,
 * no gateway access). Handles own a browser object URL and are disposed deterministically.
 */
import { UI_REGISTRY } from "@ro-survivor/asset-contracts";
import type { UiManifestEntry } from "@ro-survivor/content-schema";
import { MissingAssetsError } from "../../game/requirements.ts";

export const RO_PRIMITIVES_MODULE_MARKER = "RO-SURVIVOR-DETACHED-RO-PRIMITIVES";

export interface VerifiedRaster {
  readonly assetId: string;
  readonly width: number;
  readonly height: number;
  /** Exact UI-A manifest entry of the source (container, canonical path, hash, role, state, slice). */
  readonly entry: UiManifestEntry;
  /** Object URL owned by this handle; throws once disposed. */
  readonly url: string;
  readonly disposed: boolean;
}

/** Creates / revokes the browser URL for verified PNG bytes (injectable for tests). */
export interface RasterUrlFactory {
  create(bytes: Uint8Array): string;
  revoke(url: string): void;
}

export const browserRasterUrls: RasterUrlFactory = {
  create: (bytes) => URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "image/png" })),
  revoke: (url) => URL.revokeObjectURL(url),
};

const issued = new WeakSet<object>();

class Handle implements VerifiedRaster {
  readonly assetId: string;
  readonly width: number;
  readonly height: number;
  readonly entry: UiManifestEntry;
  #url: string | null;
  readonly #urls: RasterUrlFactory;

  constructor(assetId: string, width: number, height: number, entry: UiManifestEntry, url: string, urls: RasterUrlFactory) {
    this.assetId = assetId;
    this.width = width;
    this.height = height;
    this.entry = entry;
    this.#url = url;
    this.#urls = urls;
  }

  get url(): string {
    if (this.#url === null) throw new Error(`raster ${this.assetId} was disposed`);
    return this.#url;
  }

  get disposed(): boolean {
    return this.#url === null;
  }

  dispose(): void {
    if (this.#url === null) return; // double dispose is a no-op
    this.#urls.revoke(this.#url);
    this.#url = null;
  }
}

/** True only for handles issued by a VerifiedRasterSet (not a look-alike object). */
export function isVerifiedRaster(x: unknown): x is VerifiedRaster {
  return typeof x === "object" && x !== null && issued.has(x);
}

/** Missing / unknown logical ID → blocking error with the canonical registry container and path. */
export function missingRaster(assetId: string, reason: string): MissingAssetsError {
  const reg = UI_REGISTRY.find((e) => e[0] === assetId);
  return new MissingAssetsError([{ assetId, container: reg?.[2] ?? "unknown", canonicalPath: reg?.[3] ?? "(not in the canonical UI registry)", reason }]);
}

export class VerifiedRasterSet {
  readonly #handles = new Map<string, Handle>();
  readonly #urls: RasterUrlFactory;
  #disposed = false;

  constructor(urls: RasterUrlFactory) {
    this.#urls = urls;
  }

  /** Loader-only: issue a handle for bytes that already passed every UI-B1 check. */
  issue(assetId: string, bytes: Uint8Array, width: number, height: number, entry: UiManifestEntry): VerifiedRaster {
    if (this.#disposed) throw new Error("raster set already disposed");
    if (entry.logical_asset_id !== assetId) throw new Error(`entry is for ${entry.logical_asset_id}, not ${assetId}`);
    if (this.#handles.has(assetId)) throw new Error(`raster ${assetId} issued twice`);
    const h = new Handle(assetId, width, height, entry, this.#urls.create(bytes), this.#urls);
    issued.add(h);
    this.#handles.set(assetId, h);
    return h;
  }

  get(assetId: string): VerifiedRaster {
    const h = this.#handles.get(assetId);
    if (!h || h.disposed) throw missingRaster(assetId, h ? "verified raster was disposed" : "no verified raster for this logical ID");
    return h;
  }

  has(assetId: string): boolean {
    return this.#handles.get(assetId)?.disposed === false;
  }

  ids(): string[] {
    return [...this.#handles.keys()].sort();
  }

  /** Revoke every URL; safe to call more than once. */
  dispose(): void {
    for (const h of this.#handles.values()) h.dispose();
    this.#disposed = true;
  }
}
