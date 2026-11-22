# Changelog

## Unreleased — original assets, RO UI and D-032 skills (2026-11-17–18)

- Phase 3.2.6 soak: browser check G plays three consecutive autoplay runs on the test-fixture build and, at each
  results screen, compares the live renderer's GPU counters and the post-GC JS heap. Evidence
  `reports/phase3/soak-three-runs.json`: 15 geometries / 13 textures / 4 programs every run, heap 10.7 MB flat.
  The formal real-asset soak and the iPhone three-run gate remain `DEFERRED_LOCAL`.
- Phase 3.3 offline app shell: builds emit `manifest.webmanifest` and a generated `sw.js` that precaches only the
  built HTML/JS/CSS/manifest (versioned by build ID) and passes every other request — gateway, GRF, derived and
  local RO data — straight to the network. New versions install in the background and apply at the next launch;
  a running game is never reloaded. New browser check F proves an offline reload of the formal build with a
  shell-only cache. Coarse-pointer devices render at most 1.5× DPR (desktop 2×). The manifest has no icon yet
  (an installable icon needs a rights decision), so the shell works offline but is not yet installable.
- D032-E5 Provoke STR: a strict clean-room STR 0x94 parser (`@ro-survivor/ro-format-runtime/str`; bounded counts,
  finite floats, printable-ASCII names, exact length) plus a pure playback sampler. The formal client fetches the
  whitelisted `provoke.str` bytes, verifies size and SHA-256 against the whitelist, parses them and resolves every
  layer texture to a required verified effect texture; Provoke now plays the original STR layers (2 bounded slots)
  with its three BMP dependencies instead of the interim composition. The converter record stays source-only (no
  converter bump, no re-extraction). Real-client visual parity is `DEFERRED_LOCAL`.
- D-032 five-scenario balance: `pnpm slice:scenarios` warms each build up on the real stage to level 10, then runs its
  drafted kit through five isolated, seeded scenarios (clear 60 normals, MVP 60 s, survival 50-mob ring, waypoint
  mobility, control) over 30 unique seeds; `slice:acceptance:check` recomputes the rows digest and gates (no crash,
  equal budget, clear/MVP relative floors, survival ≥ 90 %, course completion). Low control coverage is recorded
  as a finding. No gameplay number changed.
- D032-E4 Provoke: three verified original-RO BMP-derived sources (`explosive_1_128` 128×128 8bpp,
  `piero` 64×64 24bpp, `pika01` 16×16 8bpp, RO color key) drive a clean-room cue at the public cast origin: a
  flat shockwave scaled to the authoritative circle radius, a mark pop and six outward sparks. The original
  `provoke.str` stays source-only and is never drawn. Lanes of 2 / 2 / 12, 640 ms presentation-only lifetime,
  same fail-closed and rollback/dispose rules. No skill number or simulation state changed; real-local evidence
  is `DEFERRED_LOCAL`.
- D032-E3 Magnum Break: two verified original-RO TGA-derived sources (`ring_yellow` 64×64, `대폭발` explosion
  128×128, 32-bit source-alpha) drive a clean-room burst anchored at the public cast origin: a flat ground ring
  expanding to the authoritative circle radius plus a camera-facing flash. One cue per cast geomId (never
  replayed), two long-lived lanes of 4 cues, 520 ms presentation-only lifetime, same fail-closed TGA contract
  and rollback/dispose rules as Bash. No skill number or simulation state changed; real-local evidence is
  `DEFERRED_LOCAL`.
- D032-E2 Bash: four verified original-RO TGA-derived sources (`alpha_down` 64×64, `alpha_center` 32×32,
  `lens1`/`lens2` 32×128, 32-bit source-alpha) drive a clean-room layered impact anchored on every positioned
  authoritative Bash hit with the cast geomId (rank 3 draws both targets); one bounded fallback only without a
  positioned hit. Four long-lived instanced lanes of 16 cues (≤64 planes), 360 ms presentation-only lifetime,
  geomId + target replay protection, rollback of earlier lanes on partial construction, idempotent dispose. Format,
  bpp, alpha, dimensions, derived size, SHA-256 presence, canonical path and byte-size drift fail closed. No
  skill number, simulation state or whitelist row changed; real-local four-viewport evidence is `DEFERRED_LOCAL`.
