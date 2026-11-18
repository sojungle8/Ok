# D-032-E1 Endure real-local acceptance

Date: 2026-11-18 (Asia/Taipei)
Result: **LOCAL_PASS — verified original-RO Endure presentation**

The pinned KRO 2021 client supplied `effect.skill.sw.endure` from
`data\texture\effect\endure.tga`. The verified source is a 64×64, 32-bit source-alpha TGA with SHA-256
`9BB3CBEC2FC6C429698ABD9973B861378AC5C3BB7B2035FFD5D813306B61B903`. Extraction produces a local-only,
lossless PNG for browser upload; neither the RO source, derived image nor real-material screenshots are committed.

## Presentation contract

- A deterministic `skill.sw.endure` event creates or refreshes exactly one player-following instance.
- The renderer uses only the verified original texture. Missing or drifted metadata, source format, alpha mode,
  dimensions or derived pixels stop formal mode; there is no generated substitute.
- The 900 ms pulse/fade is an independently implemented visual-cue lifetime. It does not add or redefine gameplay
  buff duration, damage, cooldown, rank scaling or any other balance rule.
- Shield Wave and Endure use separate bounded instanced draws. Textures, geometry and materials are allocated once;
  construction failure and repeated disposal are regression-tested.

## Four-viewport real-asset gate

| Viewport | Size | Exact source | Active instance | Expired to zero | Result |
| --- | --- | --- | ---: | --- | --- |
| desktop | 1280×800 | `effect.skill.sw.endure` | 1 | yes | PASS |
| phone portrait | 390×844 | `effect.skill.sw.endure` | 1 | yes | PASS |
| tablet portrait | 768×1024 | `effect.skill.sw.endure` | 1 | yes | PASS |
| phone landscape | 844×390 | `effect.skill.sw.endure` | 1 | yes | PASS |

Every case also had `fixtureBanner=0`, no browser errors, working movement/audio, an active/hitting Shield Wave
regression probe and valid responsive HUD/draft bounds. Machine evidence and screenshots remain ignored locally:

- `reports/local/formal-positive/formal-positive.json`
- `reports/local/formal-positive/formal-desktop-endure.png`
- `reports/local/formal-positive/formal-phone-portrait-endure.png`
- `reports/local/formal-positive/formal-tablet-portrait-endure.png`
- `reports/local/formal-positive/formal-phone-landscape-endure.png`

The final Windows `pnpm ci:local` gate passed 49 test files / 480 tests, 19 synthetic files / 198 tests, the
90-run deterministic slice matrix, production build, rights scan, public-reference validation, 24 handoff checks
and the zero-entry project-owned VFX provenance manifest. `pnpm e2e:smoke` also passed A–E; formal builds still
reject missing/synthetic sources and only the separately marked fixture build accepts synthetic assets.

## Still open

- Bash, Magnum Break and Provoke formal renderers remain open; Provoke still needs the bounded STR path.
- Physical phone/tablet/desktop play and real-device GPU performance remain open.
- This gate does not claim the complete five-skill slice or a completed RO Survivors replica.
