# UI-B5 real-local results acceptance

Date: 2026-11-18 (Asia/Taipei)
Result: **LOCAL_PASS — formal survivor results composition**

The loopback gateway loaded the pinned KRO 2021 client and reported 338 local derived files. No RO raster, font,
derived asset or real-material screenshot is committed. To reach a deterministic 10-minute result without waiting
in real time, the local fixture-mode client was connected to the **real, non-fixture** gateway and used only its
automation clock; `loadFormalAssets` selected the same formal world/UI path used by production. Formal production
and fixture bundles were also rebuilt and passed the separation smoke gate.

## Visible asset and state contract

- The 300×300 result surface is composed only from verified original
  `ui.window.title/body/footer.left/mid/right` rasters.
- Continue validates and displays the exact
  `ui.button.{normal,hover,pressed,disabled}.{left,mid,right}` family at integer scale.
- The composition is exposed as
  `data-ro-semantic-reuse="official-item-window-as-survivor-results"`. It is an original responsive fan-game
  layout, not a claim that ordinary RO shipped this results dialog.
- No chat background, unrelated menu/skill icon, CSS panel, SVG, emoji, AI image or self-drawn substitute is used.
  Unknown reward IDs remain honest text instead of receiving an unrelated icon.
- The simulation stops at victory/defeat. Results retain the same renderer and repeatedly draw the identical
  terminal state at one fixed animation time, so WebGL buffer discard cannot turn the world background blank.
- Formal results hide the developer header, run HUD and joystick. Continue is disabled until settlement completes,
  then receives focus and supports keyboard Enter/Space, pointer/touch and gamepad A.

## Responsive real-local measurements

The window and 112×40 button were fully inside every viewport; document scroll size exactly matched the viewport.

| Viewport | Window rectangle | Continue rectangle | Overflow |
| --- | --- | --- | --- |
| 1024×768 desktop | `(362,234)` 300×300 | `(456,466)` 112×40 | no |
| 390×844 phone portrait | `(45,272)` 300×300 | `(139,504)` 112×40 | no |
| 768×1024 tablet portrait | `(234,362)` 300×300 | `(328,594)` 112×40 | no |
| 844×390 phone landscape | `(272,45)` 300×300 | `(366,277)` 112×40 | no |

The first visual pass exposed a blank background despite the retained canvas: WebGL may discard its default
framebuffer after compositing. The result loop now redraws only the frozen state, and the second real-local visual
pass showed the original `prt_fild08` world behind the RO window.

## Operation and regression evidence

- Clean real-local browser tab: `world=1`, `run-hud=0`, `joystick=0`, developer header `=0`, Continue focused,
  `data-ro-dialog="survivor-results-original-ro-raster"`, console errors `=0`.
- Keyboard Enter and a separate phone-width pointer click each returned to stage selection with console errors `=0`.
- Test-fixture browser flow: Gamepad A returned to stage selection; the world canvas remained while HUD/joystick
  were absent; `runResults=1`, `pendingResults=0`, and reload did not change any persistence count.
- `pnpm e2e:smoke` with benchmark explicitly skipped: A–E all PASS.
- `pnpm ci:local`: 37 test files / 383 tests, production build, rights scan, 17 synthetic files / 183 tests and
  all 23 handoff checks PASS.
- GitHub Actions run #48 for code commit `500d069` succeeded:
  <https://github.com/sojungle8/Ok/actions/runs/44224737092>.

## Still open

- Profile `KRO2021_CLASSIC_V0_FAN` remains `DISCOVERED`; exact ordinary-client coordinates remain
  `DEFERRED_LOCAL`. UI-B5 does not claim pixel-identical official placement.
- Title, character selection and stage selection still need the same verified-raster treatment.
- Physical phone/tablet/desktop play, real hardware gamepad and exact reference-capture review remain open.