- PUBLIC-REF-A adds strict legacy-v1/current-v2 public-reference schemas and an append-only offline gate for the
  hash-locked integration plan, two snapshots, two ledger segments and 33 observations. It compares worktree and
  staged Git bytes, rejects duplicate JSON keys, unsafe URLs/text/paths, unresolved or mis-sourced variant conflicts
  and runtime imports, and now runs from `ci:local`, GitHub Actions and the handoff validator. It changes no gameplay,
  balance or RO asset rule.
- Canonical whitelist v5: adds the 12 verified original KRO visual sources needed by the five Swordsman effects
  (7 type-2 BGRA TGA, 1 STR animation and 4 BMP) for 300 rows total, SHA-256
  `ECE20DDDD09A4868CE9264B04E2DC602EA947F6C19929E49E81C1FCF5FBF480A`. The strict TGA decoder accepts only
  the exact pinned subset and the real-local source audit passes 300/300; no RO binary or derived image is committed.
- Original-effect pipeline v3 derives 12 fail-closed metadata records and 11 local-only PNGs from those verified
  sources; the unparsed STR stays explicitly source-only. Shield Wave is the first connected formal effect: its
  verified 64×64 Shield Boomerang bitmap follows authoritative cast/hit geometry in one bounded instanced renderer
  (10 per cast, 32 total). The four-viewport local gate observes three rendered instances and an actual hit in each run.
- Endure is the second connected canonical-v5 formal effect. Its verified original 64×64, 32-bit source-alpha TGA
  follows the current player in one bounded slot; a newer deterministic Endure event refreshes that slot. The
  independently implemented 900 ms pulse/fade is presentation-only and does not add or redefine a gameplay buff
  duration, damage or balance rule. The four-viewport real-local gate observes the exact source, one active instance
  and expiry back to zero.
- Formal character selection now previews the locally derived original four-layer male Swordsman idle animation
  (body, hair, sword and guard) before loading the map. Its ten sources, palette/layer contract, atlas hash, decoded
  dimensions and 96×108 crop all fail closed; missing or clipped original frames never receive a substitute.
- Formal mobile control now places the four verified original `ui.arrow.*` rasters inside the existing 120×120
  touch region at 2× integer scale. It appears only for coarse pointers, remains hidden on desktop and adds no
  CSS/SVG/Canvas substitute surface. Skill and keystone choices now use player-facing Traditional Chinese RO names
  and effect labels instead of leaking internal IDs such as `magnum_break`.
- Formal RO entry shell: title, Swordsman selection and `prt_fild08` stage selection now load verified original RO
  window/button/icon/minimap rasters and original client fonts. Generic panels remain fixture-only, missing UI fails
  closed and the responsive composition makes no pixel-identical claim.
- Survivor presentation pass: adds a central timer, effective-damage ranking, right minimap/stat rail, responsive
  skill bar and larger outlined centi-unit damage numbers; removes fake Zeny, front-loads the first four existing
  spawn slots and emits deterministic wind-up/hit/XP/draft/elite/reward events without increasing the 420 cap.
- Canonical whitelist v4: adds six verified original KRO WAVs (physical hit, Bash, Magnum Break, Endure, Provoke and
  Shield Wave) for 288 rows total, SHA-256
  `473E82880F91448F004222A9D049CCB67460B61EE37B138FE89FB286E57C9B85`; formal playback remains local-only and
  no raw audio is committed.
- Formal-local positive-path harness: adds desktop, phone portrait, tablet portrait and phone landscape coverage,
  real touch dispatch, formal-audio activation and title/job/stage/game HUD/draft bounds checks. The integrated
  real-asset run passes all four viewports with movement, audio and zero required-layout overlaps.
- Combat presentation: connects deterministic hit/skill/kill/player-hit events to original RO ACT attack, cast, hit
  and death slots; preserves final death cues through the results transition; adds bounded damage text, optional
  flash/shake and official per-monster shadow/elite scale. Wind-up and resolve now share one continuous animation
  clock, and IndexedDB settlement runs in parallel with the terminal presentation instead of delaying it.
- Survivor density D-032-v0.3: raises authoritative wave rates to 1.2/s, 2/s and ~2.73/s in the measured windows,
  adds separate whole-map and 11 m near-player gates for every one of 90 fixed runs, and keeps peak 186 below the
  420 cap with zero skipped spawns. Contact grace, simultaneous ranged shooters and level-up sustain were retuned;
  all three builds remain at least 7/10 on every input adapter.
