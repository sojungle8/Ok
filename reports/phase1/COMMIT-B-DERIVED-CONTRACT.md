# Commit B — local extraction and derived scene contract

Status: cloud implementation with **synthetic** structural tests only. Real-client extraction is
**DEFERRED_LOCAL**. The formal renderer is still pending (Commit C), so the formal game stops at
`FormalRendererPendingError`. Nothing here is RO visual evidence.

## Outputs (git-ignored, `.local-assets/<data.grf SHA-256 prefix>/v2/`)

Every derived PNG/JSON (including `reports/prt_fild08-dependencies.json` and `reports/prt_fild08-closure.json`)
carries the derived marker. Each one is listed in `manifest.json` with its SHA-256 and the verified source entries
(`assetId`, `entrySha256`, `rawHex`) that decide its content. For composite outputs (the scene JSON and the
closure report) that means every input of the scene step, deduplicated by asset ID: core map, RSMs, ground/model
textures, water frames, BGM/WAV and shadow. The directory name keys the
outputs to `data.grf` and to converter version 2. `map.prt_fild08.rsw.json.sources` records all four
verified source hashes: data.grf, rdata.grf, bgm and system.

| File | Content |
| --- | --- |
| `map.prt_fild08.rsw.json` | Scene: RSW placements (name, model asset ID, position, rotation, scale), water (level, type, wave, anim speed, the 32 frame IDs, water cell count), sounds (position, volume, range, cycle, asset ID), BGM / shadow IDs, texture table, audio metadata |
| `map.prt_fild08.gnd.json` | GND 1.7: texture table → asset IDs, per-surface UVs, texture, lightmap index and colour, per-cube heights and up/front/right surface links |
| `map.prt_fild08.gnd.png` | All embedded lightmaps as 8×8 tiles (RGB = colour, A = brightness); no external lightmap paths |
| `map.prt_fild08.model.NNN.json` | GRSM 1.x model in the legacy layout. Contents: textures → asset IDs, node tree, matrices, transforms, vertices, texture vertices, faces. Each node carries rotation keys only. After all nodes come the model-level position keys (frame, x, y, z, data) and the volume boxes. Trailing bytes are an error. |
| `map.prt_fild08.{ground,model}_texture.NNN.png` | Lossless RGBA from 8-bit paletted or 24-bit BMP; 32-bit BMP is rejected until a verified BGRA/BGRX policy exists; colour key `r>=254 && g<=1 && b>=254` → alpha 0; nearest filter |
| water JPG frames | **not re-encoded**: the original bytes are served by logical ID (`/v1/assets/<id>`); width/height are recorded |
| `common.shadow.spr.png` / `common.shadow.act.json` | Official shadow atlas + ACT with layer colours verbatim (alpha 128 kept) |
| BGM 12, 4 ambient WAVs | original bytes by logical ID; WAV fmt/duration and MP3 header recorded in the scene JSON |

Fail-closed and transactional:
- `assets:extract` first removes any existing `manifest.json`, then writes everything into a unique sibling staging
  directory on the same filesystem.
- Only after every read, parse and write succeeds does it write `manifest.json` and swap the staging directory into
  place by rename.
- On failure it deletes the staging directory and leaves no manifest in the active directory.
- Failure covers sprites, the core RSW/GND/GAT and the scene closure: a dependency that is not whitelisted,
  unreadable, size/hash-mismatched or malformed. The command exits 1, prints
  `MISSING <assetId|(not whitelisted)> <container> <canonical CP949 path>: <reason>` and writes
  `reports/prt_fild08-scene-missing.json`.

The gateway serves a derived file only if all of these hold:
- `manifest.json` exists, has converter version 2, and its source hashes equal the verified lock's;
- the file is listed in the manifest;
- its bytes match the listed size and SHA-256.

Leftover files from an earlier run are never served.

## Local commands (Windows, repository root, PowerShell)

```powershell
pnpm assets:verify-sources                  # needs RO_ASSET_SOURCE_DATA_GRF, RO_ASSET_SOURCE_RDATA_GRF, RO_ASSET_BGM_DIR, RO_ASSET_SYSTEM_DIR in .env.local
pnpm assets:audit-whitelist                 # 282 rows
pnpm assets:extract --profile fan-local     # writes .local-assets\<hash>\v2\
pnpm rights:check
```

Expected on the real client, from Codex's audit; to be confirmed locally:
- GND 1.7 with 10,028 lightmaps, and 21 ground textures.
- 23 unique RSM 1.4 models with 44 texture references and 570 placements.
- Water type 1 with 32 frames and 2,504 water cells, using the rule `max(corner heights) > level`. The rule itself is unverified until the local run.
- 4 ambient WAVs, and shadow ACT alpha 128.
