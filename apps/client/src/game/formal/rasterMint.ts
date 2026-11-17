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
// R4-1: bind the brand set's has / add once at module initialisation. Later calls go through these
// sealed closures only, so patching WeakSet.prototype afterwards cannot forge or hide a brand.
const mintedHas: (x: object) => boolean = WeakSet.prototype.has.bind(minted);
const mintedAdd: (x: object) => WeakSet<object> = WeakSet.prototype.add.bind(minted);
// R4-1: the integrity primitives handles depend on, captured at module initialisation so a later
// `Object.freeze = (x) => x` (or isFrozen / entries patch) cannot yield an unfrozen branded handle.
const freeze: <T>(v: T) => Readonly<T> = Object.freeze;
const isFrozen: (v: object) => boolean = Object.isFrozen;
// snapshots made by `snapshot()`; a patched Array.prototype.push cannot slip other objects into a mint
const snapshots = new WeakSet<object>();
const snapshotHas: (x: object) => boolean = WeakSet.prototype.has.bind(snapshots);
const snapshotAdd: (x: object) => WeakSet<object> = WeakSet.prototype.add.bind(snapshots);
// bound at initialisation: a later Set.prototype.has patch cannot admit a non-canonical ID
const isCanonicalId: (id: string) => boolean = Set.prototype.has.bind(new Set(UI_REGISTRY.map((e) => e[0])));
const PNG_SIGNATURE = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const PNG_SIGNATURE_LENGTH = 8;
// Array construction without Array.prototype: the captured Array.from over a null-prototype array-like
// creates its result with intrinsic ArrayCreate / CreateDataProperty — no push, no iterator, no
// prototype setter is consulted.
const arrayFrom = Array.from as <T>(like: ArrayLike<unknown>, map: (v: unknown, i: number) => T) => T[];
const createObject: (proto: null) => object = Object.create;

/** A fresh array of `n` values `at(0) … at(n - 1)`, built without any patchable array method. */
function makeArray<T>(n: number, at: (i: number) => T): T[] {
  const like = createObject(null) as { length: number };
  like.length = n;
  return arrayFrom(like, (_v, i) => at(i));
}

/** A private singly-linked chain (newest first) built from object literals (own data properties). */
interface Chain<T> {
  readonly value: T;
  readonly next: Chain<T> | null;
}
function chainLength(c: Chain<unknown> | null): number {
  let n = 0;
  for (let l = c; l !== null; l = l.next) n += 1;
  return n;
}
/** The chain's values, oldest first. */
function chainToArray<T>(c: Chain<T> | null): T[] {
  const n = chainLength(c);
  return makeArray(n, (i) => {
    let l = c;
    for (let k = n - 1; k > i && l !== null; k -= 1) l = l.next;
    return (l as Chain<T>).value;
  });
}

/** Brand check used by `isVerifiedRaster` (no minting capability). */
export function isMintedRaster(x: unknown): boolean {
  return typeof x === "object" && x !== null && mintedHas(x);
}

