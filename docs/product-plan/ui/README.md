# RO UI reference (UI-A)

Status: **RO UI reference/implementation in progress.** Profile `KRO2021_CLASSIC_V0_FAN` is `DISCOVERED`; it becomes
`LOCKED` only after Codex review. No formal HUD exists yet and none may be drawn before that (CLAUDE-PHASE1-RO-UI.md §0).

| File | Content |
| --- | --- |
| `KRO2021_CLASSIC_V0_FAN.profile.json` | Reference profile (§3.1): build identifier (source lock), skin, container priority, component → asset map, undecided items. Capture fields stay `null` until a local capture exists. |
| `ui-reference-metrics.json` | Pixel metrics (§4.3). `measurement = DEFERRED_LOCAL`, every value `null`; roBrowserLegacy sizes are `HINT_NOT_TARGET`. Schema rejects `MEASURED` with nulls or without capture SHA-256. |
| `../handoff/fan-local-asset-whitelist.csv` | Canonical v3, 282 rows (v2 174 + 108 RO UI), SHA-256 `63EA6798B842AA6DCC65B00E09D3BBD88AA74467BC75594B5A9490F0C5C6A4DB`. Source size and SHA-256 of every UI asset are listed there. |

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

Found / missing / ambiguous per category against the **real** client: DEFERRED_LOCAL (run the commands below).
Synthetic CI (structure only, never evidence of RO visuals): 108 found, 0 missing, 0 ambiguous.

## Profile mixing checks

`checkUiProfileCompatibility`: every UI row tagged `profile=KRO2021_CLASSIC_V0_FAN;`, required, with SHA-256; no V5
`menu_icon\` and no minimap V2 `map\i_*`; BasicInfo parts only under `basic_interface\`; no logical-key collision;
every three-part strip has left/mid/right. Result on v3: 0 issues.

## Local commands (user's machine)

```text
pnpm assets:verify-sources        # now also needs RO_ASSET_SYSTEM_DIR (client System directory)
pnpm assets:audit-whitelist       # 282 rows
pnpm assets:ui-manifest           # metadata-only manifest in .local-assets/…/ui/, report in reports/local/
```

`assets:ui-manifest` checks every bitmap's native size against the size declared in the whitelist notes, parses the
cursor ACT (2.5, 14 actions) and bounds each hotspot by its sprite frame, and checks the fonts' `OTTO` signature.
Any failure lists asset ID + container + canonical CP949 path.

## Decisions needed from Codex

See `undecided` in the profile: UI-Q1 tooltip surface, UI-Q2 status/inventory/skill windows, UI-Q3 font weight and
size (needs a 1024×768 capture), UI-Q4 Survivors timer/kills/Boss HP composition. Recorded decisions: D-028…D-030.
