# UI-B4 real-local draft acceptance

Date: 2026-11-18 (Asia/Taipei)
Result: **LOCAL_PASS — first formal level-up/keystone draft composition**

This gate used the pinned KRO 2021 client through the loopback gateway. No RO raster, font or derived local
asset is committed. The synthetic build was used only for interaction regression tests and remains labelled
`TEST FIXTURE`.

## Visible asset contract

- Every panel pixel comes from `ui.window.title.left/mid/right` or
  `ui.chat.window.left/mid/right`.
- Every action button validates and displays the exact
  `ui.button.{normal,hover,pressed,disabled}.{left,mid,right}` family; source pixels are tiled at integer
  scale and never stretched.
- Choice icons are the verified original RO skill icons. Heal/guardian/weapon/fury have explicit semantic
  mappings; an unknown future choice displays no icon instead of substituting an unrelated image.
- `ui.slot.selection` is used only as the official selection marker, never as a card/window frame.
- The neutral chat strip reuse is exposed as
  `data-ro-semantic-reuse="official-chat-window-as-survivor-draft"`. This is an original responsive
  fan-game layout, not a pixel-identical RO dialog claim.
- Formal draft markup does not enter the generic `.modal` / `.card` CSS surface path.

## Responsive browser measurements

All measured title strips, 300×84 choice bodies and 88×40 integer-scaled buttons were inside the viewport.

| Viewport | Layout | Measured choice rectangles | Overflow |
| --- | --- | --- | --- |
| 1024×768 desktop | three columns | `(58,344)`, `(362,344)`, `(666,344)`, each 300×101 | no |
| 390×844 phone portrait | vertical | y = 277 / 382 / 487, each 300×101; buttons 88×40 | no |
| 768×1024 tablet portrait | vertical | y = 367 / 472 / 577, each 300×101 | no |
| 844×390 phone landscape | vertical low-height | y = 50 / 155 / 260, each 300×101 | no |

The first mobile pass exposed a flex-basis error (300 px became card height in column mode); the media rule now
sets the vertical basis to 101 px, and all four viewports were re-measured after the fix.

## Operation and regression evidence

- Real-local browser: number key `2` chose the second option and resumed combat; pointer click chose the third
  option on the next level and resumed combat. Console error count: 0.
- Test-fixture end-to-end gate: key, touch tap, gamepad A/B and keyboard movement all pass; settlement remains
  exactly once after reload.
- `pnpm ci:local`: 36 test files / 378 tests, production build, rights scan, 17 synthetic files / 183 tests,
  and all 23 handoff checks pass.
- `pnpm e2e:smoke` with the benchmark skipped: A formal/no gateway, B formal/refuses fixture, C full fixture
  flow, D explicit skip and E bundle separation all report PASS.

## Still open

- Profile `KRO2021_CLASSIC_V0_FAN` remains `DISCOVERED`; exact original-client coordinates remain
  `DEFERRED_LOCAL`. This gate does not claim the dialog is pixel-identical to an official screen.
- Title, character/stage selection and results screens still need the same formal-raster treatment.
- Physical phone/tablet human play and exact font/reference capture review remain open.