// Security-critical platform capabilities, captured at module initialisation: patching URL, Blob,
// SubtleCrypto.prototype.digest, structuredClone, Uint8Array, ArrayBuffer.isView, Number.isInteger or
// Symbol.iterator afterwards changes nothing the mint does.
// URL.createObjectURL / revokeObjectURL and ArrayBuffer.isView are static operations that ignore `this`.
// eslint-disable-next-line @typescript-eslint/unbound-method -- static operation, captured on purpose
const urlCreate: (blob: Blob) => string = URL.createObjectURL;
// eslint-disable-next-line @typescript-eslint/unbound-method -- static operation, captured on purpose
const urlRevoke: (url: string) => void = URL.revokeObjectURL;
const BlobCtor = Blob;
const subtle = crypto.subtle;
const digest: (algorithm: string, data: Uint8Array<ArrayBuffer>) => Promise<ArrayBuffer> = subtle.digest.bind(subtle);
const clone: <T>(v: T) => T = structuredClone;
const U8 = Uint8Array;
// eslint-disable-next-line @typescript-eslint/unbound-method -- static operation, captured on purpose
const isView: (v: unknown) => boolean = ArrayBuffer.isView;
// Import-time pure, validation-time byte predicate. It never consults mutable constructor properties
// later (no instanceof / Symbol.hasInstance) and never walks a prototype chain (so no caller-controlled
// getPrototypeOf trap runs). At validation time the value must be a typed array by internal slot
// (isView), carry the internal "Uint8Array" tag (the captured %TypedArray%.prototype[@@toStringTag]
// getter, called through a call-binder fixed at import), and have as its *direct* prototype — read with
// the captured Object.getPrototypeOf on the typed array, an ordinary object — the local
// Uint8Array.prototype captured at import. Ordinary unmodified subclass instances (e.g. Buffer) and
// foreign-realm values, proxies, array-likes and every non-Uint8 typed array (even re-prototyped) are
// refused. Caveat: JavaScript keeps no observable construction provenance, so a genuine Uint8Array from
// a subclass or another realm that has been re-prototyped to the captured local prototype is
// indistinguishable and accepted; byte integrity still holds, since the bytes are copied internally.
const getProto: (v: object) => object | null = Object.getPrototypeOf;
const U8_PROTO: object = Uint8Array.prototype;
// eslint-disable-next-line @typescript-eslint/unbound-method -- Function.prototype.call is the bind target on purpose (import-time call-binder)
const callBinder = Function.prototype.bind.bind(Function.prototype.call) as <T, R>(fn: (this: T) => R) => (self: T) => R;
// eslint-disable-next-line @typescript-eslint/unbound-method -- the @@toStringTag getter is uncurried by callBinder on purpose
const typedArrayTag = callBinder((Object.getOwnPropertyDescriptor(getProto(U8_PROTO) as object, Symbol.toStringTag) as PropertyDescriptor).get as (this: unknown) => string | undefined);
function isGenuineUint8Array(v: unknown): v is Uint8Array {
  return isView(v) && typedArrayTag(v) === "Uint8Array" && getProto(v as object) === U8_PROTO;
}
const isInteger: (v: unknown) => boolean = Number.isInteger;
const ITERATOR: typeof Symbol.iterator = Symbol.iterator;
const ownEntries: (v: object) => [string, unknown][] = Object.entries;
const isExtensible: (v: object) => boolean = Object.isExtensible;
const AggregateErrorCtor = AggregateError;
const HEX = "0123456789ABCDEF";
const HEX_LOWER = "0123456789abcdef";

/**
 * An iterable over `values` with its own iterator and own `next` (object literals, own data properties):
 * consumers such as the Blob constructor or AggregateError never consult Array.prototype[Symbol.iterator]
 * or %ArrayIteratorPrototype%.
 */
function ownIterable<T>(values: readonly T[]): Iterable<T> {
  const n = values.length;
  return {
    [ITERATOR]: () => {
      let i = 0;
      return {
        next: () => {
          if (i >= n) return { value: undefined, done: true };
          const value = values[i] as T;
          i += 1;
          return { value, done: false };
        },
      };
    },
  } as Iterable<T>;
}

/** An own-iterator iterable yielding a private chain's values oldest first (no array in between). */
function chainIterable<T>(c: Chain<T> | null): Iterable<T> {
  const n = chainLength(c);
  return {
    [ITERATOR]: () => {
      let i = 0;
      return {
        next: () => {
          if (i >= n) return { value: undefined, done: true };
          let l = c;
          for (let k = n - 1; k > i && l !== null; k -= 1) l = l.next;
          i += 1;
          return { value: (l as Chain<T>).value, done: false };
        },
      };
    },
  } as Iterable<T>;
}

/** Trusted, fixed URL source: a Blob URL of exactly the verified PNG bytes (captured Blob / URL, own-iterator parts). */
const createUrl = (bytes: Uint8Array): string => urlCreate(new BlobCtor(ownIterable([bytes]) as unknown as BlobPart[], { type: "image/png" }));
const revokeUrl = (url: string): void => urlRevoke(url);

function deepFreeze<T>(v: T): T {
  if (v && typeof v === "object" && !isFrozen(v)) {
    freeze(v);
    const pairs = ownEntries(v);
    for (let i = 0; i < pairs.length; i += 1) deepFreeze((pairs[i] as [string, unknown])[1]);
  }
  return v;
}

