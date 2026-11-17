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
| Three.js | MIT | — | — | — | planned for Phase 1; not installed |

## Package dependencies (installed via pnpm, versions pinned by `pnpm-lock.yaml`)

Runtime (shipped in the client bundle):

| Package | Version | License |
| --- | --- | --- |
| preact | 10.29.8 | MIT |
| zod | 4.6.7 | MIT (used by content-schema; not yet in the client bundle) |

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

## RO material

Ragnarok Online graphics, maps, models, effects, icons, sounds and music belong to Gravity
and related rights holders. None of them are included in this repository or its build
output; `pnpm rights:check` enforces this. The `fan-local` profile loads them only on the
user's own computer from the user's own client files.
