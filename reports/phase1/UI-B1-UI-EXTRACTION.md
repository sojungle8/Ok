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
  - Each handle keeps an independent, recursively frozen copy of its UI-A entry.
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
  - Every path the guard reports is POSIX `/` on Windows and Linux.
  - It rejects:
    - gradients, border-radius, shadows, CSS border surfaces, pseudo-elements;
    - CSS colour fills, filter/opacity state synthesis;
    - inline SVG, emoji, icon fonts;
    - canvas/WebGL textures;
    - network or gateway access;
    - placeholder or synthetic imports.
  - Each family has its own positive and negative fixture.