/** SHA-256 as 64 uppercase hex digits, via the captured digest and manual hex (no array / string helpers). */
async function sha256Upper(bytes: Uint8Array): Promise<string> {
  const d = new U8(await digest("SHA-256", bytes as Uint8Array<ArrayBuffer>));
  let s = "";
  for (let i = 0; i < 32; i += 1) {
    const b = d[i] as number;
    s += (HEX[b >> 4] as string) + (HEX[b & 15] as string);
  }
  return s;
}

/** `s` as 64 uppercase hex digits, or null when it is not a 64-digit hex string (no string helpers). */
function upperHex(s: string): string | null {
  if (s.length !== 64) return null;
  let out = "";
  for (let i = 0; i < 64; i += 1) {
    const c = s[i] as string;
    let hit: string | null = null;
    for (let k = 0; k < 16; k += 1) if (c === HEX[k] || c === HEX_LOWER[k]) hit = HEX[k] as string;
    if (hit === null) return null;
    out += hit;
  }
  return out;
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
    freeze(this); // captured at import, not the current Object.freeze
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
// R4-1: the accessors that make a handle trustworthy (`url`, `disposed`, `dispose`) live on the
// prototype; freeze it (and the class) so a caller cannot redefine them on a branded handle.
freeze(Handle.prototype);
freeze(Handle);

export interface MintItem {
  assetId: string;
  bytes: Uint8Array;
  /** SHA-256 the per-asset JSON declared for these PNG bytes. */
  sha256: string;
  width: number;
  height: number;
  entry: UiManifestEntry;
}

/** URLs created by the current mint (newest first), chained through object literals. */
interface UrlLink {
  readonly url: string;
  readonly next: UrlLink | null;
}

/**
 * Revoke every URL best-effort by walking the private chain (no patchable array / Map iterator decides
 * which URLs are revoked); returns the errors instead of stopping at the first one.
 */
function revokeChain(urls: UrlLink | null, errors: Chain<unknown> | null): Chain<unknown> | null {
  if (urls === null) return errors;
  let e = revokeChain(urls.next, errors); // oldest first: each URL exactly once, continuing past errors
  try {
    revokeUrl(urls.url);
  } catch (err) {
    e = { value: err, next: e };
  }
  return e;
}
const revokeAll = (urls: UrlLink | null): unknown[] => chainToArray(revokeChain(urls, null));

/** Dispose every handle of a chain, oldest first, continuing past errors (collected in a private chain). */
function disposeChain(link: IssuedLink | null, errors: Chain<unknown> | null): Chain<unknown> | null {
  if (link === null) return errors;
  let e = disposeChain(link.next, errors);
  try {
    link.handle.dispose();
  } catch (err) {
    e = { value: err, next: e };
  }
  return e;
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
      if (isExtensible(err)) {
        // plain assignment (no reflective property definition in the formal graph), then verified
        (err as { cleanupErrors?: unknown }).cleanupErrors = cleanupErrors;
        if ((err as { cleanupErrors?: unknown }).cleanupErrors === cleanupErrors) return err;
      }
    } catch {
      // not safely attachable (proxy trap, read-only / accessor property): wrap instead
    }
  }
  return new RasterIssuanceError(err, cleanupErrors);
}

