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
 * Raised instead of the original issuance error when rollback produced cleanup errors that cannot be
 * attached to it (a frozen / non-extensible object, or a thrown primitive). `cause` is the original.
 */
export class RasterIssuanceError extends Error {
  readonly cleanupErrors: readonly unknown[];
  constructor(cause: unknown, cleanupErrors: readonly unknown[]) {
    super(`raster issuance failed: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
    this.name = "RasterIssuanceError";
    this.cleanupErrors = cleanupErrors;
  }
}

/** The error to rethrow after rollback: never loses the original error / value or any cleanup error. */
function withCleanupErrors(err: unknown, cleanupErrors: unknown[]): unknown {
  if (cleanupErrors.length === 0) return err;
  if (err !== null && (typeof err === "object" || typeof err === "function")) {
    try {
      if (Object.isExtensible(err)) {
        Object.defineProperty(err, "cleanupErrors", { value: cleanupErrors, enumerable: true, configurable: true, writable: false });
        return err;
      }
    } catch {
      // not safely attachable (proxy trap, existing non-configurable property): wrap instead
    }
  }
  return new RasterIssuanceError(err, cleanupErrors);
}

/** Immutable, independent snapshot of one item, taken synchronously before any await. */
interface Prepared {
  readonly assetId: string;
  readonly width: number;
  readonly height: number;
  readonly sha256: string;
  readonly bytes: Uint8Array;
  readonly entry: Readonly<UiManifestEntry>;
}

function snapshot(it: MintItem): Prepared {
  // Each caller-visible field is read exactly once; later validation never looks at `it` again.
  const { assetId, width, height, sha256, bytes, entry } = it;
  if (typeof assetId !== "string" || typeof sha256 !== "string" || typeof width !== "number" || typeof height !== "number") throw new Error("raster item has malformed scalars");
  if (!(bytes instanceof Uint8Array)) throw new Error(`${assetId}: bytes are not a Uint8Array`);
  return Object.freeze({ assetId, width, height, sha256, bytes: new Uint8Array(bytes), entry: deepFreeze(structuredClone(entry)) });
}

/**
 * Issue every handle as one transaction:
 * 0. synchronously (before any await) snapshot every item: scalars, declared SHA, a defensive copy of
 *    the bytes and an independent frozen copy of the entry — mutating the caller's items while the
 *    promise is pending cannot change what is validated, hashed, put in a Blob or issued;
 * 1. validate every snapshot (canonical ID, entry ID, size, PNG signature, SHA-256 of the bytes) — no
 *    URL exists yet, so a failure here leaks nothing;
 * 2. create the URLs from the snapshots; if any creation fails, every URL already created is revoked
 *    best-effort (each exactly once, continuing past revoke errors). The original error / value is
 *    rethrown with `cleanupErrors` attached, or, when it cannot carry them, wrapped in a
 *    RasterIssuanceError (`cause` = original). A partial registry is never returned.
 */
export async function mintRasterSet(items: readonly MintItem[]): Promise<RasterRegistry> {
  const prepared: readonly Prepared[] = Object.freeze(Array.from(items, snapshot));
  const seen = new Set<string>();
  for (const it of prepared) {
    if (!canonicalIds.has(it.assetId)) throw new Error(`${it.assetId} is not in the canonical UI registry`);
    if (it.entry.logical_asset_id !== it.assetId) throw new Error(`entry is for ${it.entry.logical_asset_id}, not ${it.assetId}`);
    if (seen.has(it.assetId)) throw new Error(`raster ${it.assetId} issued twice`);
    seen.add(it.assetId);
    if (!Number.isInteger(it.width) || !Number.isInteger(it.height) || it.width < 1 || it.height < 1) throw new Error(`${it.assetId}: bad size ${it.width}x${it.height}`);
    if (it.entry.format === "bmp" && (it.width !== it.entry.native_width || it.height !== it.entry.native_height)) throw new Error(`${it.assetId}: ${it.width}x${it.height} != native ${it.entry.native_width ?? "?"}x${it.entry.native_height ?? "?"}`);
    if (!PNG_SIGNATURE.every((b, i) => it.bytes[i] === b)) throw new Error(`${it.assetId}: bytes are not a PNG`);
  }
  for (const it of prepared) {
    const got = await sha256Upper(it.bytes);
    if (got !== it.sha256.toUpperCase()) throw new Error(`${it.assetId}: PNG SHA-256 ${got} != declared ${it.sha256}`);
  }
  const created: string[] = [];
  const handles = new Map<string, Handle>();
  try {
    for (const it of prepared) {
      const url = createUrl(it.bytes);
      created.push(url);
      handles.set(it.assetId, new Handle(it.assetId, it.width, it.height, it.entry, url));
    }
  } catch (err) {
    throw withCleanupErrors(err, revokeAll(created));
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