- Formal HUD parity pass: adds the verified original BasicInfo system controls and eight menu rasters, a native 1:1
  crop of the original `prt_fild08` minimap with its original arrow/zoom rasters, and removes passive talents from
  the RO Shortcut bar. Phone/tablet/desktop layouts keep native/integer raster presentation.
- Windows E2E portability: the smoke, flow and bench harnesses now locate Playwright beside the active bundled
  Node runtime before falling back to `npm root -g`; this avoids trying to spawn the Unix-only `npm` name when only
  `npm.cmd` exists. Formal-no-gateway, formal-refuses-fixture, complete fixture flow and bundle separation all pass.

- D-032 VFX admission (`98d2933`): adds the fail-closed project-owned skill-VFX schema, manifest validator and CI
  command. Manual authorship, rights evidence, external editable-source hash, exact reviewed output and RO-style
  presentation metadata are mandatory; AI, closed-source derivation, traversal, fake/drifted PNGs and unregistered
  output fail. The valid empty manifest means **0 approved formal skill VFX**; no bitmap art was added.
- Skill presentation events (`5096a66`): every active skill, including Endure, emits origin, direction, geometry,
  rank, VFX cue and design origin; all fixed-step events are retained when one render frame advances multiple ticks.
  Tooltips distinguish official-name fan adaptations from original Survivors adaptations.
- D-032-v0.1 balance integration (`6fd2b4a`): replaces the offer-only 60-second proxy with offered/selected/cast/effective gates,
  where an effective area cast hits at least three non-MVP targets. Adds effective (non-overkill) MVP/source damage,
  survival, actual movement and player-stun-only control telemetry; a versioned fail-closed checkpoint; 10-seed
  per-adapter p10/p50/p90 scorecards; and check-only recomputation in local/GitHub CI. This is an initial Swordsman
  bot baseline, not final tuning, independent 30-seed evidence, completed skill art or all-job completion.

