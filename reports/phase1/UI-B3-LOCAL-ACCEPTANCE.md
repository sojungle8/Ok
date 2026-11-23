# UI-B3 real-local acceptance — first visible RO HUD

Date: 2026-11-18 (Asia/Taipei)  
Code commit: `a449dd0be15b4433ce765cb27a341fb81087f671`  
GitHub Actions: [run #45 — success](https://github.com/sojungle8/Ok/actions/runs/44215678107)

Status: **LOCAL_PASS for the first in-run HUD composition. Overall RO UI remains IN PROGRESS.**

## Scope proved

- Formal loading verifies all 108 UI rows, their derived PNG hashes/dimensions, cursor contract and both original
  `SCDream` font files before starting the world.
- The visible run uses the original RO BasicInfo full/mini backgrounds, original HP gauge, an explicitly recorded
  SP-gauge-to-XP semantic reuse, original shortcut background, original Swordsman icon and original window title
  slices for timer/kills and alerts.
- A formal run contains no fixture bars, developer Build/Gateway header or drawn joystick. Mobile movement keeps a
  transparent 120×120 input region; a real browser pointer drag moved the player `3409 mm` on the X axis.
- Missing/drifted formal UI still blocks the run; no CSS surface or generated image is used as a fallback.

This is an original responsive layout made from verified original RO pixels. The reference profile remains
`DISCOVERED`, so this report does **not** claim that positions are pixel-identical to an original 1024×768 RO client.

## Browser evidence

Chrome on Windows, real loopback gateway, pinned KRO 2021 source lock:

| Viewport | BasicInfo | Timer/kills | Shortcut | Result |
| --- | --- | --- | --- | --- |
| 1024×768 desktop | `(8,8) 280×120` | `(422,8) 180×17` | `(372,726) 280×34` | world=1, RO HUD=1, all inside viewport |
| 390×844 phone portrait | `(8,8) 280×34` mini | `(105,48) 180×17` | `(55,72) 280×34` | world=1, RO HUD=1, all inside viewport |
| 768×1024 tablet portrait | `(8,8) 280×120` | `(294,8) 180×17` | `(244,982) 280×34` | world=1, RO HUD=1, all inside viewport |
| 844×390 landscape | `(8,8) 280×120` | `(332,8) 180×17` | `(282,348) 280×34` | world=1, RO HUD=1, all inside viewport |

At 1024×768 and 390×844:

- `document.fonts.check('11px "RO SCDream"') = true`;
- `.fixture-bar,.bar = 0` and `[data-fixture-hud] = 0`;
- formal developer header count = `0`;
- `.formal-stick` background is transparent, border is none and knob display is none;
- HTTP 4xx and failed-request list is empty.

The real screenshots are deliberately gitignored; only their hashes are recorded:

| Local file | SHA-256 |
| --- | --- |
| `reports/local/real-ro-ui-desktop.png` | `E1CF6C3E378C765EBF4E6C1BBFA1361FF425FF8B1704E8581BABF70B986430E3` |
| `reports/local/real-ro-ui-mobile.png` | `FF7038E722E48C635BA6C1A46B8C88A1F650B20B8336C7BF3A54B8B7F2EC3B08` |

## Automated gates

Windows `pnpm ci:local` after the change:

- 35 test files / 372 tests PASS;
- production Vite build PASS;
- `rights:check` PASS (no RO pixels/audio or secrets in Git/dist);
- 17 synthetic files / 183 tests PASS;
- handoff validation 23/23 PASS.

## Still open

- Lock original-client placement/font metrics from a reference capture; until then no “pixel-identical layout” claim.
- Replace title, character/stage selection, level-up, pause and results surfaces with verified RO window/button parts.
- Add the approved minimap/cursor/window-manager interactions and full keyboard/touch/gamepad ownership tests.
- Human testing on physical phone, tablet and desktop hardware.