/** One handle constructed by the current mint (newest first). */
interface IssuedLink {
  readonly handle: Handle;
  readonly next: IssuedLink | null;
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
  // a real typed array (isView: internal slot, so no proxy / array-like) of the captured Uint8Array: the
  // copy below then uses the internal element copy, not an iterator
  if (!isGenuineUint8Array(bytes)) throw new Error(`${assetId}: bytes are not a Uint8Array`);
  const s = freeze({ assetId, width, height, sha256, bytes: new U8(bytes), entry: deepFreeze(clone(entry)) });
  snapshotAdd(s);
  return s;
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
  // indexed over the caller's array (no iterator); every element must be a snapshot made here
  const count = items.length;
  const list = makeArray(count, (i) => snapshot(items[i] as MintItem));
  if (list.length !== count) throw new Error("raster snapshot is incomplete");
  for (let i = 0; i < count; i += 1) if (!snapshotHas(list[i] as object)) throw new Error("raster snapshot was replaced");
  const prepared: readonly Prepared[] = freeze(list);
  // indexed loops over the frozen snapshot array: no (patchable) array iterator, Set or Map decides
  // what is validated, hashed or issued
  for (let i = 0; i < count; i += 1) {
    const it = prepared[i] as Prepared;
    if (!isCanonicalId(it.assetId)) throw new Error(`${it.assetId} is not in the canonical UI registry`);
    if (it.entry.logical_asset_id !== it.assetId) throw new Error(`entry is for ${it.entry.logical_asset_id}, not ${it.assetId}`);
    for (let j = 0; j < i; j += 1) if ((prepared[j] as Prepared).assetId === it.assetId) throw new Error(`raster ${it.assetId} issued twice`);
    if (!isInteger(it.width) || !isInteger(it.height) || it.width < 1 || it.height < 1) throw new Error(`${it.assetId}: bad size ${it.width}x${it.height}`);
    if (it.entry.format === "bmp" && (it.width !== it.entry.native_width || it.height !== it.entry.native_height)) throw new Error(`${it.assetId}: ${it.width}x${it.height} != native ${it.entry.native_width ?? "?"}x${it.entry.native_height ?? "?"}`);
    // fixed length: %TypedArray%.prototype.length is a patchable getter, so it is never read here
    for (let k = 0; k < PNG_SIGNATURE_LENGTH; k += 1) if (it.bytes[k] !== PNG_SIGNATURE[k]) throw new Error(`${it.assetId}: bytes are not a PNG`);
  }
  for (let i = 0; i < count; i += 1) {
    const it = prepared[i] as Prepared;
    const got = await sha256Upper(it.bytes);
    if (got !== upperHex(it.sha256)) throw new Error(`${it.assetId}: PNG SHA-256 ${got} != declared ${it.sha256}`);
  }
  // URLs and handles actually created here, chained through object literals (own data properties: no
  // prototype setter, array / Map iterator or Map get / set in between). The brand, every lookup,
  // rollback and dispose use exactly these chains.
  let created: UrlLink | null = null;
  let issued: IssuedLink | null = null;
  try {
    for (let i = 0; i < count; i += 1) {
      const it = prepared[i] as Prepared;
      const url = createUrl(it.bytes);
      created = { url, next: created };
      issued = { handle: new Handle(it.assetId, it.width, it.height, it.entry, url), next: issued };
    }
  } catch (err) {
    throw withCleanupErrors(err, revokeAll(created));
  }
  const chain = issued;
  for (let link = chain; link !== null; link = link.next) mintedAdd(link.handle);
  /** The handle issued for `assetId` by this mint: it must carry the brand and that exact ID (fail closed). */
  const find = (assetId: string): Handle | null => {
    for (let link = chain; link !== null; link = link.next) {
      const h = link.handle;
      if (h.assetId === assetId) return mintedHas(h) ? h : null;
    }
    return null;
  };
  let disposed = false;
  const registry: RasterRegistry = {
    get(assetId) {
      const h = find(assetId);
      if (!h || h.disposed) throw missing(assetId, h ? "verified raster was disposed" : "no verified raster for this logical ID");
      return h;
    },
    has: (assetId) => find(assetId)?.disposed === false,
    // sorted by rank (IDs are unique): position i holds the ID that exactly i other IDs sort before —
    // no push / sort / iterator involved
    ids: () =>
      makeArray(count, (i) => {
        for (let l = chain; l !== null; l = l.next) {
          let rank = 0;
          for (let m = chain; m !== null; m = m.next) if (m.handle.assetId < l.handle.assetId) rank += 1;
          if (rank === i) return l.handle.assetId;
        }
        throw new Error("raster registry is inconsistent");
      }),
    get disposed() {
      return disposed;
    },
    dispose() {
      disposed = true;
      const errors = disposeChain(chain, null);
      if (errors !== null) {
        // the constructor would iterate `errors` (patchable array iterator); set the own data property instead
        // captured constructor, own-iterator iterable over the private error chain: no array iterator
        throw new AggregateErrorCtor(chainIterable(errors), "some raster URLs could not be revoked");
      }
    },
  };
  return freeze(registry);
}