- UI-B3 (`a449dd0`, Actions run #45): wires the fail-closed 108-asset UI loader into the formal game; installs the
  two verified client fonts; renders the first visible original-raster BasicInfo, HP/XP gauges, Shortcut, skill icon,
  stage/Boss strips and victory/defeat alert; hides production Build/Gateway text and drawn joystick art; adds
  idempotent raster/image/font cleanup. Real-local desktop/phone/tablet/landscape evidence is in
  `reports/phase1/UI-B3-LOCAL-ACCEPTANCE.md`. Remaining menus/modals are not declared complete.

- Commit A (`983913f`): canonical v2 whitelist (174 rows), map dependency closure contract, formal loader stops at
  the pending GND/RSM/water/shadow/audio renderer instead of substituting anything.
- UI-A: canonical v3 whitelist (282 rows = v2 + 108 RO UI rows), exact `filesystem:System` font allowlist, UI asset
  manifest schema + local generator, reference profile `KRO2021_CLASSIC_V0_FAN` (DISCOVERED), reference metrics
  (DEFERRED_LOCAL), profile compatibility tests, core UI asset gate in the formal loader (D-028…D-030).
- Commit B: local extraction and derived scene contract (converter v2). Adds clean-room BMP, JPEG-header, GRSM 1.1–1.5
  and WAV-header readers, and parses GND 1.7 lightmaps and RSW water/sound records. Writes lossless texture PNGs, a
  lightmap atlas, model JSON, placements, water frames by ID, the official shadow with ACT alpha kept, and audio by ID.
  Fails closed on any missing or malformed dependency. Formal renderer still pending
  (`reports/phase1/COMMIT-B-DERIVED-CONTRACT.md`).
- Commit B fixes for Codex CHANGES_REQUIRED F-1…F-5:
  - legacy GRSM keyframe layout (model-level position keys with data; no per-node keys; trailing bytes rejected),
    with a golden fixture;
  - transactional extraction (staging + atomic swap; a failed re-run leaves no manifest);
  - the gateway serves derived files only through a valid manifest;
  - structured failures for RSW/GND/GAT;
  - complete provenance for composite outputs;
  - 32-bit BMP rejected.
- Commit B fixes for R-1…R-3:
  - the legacy RSM model position-key count is mandatory (truncation is detected);
  - the publish commit point is explicit, and cleanup after it is best-effort with a warning;
  - a missing core map row is reported with its fixed canonical path.
- Commit C, formal renderer (`reports/phase1/COMMIT-C-FORMAL-RENDERER.md`):
  - GND ground with texture UVs, vertex colour and embedded lightmaps;
  - GRSM props instanced at every RSW placement, and the 32 official water frames;
  - four-layer swordsman atlas with per-direction layer order, and the official shadow at alpha 128;
  - BGM 12 + positional RSW WAVs behind a 「點擊啟用音訊」 gate;
  - formal and fixture worlds split; fixture build only via `--mode fixture`.
- Commit C fixes:
  - C-1: water only on the selected GND cells;
  - C-2: audio decode errors name the exact asset.
- UI-B1 (`reports/phase1/UI-B1-UI-EXTRACTION.md`):
  - the 108 RO UI rows are extracted inside the transactional extraction: BMP → lossless PNG with the magenta key,
    and the cursor atlas/ACT with hotspots; fonts stay source-only;
  - new `FormalUiAssetLoader` (profile KRO2021_CLASSIC_V0_FAN only, fail-closed), not wired into the screen yet.
- UI-B1 fixes B1-1…B1-5:
  - the verified lock + canonical whitelist identity is enforced in extraction, the gateway and the loader;
  - the cursor ACT is kept verbatim;
  - a canonical 108-ID registry is introduced;
  - full cursor frame / layer / hotspot validation;
  - PNG ↔ JSON SHA-256 cross-check.
- UI-B2 (detached, not on screen):
  - verified raster handles issued by the UI loader;
  - RO primitives RoRaster / RoThreeSlice / RoButton / RoGauge / RoSlot (`apps/client/src/ui/ro/`);
  - a formal visual static guard over the primitive graph.
- UI-B2 fixes B2-1…B2-5:
  - minting is loader-only and transactional;
  - handle entries are frozen copies;
  - disposed handles are rejected;
  - the guard scans CSS and allowlists runtime imports;
  - `RoButton` states must belong to one control family.
- UI-B2 fixes B2-R1…R3:
  - no URL-factory injection in the production loader;
  - the mint verifies the PNG bytes and their SHA-256;
  - a full-tree mint call-site guard;
  - two-phase minting with best-effort rollback;
  - the guard resolves extensions and `index` files, checks re-exports, rejects remote CSS imports and literal raster
    sources.
- UI-B2 fixes W1, R2-1, R2-2, R3 (Windows-native run):
  - every path the guard reports or compares is POSIX `/` on every OS (also the renderer's formal/fixture
    graph-separation test, which failed on Windows);
  - the mint snapshots each item synchronously before any await (scalars, declared SHA, a copy of the bytes, a frozen
    entry clone), so mutation while it is pending cannot change what is issued;
  - rollback never loses the original error: a frozen/non-extensible error or thrown primitive is wrapped in
    `RasterIssuanceError` (`cause` + `cleanupErrors`);
  - the guard reads TS/TSX imports, re-exports, dynamic imports and type-only forms from the TypeScript AST, flags
    non-literal dynamic imports and `import.meta.glob`, matches CSS `@import` case-insensitively, and allows a raster
    source only through the single `verifiedRasterUrl(VerifiedRaster)` helper.
- UI-B2 fixes R4-1…R4-4:
  - the verified handle prototype (and class) is frozen, so `url` / `disposed` / `dispose` cannot be redefined;
    the brand set's `has` / `add` are bound once at import, so patching `WeakSet.prototype` later forges nothing;
  - post-import tamper model: the mint captures at module initialisation `WeakSet` has / add, the
    canonical-ID `Set.has`, `Object.freeze` / `isFrozen` / `entries` / `isExtensible` / `create`, `Array.from`,
    `URL.createObjectURL` / `revokeObjectURL`, `SubtleCrypto` digest (bound to `crypto.subtle`),
    `structuredClone`, `Blob`, `Uint8Array`, `ArrayBuffer.isView`, `Number.isInteger`, `Symbol.iterator` and
    `AggregateError`; Blob parts and AggregateError errors are own-iterator iterables, SHA-256 hex is
    computed with indexed loops, and the PNG signature check uses a fixed length (not the patchable
    `%TypedArray%.prototype.length`); the loader-brand provenance check accepts only the pure predicate
    `typeof x === "object" && x !== null && mintedHas(x)`, a single `mintedAdd` bound from the ambient
    `WeakSet.prototype.add` onto the same set and called exactly once on the success path of
    `mintRasterSet` (pinned by exact AST shape: the top-level brand loop over `const chain = issued`,
    `issued` written only by the `new Handle(…)` link in the top-level `try`, built from the frozen
    snapshot list), a set referenced only by those two binds, value exports equal to exactly
    {`isMintedRaster`, `mintRasterSet`, `RasterIssuanceError`}, every callee on that path resolved by
    declaration identity (including `createUrl`), and a `Handle` class locked by exact AST allowlist (no
    `extends`, no constructor `return`, five fields from five plain parameters, captured `freeze(this)`,
    `#url`-only getter, frozen class and prototype, never-written binding);
  - item bytes are checked at validation time (import-time pure predicate: `isView`, the internal
    `"Uint8Array"` tag via the captured `@@toStringTag` getter, and a direct prototype equal to the captured
    local `Uint8Array.prototype`; no `instanceof`, no prototype-chain walk): ordinary subclass instances,
    foreign-realm values and non-Uint8 typed arrays are refused; a genuine `Uint8Array` re-prototyped to the
    captured local prototype is indistinguishable (no observable construction provenance), with byte
    integrity unaffected;
  - the `Handle` url getter's throw is exactly `new Error(\`raster ${this.assetId} was disposed\`)`, and
    `createUrl`'s byte path is exact: a plain non-`async`, non-generic arrow with one plain parameter, the
    AST-locked `ownIterable` / `ITERATOR` (plain arrows throughout), and the inert Blob options literal
    `{ type: "image/png" }`; `revokeUrl` is likewise a plain arrow with one plain parameter. Not covered: a realm compromised before this module loads, and the
    `Promise` / `await` machinery (`Promise.prototype.then` / `constructor`) the async mint resolves through;
  - the mint snapshots
    the caller's items with indexed loops (accepting only its own snapshots), and keeps handles and URLs in
    private chains of object literals: no `Map` / `Set` / array iterator / `push` / `sort` decides what is
    branded, returned by `get` / `has` / `ids`, revoked on rollback or disposed, or reported as a cleanup error
    (arrays come from the captured `Array.from` over a null-prototype array-like); `get` / `has` re-check the
    brand and the exact ID; the helper's `checkRaster` may contain only its final `return r`;
  - the guard traces bindings with a per-file TypeScript checker and rejects what it cannot prove safe:
    - the raster URL helper counts only as its one exact top-level declaration in `ui/ro/primitives.tsx` whose
      `VerifiedRaster` and `checkRaster` are the real bindings; in a graph it must be the actual
      `apps/client/src/ui/ro/primitives.tsx`, next to the actual `raster.ts` whose brand check imports the
      actual `game/formal/rasterMint.ts` brand (look-alike trees are `raster-brand-provenance`); any other
      declaration, shadow, alias, import, re-export, mutation or reference fails closed;
    - element factories are capabilities: an imported `h` / `createElement` / `jsx*` may only be called
      directly with an allowlisted intrinsic tag (`div`, `span`, `button`) and static props; aliases, comma /
      call / apply / bind, passing, returning, exporting, namespace / default imports and `cloneElement` fail;
    - JSX tags are allowlisted intrinsics or same-file function declarations that are never reassigned;
      mutating any function / class / import binding (any assignment operator, ++ / --, destructuring,
      for-in / for-of) is `binding-mutation`;
    - every assignment operator and ++ / -- on `src` / `srcset` / `poster` or a raster-style property is
      rejected (only a plain `=` of a literal to a style property is accepted);
    - setter capabilities (`setAttribute*`, `setProperty`, `defineProperty`, `defineProperties`, `assign`,
      `setPrototypeOf`, `cssText`, …) are banned outright in the formal graph: member, string name, alias,
      destructuring, call / apply / bind (`setter-capability`);
    - one shared assignment-target walker covers every write (all assignment operators, ++ / --,
      array / object destructuring at any depth, defaults, spreads, for-in / for-of targets, delete); unknown
      target shapes are `opaque-assignment-target`;
    - every element access (read, write, call, alias) and computed key needs a provable key: a constant
      string (literals, no-substitution templates and `+` of constants — checked against setter / source /
      dangerous names), a number, a union of safe string-literal types, or the captured `Symbol.iterator`;
    - restricted namespace globals (`Object`, `Array`, `Number`, `URL`, `crypto`, `Symbol`, `ArrayBuffer`) are
      usable only as `G.<allowed member>`; aliases such as `const O = Object` fail closed;
    - free identifiers must be allowlisted globals with allowlisted members (`document`, `globalThis`,
      `Reflect`, `Object.fromEntries`, `Object.assign`, … fail);
    - dynamic computed keys, element-access writes / deletes (all assignment operators), dynamic
      `defineProperty` / `setAttribute` names, reflective members, object / JSX spreads and string literals
      naming sources, sinks or factories fail;
  - comments are removed with the TypeScript parser (CSS: block comments outside strings), so `//` in a string or
    JSX text no longer hides code.

## Unreleased — Phase 2 vertical slice (2026-11-17)

- Seed compiler + integer runtime content (`73a33f9`); run simulation, drafts, bosses, bot, tuning layer (`d4e6687`).
- Flow state machine, run results, transactional settlement (`4e63988`); input adapters, automated acceptance (`30dae38`).
- Client game flow, run renderer, settlement UI, mixer rules (`6f310d9`); fix: the run no longer restarts on phase
  changes; compact in-run header; browser flow e2e (`reports/phase2/`).
- Formal level-up/keystone draft: verified original RO title/chat strips, semantic original skill icons, official
  selection marker and four-state three-slice buttons; responsive real-local checks at desktop, phone, tablet and
  phone-landscape sizes. Generic draft UI remains test-fixture-only.
- Formal results: verified original RO item-window title/body/footer and four-state scalable button, with a visibly
  frozen final real-RO world behind it; HUD, joystick and developer header are removed, settlement gates Continue,
  and keyboard, pointer/touch plus gamepad A are supported. Four real-local viewport measurements pass without
  overflow; the generic results panel remains test-fixture-only.
- Windows e2e runner now executes the exact invoking pnpm CLI through Node 24 instead of attempting to spawn a
  `.cmd` shim with `execFileSync`.

## Unreleased — Phase 1 cloud spike (2026-11-17)

- Clean-room RO format parsers + synthetic writers (`704e75e`).
- Loopback asset gateway and HttpAssetGatewayClient with placeholder fallback (`9d686e1`).
- assets:audit-whitelist, assets:extract --profile fan-local, dev:fan-local, derived-output marker (`8bfcd48`).
- Deterministic arena with RenderSnapshot (`2f213e6`).
- Three.js arena client, synthetic fan-local demo, e2e smoke and bench (`151c3d9`).
- Reports: render-spike-01, Phase 1 acceptance; GAP-002 for map textures and models.
- Formal-screen rule (D-022): no placeholder/self-drawn/synthetic art in the game; missing RO assets stop the
  client with canonical paths; synthetic fixtures only in the separate test build; shadows off (GAP-003).

## Unreleased — Phase 0 fixes for Issue #2 (2026-11-17)

- Handoff transfer integrity: removed the extra trailing CRLF from four hash-locked files, `.gitattributes eol=lf`,
  fail-closed `assets:validate-handoff` (worktree + Git blob), now part of `ci:local`. (`9062ceb`)
- CP949 from the fixed official Unicode/Microsoft mapping with golden tests and a maintenance-only verified generator;
  Unicode License v3 notice. (`c1e90e9`)
- rights:check scans history paths and blob bytes after the trusted baseline, fail-closed baseline validation,
  bounded blob reads. (`a600c32`)
- Documentation corrections (VALIDATION.md 47 + 1 rows, STATUS, RISKS, DECISIONS, RESEARCH-GAPS).

## Unreleased — Phase 0 (2026-11-17)

- pnpm monorepo: `apps/client` (Vite + Preact placeholder page), `apps/asset-gateway` (loopback config contract),
  `packages/core-sim`, `packages/content-schema`, `packages/asset-contracts`, `packages/testkit`.
- Deterministic core: seeded PRNG streams, canonical state hash, fixed-step sim and clock with tests.
- `rights:check` with positive and intentional-failure tests.
- `assets:verify-sources` (local GRF/BGM SHA-256 against `assets/source-lock.example.json`).
- `local:old-trees` read-only before/after fingerprint of the previous RO trees.
- `assets:validate-handoff` offline re-validation of the Codex handoff package.
- GPLv3 `LICENSE`, `THIRD-PARTY-NOTICES.md`, `.env.example`, CI workflow.
