# Commit C — formal renderer

Status: cloud implementation with **synthetic and golden structural tests only**. Real-client rendering is
**DEFERRED_LOCAL**, and no visual acceptance is claimed. Phase 1, GAP-002 and GAP-003 stay open; they
are resolved in Commit D.

## What the formal screen draws

Every visible world pixel comes from the derived scene contract of Commit B (converter v2), which is served by
logical ID through the gateway's manifest gate. Any missing or invalid entry blocks the world and lists the asset
ID and canonical path (`game/formal/load.ts`).

| Part | Source | Code |
| --- | --- | --- |
| Ground | GND surfaces. Colour = `texture × surface colour × lightmap brightness + lightmap colour`; up quad per cube plus linked front/right walls | `formal/contract.ts buildGroundBuffers`, `formal/world.ts FormalWorld` |
| Props | 23 GRSM models baked to a static pose, instanced at every RSW placement (one InstancedMesh per model × texture) with the 44 official model textures | `bakeModel`, `buildModelInstances`, `FormalWorld.propMeshes` |
| Water | The 32 official JPG frames for RSW water type 1, advancing one frame every `animSpeed` 60 Hz ticks. Drawn **only on the GND cells selected by `max(corner heights) > level`**, at the RSW water level. The selected count must equal the extractor's `scene.water.cells`, otherwise the world is blocked. No whole-map plane | `buildWaterBuffers`, `waterFrameAt`, `FormalWorld.update` |
| Swordsman | One atlas composed from body + hair + sword + guard with the original body/hair palettes. Per-direction draw order: weapon and shield behind the body when facing away (3/4/5). The formal loader rejects any atlas without all four layers, both palettes and the order table | `tools/assets/extract-lib.ts layerDrawOrder`, `assets.ts checkPlayerLayers` |
| Shadow | Official `shadow.spr/.act`, action 0 frame 0, scale 1.0, ACT alpha 128 (0.502), on the ground under the swordsman and every monster | `shadowParams`, `OfficialShadowLayer` |
| Audio | BGM 12 and the 4 RSW ambient WAVs (original bytes, decoded up front; a decode failure blocks with that asset's own ID and canonical path, via `AudioDecodeError` / `prepareFormalAudio`). Ambient sounds use WebAudio panners at their RSW positions, and the listener follows the player. If autoplay is blocked, the only UI is a 「點擊啟用音訊」 button | `formal/audio.ts FormalAudio`, `App.tsx` |

## Formal / fixture separation

- The world is injected into `RunRenderer` as a `WorldLayer`. `FormalWorld` lives in `game/formal/`. The test-only GAT
  shading (`FixtureWorld`) and the render bench live in `game/fixture/` and `BenchApp.tsx`, and are imported only
  dynamically behind the compile-time flag.
- A fixture build happens only through `vite build --mode fixture` (`pnpm --filter @ro-survivor/client
  build:test-fixture`), which always writes `dist-test`. Every other build is formal, and `VITE_ALLOW_SYNTHETIC` is
  ignored.
- In formal builds, a Vite plugin resolves fixture-only imports to a throwing stub. The e2e check E confirms that the
  fixture marker is absent from `dist` and `dist-formal-gw` and present in `dist-test`. A static graph test confirms
  that no fixture module is reachable by static imports from `main.tsx`.

## Known approximations (confirm against the client, DEFERRED_LOCAL)

- RSM static pose and transform order: placement rotation `Euler(-rx, -ry, rz, "ZXY")`, recentred on the
  bounding-box bottom centre. Animation keys are not applied.
- RSW/RO → world axis mapping: RSW z is treated as north.
- Water: opacity 0.6; texture repeats every two GND tiles. RSW wave height, speed and pitch are read but **not
  implemented**: the surface is flat.
- Layer order rule for facing-away directions.

None of these substitutes any RO asset; they are transform and blend parameters to calibrate against the client.

## Local commands (Windows, repository root, PowerShell)

```powershell
pnpm assets:verify-sources
pnpm assets:extract --profile fan-local    # converter v2 scene contract + 4-layer player atlas
pnpm dev:fan-local                         # formal screen against the local gateway
```

On the formal screen, check:
- original GND ground with lightmaps, water, the RSM props, the four-layer swordsman, Poring and official shadows;
- the 「點擊啟用音訊」 prompt, then BGM 12 and the positional bird sounds;
- no checker, placeholder or TEST FIXTURE banner.
