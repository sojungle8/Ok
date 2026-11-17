# Third-party notices

This project is licensed under the GNU General Public License v3.0 only (see `LICENSE`).
It is a non-commercial, unofficial fan project. It is not affiliated with, endorsed by or
licensed by Gravity Co., Ltd., Lee Myoungjin, any regional RO operator, or Reven4nt /
RO Survivors / HANS.

## Copied third-party source code

**None as of Phase 0.** No file from roBrowserLegacy, remote-client, rAthena or any other
project has been copied. Before any GPL module is copied (Phase 1+), the source tree's
`AGENTS.md`, `LICENSE` and dependency closure must be read, and every copied file must be
listed below with its origin commit, original path, original authors and modification date.

| Project | License | Source commit | Copied files (original path → new path) | Modified on | Status |
| --- | --- | --- | --- | --- | --- |
| roBrowserLegacy | GPL-3.0 | `5435cf67642eac8281f9a7a94c92f98428db471e` (per plan; local verification DEFERRED_LOCAL) | — | — | not copied |
| remote-client (GRF gateway) | GPL-3.0 | `cd51fcab453444ae5d9a1028b677fe0c56a32ca6` (per plan; local verification DEFERRED_LOCAL) | — | — | not copied; Phase 1 treats it as an external read-only service |
| rAthena | GPL-3.0 | local snapshot without Git metadata | — | — | not copied; IDs used only as name/source references |
| Three.js | MIT | npm `three@0.186.1` (package dependency, not copied source) | — | — | installed as a dependency in Phase 1 |

## Data files

### Unicode CP949 mapping (Microsoft cp949 table)

| Field | Value |
| --- | --- |
| Source | <https://www.unicode.org/Public/MAPPINGS/VENDORS/MICSFT/WINDOWS/CP949.TXT> (table version 2.01, Format A) |
| Source SHA-256 | `f57e6fef9d1ed44f445e319a8e1b879ce6b6064520ab571c341e47b892e32abc` |
| Copyright / license | Copyright © 1991-2026 Unicode, Inc. — Unicode License v3, full text in `licenses/UNICODE-LICENSE-V3.txt` (obtained from <https://www.unicode.org/license.txt>, SHA-256 `e7a93b009565cfce55919a381437ac4db883e9da2126fa28b91d12732bc53d96`) |
| Derived file | `packages/asset-contracts/src/cp949-table.generated.ts` |
| Transformation | `tools/cp949/generate.ts` (maintenance command `pnpm maint:cp949-generate`, generator v1): verifies the source SHA-256 before anything is written, checks single bytes 0x00-0x7F are ASCII identity, keeps only the 17,048 double-byte rows and stores each as 8 hex digits (CP949 code + Unicode code point). Comments and Unicode names are dropped. |
| Derived-data check | Double-byte stream (code u16 BE + Unicode u16 BE, source order) SHA-256 `1ed8d8e4d8095248317a77a2976f4ec8e76e551b11caa1f7249476bf109961cd`, asserted by tests |
| Network | Only the maintenance command may download; build, test, `ci:local` and CI read the committed table offline |

## Package dependencies (installed via pnpm, versions pinned by `pnpm-lock.yaml`)

Runtime (shipped in the client bundle):

| Package | Version | License |
| --- | --- | --- |
| preact | 10.29.8 | MIT |
| zod | 4.6.7 | MIT (used by content-schema) |
| three | 0.186.1 | MIT |

Development only (not shipped):

| Package | Version | License |
| --- | --- | --- |
| vite | 8.3.8 | MIT |
| @preact/preset-vite | 2.10.6 | MIT |
| vitest | 5.1.0 | MIT |
| typescript | 6.0.3 | Apache-2.0 |
| eslint | 10.15.0 | MIT |
| @eslint/js | 10.0.1 | MIT |
| typescript-eslint | 8.73.0 | MIT |
| globals | 17.14.0 | MIT |
| @types/node | 24.19.2 | MIT |
| @types/three | 0.186.0 | MIT |

## RO material

Ragnarok Online graphics, maps, models, effects, icons, sounds and music belong to Gravity
and related rights holders. None of them are included in this repository or its build
output; `pnpm rights:check` enforces this. The `fan-local` profile loads them only on the
user's own computer from the user's own client files.
