# RO UI reference (UI-A)

Status: **RO UI reference/implementation in progress.** Profile `KRO2021_CLASSIC_V0_FAN` is `DISCOVERED`; exact
original-client placement becomes `LOCKED` only after reference-capture review. D-034 now permits a first playable
`ORIGINAL-DESIGN` responsive HUD, D-035 permits the survivor draft composition, and D-036 permits the survivor
results composition, all using only locally verified original rasters; none may be described as pixel-identical.
Local evidence: `reports/phase1/UI-B3-LOCAL-ACCEPTANCE.md`,
`reports/phase1/UI-B4-DRAFT-LOCAL-ACCEPTANCE.md` and
`reports/phase1/UI-B5-RESULTS-LOCAL-ACCEPTANCE.md`.

| File | Content |
| --- | --- |
| `KRO2021_CLASSIC_V0_FAN.profile.json` | Reference profile (§3.1): build identifier (source lock), skin, container priority, component → asset map, undecided items. Capture fields stay `null` until a local capture exists. |
| `ui-reference-metrics.json` | Pixel metrics (§4.3). `measurement = DEFERRED_LOCAL`, every value `null`; roBrowserLegacy sizes are `HINT_NOT_TARGET`. Schema rejects `MEASURED` with nulls or without capture SHA-256. |
| `../handoff/fan-local-asset-whitelist.csv` | Canonical v5, 300 rows (v4 288 + 12 official skill-effect sources), SHA-256 `ECE20DDDD09A4868CE9264B04E2DC602EA947F6C19929E49E81C1FCF5FBF480A`. The UI subset remains the same 108 verified rows introduced by v3; source size and SHA-256 of every UI asset are listed there. |

Schemas: `packages/content-schema/src/uiReference.ts`. Rules: `packages/asset-contracts/src/ui.ts`.

## Containers and priority

`rdata.grf` → `data.grf` (client override order), then `filesystem:System` for `System\Font\SCDream4.otf` /
`SCDream6.otf` only. Codex's audit found all 106 GRF UI paths only in `data.grf` (`rdata_override=false`); the local
audit and `assets:ui-manifest` flag any same-name `rdata.grf` entry as **ambiguous** and stop.

## Counts (whitelist contract, cloud)

| Category | Rows | Category | Rows |
| --- | ---: | --- | ---: |
| `ui_cursor` | 2 | `ui_scroll_arrow` | 4 |
| `ui_status_hud` | 11 | `ui_minimap` | 6 |
| `ui_status_control` | 6 | `ui_chat` | 25 |
| `ui_main_menu_button` | 16 | `ui_skill_icon` | 11 |
| `ui_hotbar` | 3 | `ui_number_sheet` | 1 |
| `ui_window_chrome` | 9 | `ui_font` | 2 |
| `ui_button_chrome` | 12 | **total** | **108** |

Found / missing / ambiguous per category against the **real** client before the v5 effect-source addition: **288/288 v4 full-whitelist LOCAL_PASS** on
2026-11-18 (all 108 UI rows loaded; 0 missing/ambiguous in the pinned source profile).
Synthetic CI (structure only, never evidence of RO visuals): 108 found, 0 missing, 0 ambiguous.

## Profile mixing checks

`checkUiProfileCompatibility`: every UI row tagged `profile=KRO2021_CLASSIC_V0_FAN;`, required, with SHA-256; no V5
`menu_icon\` and no minimap V2 `map\i_*`; BasicInfo parts only under `basic_interface\`; no logical-key collision;
every three-part strip has left/mid/right. Result on the unchanged v3 UI subset inside v4: 0 issues.

## Local commands (user's machine)

```text
pnpm assets:verify-sources        # now also needs RO_ASSET_SYSTEM_DIR (client System directory)
pnpm assets:audit-whitelist       # 300 rows in canonical v5
pnpm assets:ui-manifest           # metadata-only manifest in .local-assets/…/ui/, report in reports/local/
```

`assets:ui-manifest` checks every bitmap's native size against the size declared in the whitelist notes, parses the
cursor ACT (2.5, 14 actions) and bounds each hotspot by its sprite frame, and checks the fonts' `OTTO` signature.
Any failure lists asset ID + container + canonical CP949 path.

## Remaining decisions / measurements

See `undecided` in the profile: UI-Q1 tooltip surface, UI-Q2 status/inventory/skill windows and UI-Q3 exact font
metrics still need a reference capture. D-034 resolves the first-pass UI-Q4 HUD composition; D-035 records the
survivor-draft semantic reuse of neutral original chrome; D-036 records the results-window semantic reuse and frozen
terminal-world rule. Recorded decisions: D-028…D-030, D-034…D-036.
