# UI-B1 — derived UI assets and the fail-closed UI loader

Status: cloud implementation with **synthetic structural tests only**. Real-client UI extraction is DEFERRED_LOCAL.
The profile stays `KRO2021_CLASSIC_V0_FAN` = `DISCOVERED` and the metrics stay `DEFERRED_LOCAL`. No HUD is drawn: the
loader is not imported by `App.tsx` (a static-graph test enforces this).

## Extraction (inside the `assets:extract --profile fan-local` transaction)

All outputs are written to `.local-assets/<data.grf>/v2/` (git-ignored). Each is listed in `manifest.json` with its
SHA-256, size and source provenance, and is served only through the manifest-gated gateway by whitelisted
logical ID.

| UI rows | Derived output |
| --- | --- |
| 104 BMP | `<id>.png`: lossless RGBA, colour key `r>=254 && g<=1 && b>=254` → alpha 0. `<id>.json`: UI-A manifest entry (native size, role, state, slice, source hash), `filter: "nearest"`, keyed-pixel count |
| `ui.cursor.spr` / `ui.cursor.act` | `ui.cursor.spr.png` atlas of every SPR frame. `ui.cursor.spr.json`: frame rects. `ui.cursor.act.json`: the parsed ACT verbatim (actions, frames, layers incl. width/height, anchors, sound indices, the `sounds` table), plus the UI-A hotspot per action |
| `ui.font.scdream4/6` | none. The original bytes are served only by their exact `filesystem:System` logical IDs |
| all 108 | `ui/ui-manifest.json`: the full UI-A manifest; its provenance lists all 108 inputs |

Any UI problem (unreadable source, size or hash drift, malformed file, declared vs native size mismatch, hotspot out
of bounds) throws `SceneExtractionError` with asset ID + container + canonical path. A partial UI extraction leaves no
ready manifest.

## Identity

- `assets:extract` passes the verified `lock.lockId` (from `source-lock.local.json`) and the SHA-256 of the canonical
  whitelist CSV bytes. A wrong value stops extraction (`identity.lockId` / `identity.whitelistSha256`), and nothing is
  published.
- The ready manifest records the identity `{ lockId, whitelistSha256, uiProfileId, uiEntrySetSha256 }`. Every
  per-asset UI file carries the same values.
- The gateway refuses a manifest whose `lockId` is not its verified lock, and reports the identity in `/health`.

## FormalUiAssetLoader (`apps/client/src/game/formal/ui.ts`)

- Accepts only profile `KRO2021_CLASSIC_V0_FAN` and the canonical whitelist hash.
- Before any asset is requested, it checks the gateway's derived identity: converter version, verified lock,
  canonical whitelist, UI profile, and the entry-set hash of the canonical 108-ID registry
  (`asset-contracts/uiRegistry.ts`).
- It checks the whitelist against the registry. Missing, extra or drifted rows are reported with the registry's
  container and path.
- Loads every UI row of the whitelist by logical ID: bitmaps as derived JSON + PNG, the cursor atlas and ACT, and the
  fonts as original bytes with their `OTTO` signature checked.
- For each asset it validates:
  - the converter version and the profile;
  - the entry against the whitelist row: ID, container, path, size, SHA-256;
  - role, state and slice against the UI contract;
  - decoded size against the native size;
  - `filter: "nearest"`;
  - the PNG bytes against the SHA-256 declared in the asset's JSON;
  - the cursor:
    - schema-parsed SPR/ACT;
    - every non-empty layer of every frame of every action references an atlas frame;
    - atlas rects are unique and inside the atlas;
    - hotspots are exactly one per action `0..n-1`, each inside its frame.
- It checks that every declared button state and every slice part has its own asset; nothing is synthesised.
- On any failure it throws `MissingAssetsError` with exact IDs and paths.

## Local commands (Windows, DEFERRED_LOCAL)

```powershell
pnpm assets:verify-sources
pnpm assets:ui-manifest                    # report only (reports/local/)
pnpm assets:extract --profile fan-local    # now also publishes the UI outputs in the same transaction
```

## UI-B2 — verified raster handles and the detached primitive library

Status: synthetic structural tests only. The library is **not** imported by `main.tsx`, `App.tsx`, the formal scene
or the HUD. A static-graph test checks this, and e2e check E confirms the marker
`RO-SURVIVOR-DETACHED-RO-PRIMITIVES` is in no bundle.

