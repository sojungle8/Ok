# Batch 3 art delivery

159 PNG assets: 27 tiles, 37 props, 78 inventory icons, and 17 UI assets. Paths and dimensions follow ASSET_SPEC.md sections 6, 7, and the requested ui/ portion of section 9. promo/ artwork is outside this delivery.

Generated with the built-in image_gen tool, one image per asset. Final prompts, source image filenames, and exported SHA-256 hashes are in prompts.json. Accepted full-resolution originals are preserved locally in output/pixel-rpg-art-batch3/originals.

## Export and checks

- PNG, sRGB, exact requested dimensions, RGBA. Props and icons preserve generated transparency; low-alpha fringe below 12/255 is cleared. Props are centered with their bottom at 92% of canvas height. Icons are centered.
- Ground, paths, water, and title background are full-bleed opaque images. This is intentional for tiled coverage and a complete title scene.
- Tiles are resized to 128×128; opposite edges are feathered across six pixels to a shared boundary. All opposite edge pixels match exactly. Every tile has an actual 2×2 repeat preview in qa/ for visual seam inspection.
- qa/ contains labeled contact sheets of the exported assets, plus all 27 tile repeat images. validation.json records dimensions, color space, transparency, and tile boundary checks.
- Monster material icons cover the 24 monster IDs in game data. mirror_obj is a mechanism rather than a monster material source.

Run from repository root: node pixel-rpg/tools/build-manifest.mjs.

Map rendering integration is left to the project owner as requested. This delivery changes assets and manifest only, with review artifacts in this folder; it does not change animation, character layering, combat, or map code. Runtime map acceptance remains an integration step.
