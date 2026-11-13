# Batch 2 delivery

167 of 170 requested PNGs: 135 cutout/equipment layers, 16 NPCs and 16 matching portraits. Generated with the built-in image_gen tool using ASSET_SPEC.md.

The three char/body/arm_{front,back,side}.png files are missing: the image service repeatedly rejected the generation requests. The renderer retains procedural sleeves for these missing layers. No placeholder PNGs were added.

All cutout textures are 256×256 with joint coordinates (128,128); NPC feet are at (128,235); portraits are 512×512. Files have alpha and sRGB profiles. Side layers face right and the renderer mirrors them for left. Armor turnaround outputs were split into their matching views before registration.

Class reference sheets are retained in references/ outside the runtime asset scan. prompts.json records the final prompts and registration metadata; validation.json records the dimension and alpha checks. Original high-resolution outputs are retained in the local output/pixel-rpg-art-batch2/originals directory.

The added cutout renderer preserves the 24×32 world footprint, applies part rotations for movement/attack, and swaps tier-specific equipment. NPC full-body art is connected to town rendering; existing portrait loading remains in place.