- **Verified rasters**:
  - The public module (`apps/client/src/ui/ro/raster.ts`) exposes only read-only handles, a read-only
    `RasterRegistry` and `isVerifiedRaster`. It exports no issuer, no constructible set and no `issue()`.
  - Handles are minted only by `game/formal/rasterMint.ts`, called only from `game/formal/ui.ts`. A static guard
    over every file in `apps/client/src` enforces this. The production loader takes no URL factory: URLs are always
    Blob URLs of the verified bytes.
  - The mint checks each item: canonical registry ID, entry ID, native size, PNG signature, and the SHA-256 of the
    bytes against the declared hash.
  - Before any `await`, each item is snapshotted once: scalars, the declared SHA, a defensive copy of the bytes and
    a frozen clone of the entry. Validation, hashing, the Blob and the handle use only that snapshot, so mutating
    the caller's items while the promise is pending changes nothing that is issued.
  - It works in two phases:
    - all validation and frozen metadata copies are done before any URL exists;
    - a URL failure then revokes every created URL best-effort (continuing past revoke errors) and rethrows the
      original error with `cleanupErrors`. If the original cannot carry them (frozen or non-extensible object, or a
      thrown primitive), it is wrapped in `RasterIssuanceError` with `cause` set to the original.
  - No partial set is returned.
  - Each handle keeps an independent, recursively frozen copy of its UI-A entry. The handle instance, its prototype
    and its class are frozen, so `url`, `disposed` and `dispose` cannot be redefined. The brand set's `has` /
    `add` are bound once when the module loads, so patching `WeakSet.prototype` later cannot forge a brand.
    Post-import tamper model: the module captures at initialisation `Object.freeze` / `isFrozen` /
    `entries` / `isExtensible` / `create`, the canonical-ID `Set.has`, `Array.from`, `URL.createObjectURL` /
    `revokeObjectURL`, the `SubtleCrypto` digest (bound to `crypto.subtle`), `structuredClone`, `Blob`,
    `Uint8Array`, `ArrayBuffer.isView`, `Number.isInteger`, `Symbol.iterator` and `AggregateError`. Item
    bytes are checked at validation time by an import-time pure predicate: `isView` (internal slot), the
    internal `"Uint8Array"` tag via the captured `%TypedArray%.prototype[@@toStringTag]` getter (called
    through a call-binder fixed at import), and a direct prototype (captured `Object.getPrototypeOf`) equal
    to the local `Uint8Array.prototype` captured at import. No `instanceof` / `Symbol.hasInstance` and no
    prototype-chain walk. Ordinary unmodified subclass instances (including `Buffer`), foreign-realm values,
    proxies, array-likes and every non-Uint8 typed array (even re-prototyped) are refused. Caveat:
    JavaScript keeps no observable construction provenance, so a genuine `Uint8Array` from a subclass or
    another realm that has been re-prototyped to the captured local prototype is indistinguishable and
    accepted; byte integrity is unaffected because the bytes are copied internally before validation. Blob parts
    and AggregateError errors are own-iterator iterables, the SHA-256 hex digest is built with indexed
    loops, and the PNG signature check uses a fixed length (never the patchable
    `%TypedArray%.prototype.length` getter), so no Array / String iterator or helper is consulted. Out of scope: a realm compromised before
    this module loads, and the `Promise` / `await` machinery (`Promise.prototype.then` / `constructor`) the
    async mint resolves through. Items are
    snapshotted with indexed loops (only the mint's own snapshots are accepted), and handles / URLs live in
    private chains of object literals, so no `Map`, `Set` or array iterator decides what is branded, what
    `get` / `has` / `ids` return, or what rollback and `dispose` revoke. Arrays (snapshots, `ids()`, cleanup
    errors) are built with the `Array.from` captured at load over a null-prototype array-like, `ids()` is
    ordered by rank, and cleanup errors are collected in a private chain, so `push` / `sort` / iterator
    patches change nothing. `get` / `has` re-check the brand and the exact asset ID.
  - `dispose()` revokes the URL once; double dispose is safe.
  - A disposed, unknown or missing handle raises `MissingAssetsError` with the canonical container and path. Every
    primitive rejects a disposed handle the same way.
- **Primitives** (`apps/client/src/ui/ro/primitives.tsx`). Each has a pure `plan*` function and a component.

  | Primitive | Behaviour |
  | --- | --- |
  | `RoRaster` | One raster at native size × a positive integer scale, pixelated. |
  | `RoThreeSlice` | Three distinct declared left/mid/right parts of one group. Caps keep their native size; only the middle repeats. |
  | `RoButton` | Every declared state must resolve to its own verified raster, otherwise the button blocks. All states must belong to one canonical control (and one slice part). An undeclared state never falls back to another one. |
  | `RoGauge` | The official empty three-slice, plus the official fill three-slice clipped to the clamped ratio. Gauge parts only. |
  | `RoSlot` | A slot/frame raster plus an optional icon raster. The hotkey and count are DOM text only. |

- **Formal visual static guard** (`apps/client/test/visual-guard.ts`):
  - Scope: the primitive dependency graph only, including relative CSS imports and CSS `@import`. Imports resolve
    exact, then `.ts`, `.tsx`, `.css`, `.module.css`, then `index.*`; unresolved imports are reported.
  - Non-relative runtime imports and re-exports must be on a minimal allowlist: preact and the repository's own
    contract packages.
  - Non-relative or remote CSS `@import` is rejected.
  - TS/TSX module structure is read from the TypeScript AST: static imports and re-exports (including minified
    forms), dynamic imports with string or template literals, and inline `type` specifiers. Non-literal
    `import()`/`require()` and `import.meta.glob` are rejected as opaque module loads, both in the graph and across
    all of `apps/client/src`. CSS `@import` is matched case-insensitively.
  - Raster sources are checked on the AST. Any `url(`/`image(` in a string, template part or JSX text, image-loading
    elements (JSX or `h`/`createElement`), `new Image()`, `src`-like attributes, properties, assignments and
    `setAttribute`, and raster style properties with computed values are all rejected. The only accepted source is
    the exact helper `verifiedRasterUrl(raster: VerifiedRaster)` returning
    `` `url("${checkRaster(raster, …).url}")` ``, at most once per graph.
  - Bindings are traced with a per-file TypeScript checker, and anything the guard cannot prove safe is
    rejected:
    - The helper is accepted only as its one top-level declaration in the canonical module
      `ui/ro/primitives.tsx`, whose `VerifiedRaster` is the unaliased import from `./raster.ts` and whose
      `checkRaster` is the local guard that starts with `if (!isVerifiedRaster(r)) throw` (brand imported from
      `./raster.ts`) and returns `r` unchanged: its only `return` anywhere is the final `return r` (no early,
      conditional or nested return, no nested function), and `r` is never reassigned. In a graph, provenance is anchored to the production files:
      the helper must be in the actual `apps/client/src/ui/ro/primitives.tsx`; its sibling must be the actual
      `ui/ro/raster.ts` with `isVerifiedRaster(x) { return isMintedRaster(x); }`; and that import must resolve to
      the actual `game/formal/rasterMint.ts`. There, the exported `isMintedRaster(x)` (one parameter) must
      return exactly the pure predicate `typeof x === "object" && x !== null && mintedHas(x)`, every `x`
      that parameter (no other conjunct, call, assignment or update);
      `mintedHas` must be a top-level `const` bound from `WeakSet.prototype.has` onto a top-level
      `const … = new WeakSet()` with no arguments; both `WeakSet` references must be the ambient global
      (not shadowed); and neither binding may be written. Issuance is loader-only as well: `mintedAdd` must
      be the one top-level `const` bound from the ambient `WeakSet.prototype.add` onto the same set; the set
      may be referenced only by the `has` / `add` binds; and `mintedAdd` may be referenced only once (no
      export, alias or passing), pinned by exact AST shape to the success path of `mintRasterSet`:
      - its nearest function is `mintRasterSet` (no nested helper), and it is the only statement of the
        top-level `for (let link = chain; link !== null; link = link.next) mintedAdd(link.handle);`, where
        every `link` is that loop's own binding, written only by its incrementor;
      - `chain` is the top-level `const chain = issued`, and `issued` is the top-level `let issued = null`,
        read only there and by `next: issued`, and written exactly once: by
        `issued = { handle: new Handle(it.assetId, it.width, it.height, it.entry, url), next: issued }` in
        the issuance loop, which is the only statement of the top-level `try` block;
      - `it` is `prepared[<that loop's index>]`, `url` is `createUrl(it.bytes)`, `Handle` is the module's
        class, and `prepared` is `freeze(list)` with `freeze` the captured `Object.freeze` and
        `list = makeArray(count, (i) => snapshot(…))` (never written). Every callee on this path is
        resolved by declaration identity, never by name: `createUrl` must be the module-level
        `const createUrl = (bytes) => urlCreate(new BlobCtor(ownIterable([bytes]), { type: "image/png" }))`
        as a plain arrow (no `async`, no type parameters) with exactly one plain parameter (no rest /
        default / optional / destructuring), `urlCreate` the
        captured ambient `URL.createObjectURL`, `BlobCtor` the captured ambient `Blob`, Blob options exactly
        the inert literal `{ type: "image/png" }`, and `ownIterable` the module's never-written function whose
        whole body is AST-locked (it yields exactly its `values` argument, keyed by the module's
        `const ITERATOR = Symbol.iterator`; its iterator factory and `next` are plain non-`async`,
        non-generic arrows), so a local shadow of `createUrl` (or of any of these) does not qualify;
      - no `handle` / `next` property is ever written anywhere in the module;
      - `Handle` is locked by exact AST allowlist: no `extends`, no decorators; exactly the fields
        `readonly assetId / width / height / entry` and `#url` (no initialisers); a constructor with five
        plain parameters whose body is exactly the five field assignments and `freeze(this)` (captured
        `Object.freeze`), so it has no `return` anywhere; `get url()` that throws exactly
        `new Error(\`raster ${this.assetId} was disposed\`)` (ambient `Error`, one span bound to
        `this.assetId`) when disposed and otherwise returns `this.#url`; `get disposed()`; `dispose()` revoking through the module's `revokeUrl` (a plain
        non-`async`, non-generic arrow with one plain parameter passed unchanged to the captured
        `URL.revokeObjectURL`); nothing else. `freeze(Handle.prototype)` and `freeze(Handle)` are top-level,
        and nothing in the module writes the `Handle` binding (any assignment operator, `++` / `--`,
        destructuring, for-in / for-of) or anything reached through it.
      The module's value exports must equal exactly {`isMintedRaster`, `mintRasterSet`,
      `RasterIssuanceError`} — none missing, none extra (`MintItem` is a type); `export *`, `export default`
      and any value re-export fail. Any look-alike tree (nested `ui/ro`, fake loader) is `raster-brand-provenance`. Every other
      use of the name must be a direct call resolving to that declaration; any other binding, shadow, alias,
      import, re-export, mutation or reference is `raster-helper-binding`.
    - Element factories imported from preact / react are capabilities: only a direct call with an
      allowlisted intrinsic tag (`div`, `span`, `button`) and static props is accepted. Aliases, comma /
      call / apply / bind, passing, returning, exporting, namespace / default imports, re-exports and
      `cloneElement` are `opaque-element-tag` / `opaque-element-props`.
    - JSX tags are allowlisted intrinsics or a function declared at the top level of the same file and never
      reassigned. Mutating any function, class or import binding is `binding-mutation`.
    - Every assignment operator and `++` / `--` on `src`, `srcset`, `poster` or a raster-style property is
      rejected; only a plain `=` of a literal to a style property is accepted.
    - Setter capabilities (`setAttribute*`, `setProperty`, `defineProperty`, `defineProperties`, `assign`,
      `setPrototypeOf`, `cssText`, …) are banned outright: member, string name, alias, destructuring and call /
      apply / bind are all `setter-capability`.
    - One shared assignment-target walker covers every write: all assignment operators, `++` / `--`, array /
      object destructuring at any depth, defaults, spreads, for-in / for-of targets and `delete`. Unknown
      target shapes are `opaque-assignment-target`. The same walker decides whether the helper's guard
      parameter is ever written.
    - Every element access (read, write, call, alias) and computed key needs a provable key: a constant string
      (literals, no-substitution templates and `+` of constants, checked against setter, source and dangerous
      names), a number, a union of safe string-literal types, or the captured `Symbol.iterator`.
    - Restricted namespace globals (`Object`, `Array`, `Number`, `URL`, `crypto`, `Symbol`, `ArrayBuffer`) are
      usable only as `G.<allowed member>`; aliases such as `const O = Object` fail closed. Callable globals
      may be called, constructed, used with `instanceof` / `extends`, or captured in a top-level `const`.
    - Free identifiers must be allowlisted globals, and only allowlisted members of them (`unknown-global:*`,
      `unknown-global-member:*`).
    - Dynamic computed keys, element-access writes and deletes (every assignment operator), dynamic
      `defineProperty` / `setAttribute` / `setProperty` names, reflective members (`constructor`, `__proto__`),
      object and JSX spreads, and string literals naming sources, HTML sinks or factories all fail closed.
  - Comments are removed with the TypeScript parser; CSS loses block comments only outside strings. `//` inside a
    string, regex or JSX text is kept.
  - Every path the guard reports is POSIX `/` on Windows and Linux.
  - It rejects:
    - gradients, border-radius, shadows, CSS border surfaces, pseudo-elements;
    - CSS colour fills, filter/opacity state synthesis;
    - inline SVG, emoji, icon fonts;
    - canvas/WebGL textures;
    - network or gateway access;
    - placeholder or synthetic imports.
  - Each family has its own positive and negative fixture.
