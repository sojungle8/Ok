import { readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { FORMAL_SKILL_AUDIO_IDS, type DerivedSkillEffectTexture } from "@ro-survivor/asset-contracts";
import type { RunEvent } from "@ro-survivor/core-sim";
import { resolveClientBuild } from "../build-info.ts";
import { checkPlayerLayers } from "../src/game/assets.ts";
import { FormalAudio, prepareFormalAudio, type AudioContextLike } from "../src/game/formal/audio.ts";
import { MissingAssetsError } from "../src/game/requirements.ts";
import { whitelist } from "../src/gateway.ts";
import {
  bakeModel, buildGroundBuffers, buildModelInstances, buildWaterBuffers, shadowParams, soundPlacements, waterFrameAt,
  type DerivedGnd, type DerivedModel, type DerivedScene, type DerivedShadow,
} from "../src/game/formal/contract.ts";
import type { FormalSceneData } from "../src/game/formal/load.ts";
import { FormalWorld, OfficialShadowLayer, type TextureFactory } from "../src/game/formal/world.ts";
import { SHIELD_WAVE_EFFECT_ID } from "../src/game/formal/skillEffects.ts";
import type { SheetData } from "../src/game/sprites.ts";

// Minimal golden derived contract (2×2 GND, one model placed twice, 32 water frames, one sound).
const gnd: DerivedGnd = {
  assetId: "map.prt_fild08.gnd", converterVersion: 2, version: "1.7", width: 2, height: 2, zoom: 10,
  textures: [{ name: "a.bmp", assetId: "tex.a" }, { name: "b.bmp", assetId: "tex.b" }],
  lightmap: { count: 2, perCell: [8, 8, 1], atlas: { file: "map.prt_fild08.gnd.png", width: 16, height: 8, cols: 2, layout: "rgb=colour a=brightness" } },
  surfaces: {
    u: [0, 1, 0, 1, 0, 1, 0, 1], v: [0, 0, 1, 1, 0, 0, 1, 1], texture: [0, 1], lightmap: [0, 1],
    color: [255, 128, 0, 255, 255, 255, 255, 255],
  },
  // Cube 2 lies below the water level (RO heights grow downwards: 2 > level 1); the others do not.
  cubes: { heights: [0, 0, 0, 0, -5, -5, -5, -5, 2, 2, 0, 2, 0, 0, 0, 0], up: [0, 1, 0, 0], front: [-1, -1, -1, -1], right: [1, -1, -1, -1] },
};
const model: DerivedModel = {
  assetId: "model.m", version: "1.4", alpha: 255, textures: [{ name: "m.bmp", assetId: "tex.m" }], mainNode: "root",
  nodes: [{ name: "root", parent: "", textures: [0], matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1], offset: [0, 0, 0], position: [0, 0, 0], rotAngle: 0, rotAxis: [0, 0, 1], scale: [1, 1, 1],
    vertices: [[0, 0, 0], [10, 0, 0], [0, -10, 0]], tvertices: [{ color: 0, u: 0, v: 0 }, { color: 0, u: 1, v: 0 }, { color: 0, u: 0, v: 1 }],
    faces: [{ vertices: [0, 1, 2], tvertices: [0, 1, 2], texture: 0, twoSide: false }] }],
};
const frames = Array.from({ length: 32 }, (_, i) => `water.${String(i + 1).padStart(3, "0")}`);
const scene: DerivedScene = {
  assetId: "map.prt_fild08.rsw", converterVersion: 2, ground: "map.prt_fild08.gnd",
  water: { level: 1, type: 1, waveHeight: 1, waveSpeed: 2, wavePitch: 50, animSpeed: 3, frames, cells: 1 },
  models: [
    { name: "p1", file: "m.rsm", modelAssetId: "model.m", position: [0, 0, 0], rotation: [0, 90, 0], scale: [1, 1, 1] },
    { name: "p2", file: "m.rsm", modelAssetId: "model.m", position: [5, -2, 5], rotation: [0, 0, 0], scale: [2, 2, 2] },
  ],
  sounds: [{ name: "s", file: "bird.wav", assetId: "wav.1", position: [0, -5, 0], volume: 0.5, width: 1, height: 1, range: 100, cycle: 4 }],
  bgm: "bgm.prt_fild08", shadow: "common.shadow", textures: [],
};
const shadow: DerivedShadow = {
  assetId: "common.shadow", atlas: { width: 17, height: 8, file: "common.shadow.spr.png" },
  frames: [{ x: 0, y: 0, w: 16, h: 8, type: "indexed", index: 0 }],
  actions: [{ delay: 4, frames: [{ layers: [{ sprIndex: 0, sprType: "indexed", x: 0, y: 0, color: [255, 255, 255, 128], scaleX: 1, scaleY: 1 }] }] }],
  layerAlpha: [128],
};
const img = (w: number, h: number, tag: string) => ({ width: w, height: h, tag });
const shieldEffect: DerivedSkillEffectTexture = {
  rights: "fan-local-derived", converterVersion: 3, assetId: SHIELD_WAVE_EFFECT_ID,
  source: { canonicalPath: "data\\texture\\effect\\shield_boomerang.bmp", bytes: 12344, sha256: "3".repeat(64) },
  kind: "texture", format: "bmp", width: 64, height: 64, bitsPerPixel: 24,
  alpha: { mode: "ro-color-key", keyedPixels: 1 },
  derived: { file: `${SHIELD_WAVE_EFFECT_ID}.png`, sha256: "4".repeat(64), width: 64, height: 64 }, filter: "nearest",
};
function data(): FormalSceneData {
  const models = new Map([["model.m", model]]);
  const images = new Map<string, { width: number; height: number; tag: string }>([
    ["tex.a", img(8, 8, "tex.a")], ["tex.b", img(8, 8, "tex.b")], ["tex.m", img(8, 8, "tex.m")],
    ["map.prt_fild08.gnd", img(16, 8, "lightmap")], ["common.shadow.spr", img(17, 8, "shadow")],
  ]);
  return {
    scene, gnd, ground: buildGroundBuffers(gnd), models, baked: new Map([["model.m", bakeModel(model)]]), instances: buildModelInstances(scene, gnd, models),
    shadow, shadowParams: shadowParams(shadow), sounds: soundPlacements(scene, gnd), images,
    water: new Map(frames.map((f) => [f, img(128, 128, f)])), waterCells: buildWaterBuffers(gnd, 1), audio: new Map([["bgm.prt_fild08", new ArrayBuffer(4)], ["wav.1", new ArrayBuffer(4)]]),
    effects: new Map([[SHIELD_WAVE_EFFECT_ID, shieldEffect]]), effectImages: new Map([[SHIELD_WAVE_EFFECT_ID, img(64, 64, "shield-wave")]]),
  };
}
const gat = { width: 4, height: 4, types: "0".repeat(16), cellHeights: new Array<number>(16).fill(0) };
const factory: TextureFactory = (image) => {
  const t = new THREE.Texture(image as unknown as HTMLImageElement);
  t.name = (image as { tag?: string }).tag ?? "";
  return t;
};
const uniformImage = (m: THREE.Mesh, u: string) => ((m.material as THREE.ShaderMaterial).uniforms[u]?.value as THREE.Texture).name;

describe("formal ground: GND texture UVs + vertex colour + embedded lightmap (structural, golden)", () => {
  it("one up quad per cube plus linked walls; UV, lightmap UV and colour come from the surface", () => {
    const g = buildGroundBuffers(gnd);
    expect(g.quads).toBe(4 + 1); // 4 up surfaces + 1 right wall
    const a = g.groups.find((x) => x.assetId === "tex.a");
    expect(a?.colors.slice(0, 3)).toEqual([1, 128 / 255, 0]);
    expect(a?.uvs.slice(0, 6)).toEqual([0, 0, 1, 0, 0, 1]);
    expect(a?.lightmapUvs.slice(0, 2)).toEqual([1 / 16, 1 / 8]); // inner 6×6 texels of lightmap 0
    const b = g.groups.find((x) => x.assetId === "tex.b");
    expect(b?.lightmapUvs.slice(0, 2)).toEqual([9 / 16, 1 / 8]); // lightmap 1 in column 1
    // tex.b = cube 0's right wall (first) + cube 1's up surface at height -5 RO units -> +1 m.
    expect(b?.positions.length).toBe(2 * 6 * 3);
    expect(Math.max(...(b?.positions.filter((_, i) => i % 3 === 1) ?? []))).toBeCloseTo(1);
  });

  it("FormalWorld meshes use the GND texture and the lightmap atlas; no fixture shading", () => {
    const w = new FormalWorld(data(), gat, factory);
    expect(w.kind).toBe("formal");
    expect(w.groundMeshes.map((m) => uniformImage(m, "uMap")).sort()).toEqual(["tex.a", "tex.b"]);
    for (const m of w.groundMeshes) {
      expect(uniformImage(m, "uLightmap")).toBe("lightmap");
      expect(m.geometry.getAttribute("uvLightmap")).toBeDefined();
      expect(m.geometry.getAttribute("color")).toBeDefined();
      expect((m.material as THREE.ShaderMaterial).fragmentShader).toContain("lm.a + lm.rgb");
    }
    expect(JSON.stringify(w.object.children.map((c) => c.userData))).not.toContain("fixture");
    expect(w.skillEffects.sourceAssetId).toBe(SHIELD_WAVE_EFFECT_ID);
    expect(w.skillEffects.mesh.userData).toMatchObject({ formal: "skill-effect", sourceAssetId: SHIELD_WAVE_EFFECT_ID });
  });
});

describe("formal props: GRSM instances", () => {
  it("one InstancedMesh per (model, texture) with one instance per RSW placement", () => {
    const w = new FormalWorld(data(), gat, factory);
    expect(w.propMeshes).toHaveLength(1);
    expect(w.propMeshes[0]?.count).toBe(2);
    expect(((w.propMeshes[0]?.material as THREE.MeshBasicMaterial).map as THREE.Texture).name).toBe("tex.m");
    const m = new THREE.Matrix4();
    w.propMeshes[0]?.getMatrixAt(1, m);
    const pos = new THREE.Vector3().setFromMatrixPosition(m);
    // GND half extent = 2 tiles × 10 / 2 = 10 RO units: x = (5 + 10) × 0.2, height = 2 × 0.2, z = -(5 + 10) × 0.2.
    expect([pos.x, pos.y, pos.z].map((v) => Math.round(v * 100) / 100)).toEqual([3, 0.4, -3]);
  });

  it("an unresolved placement or a face texture outside the node blocks", () => {
    const models = new Map<string, DerivedModel>();
    expect(() => buildModelInstances(scene, gnd, models)).toThrow(/model m\.rsm is not loaded/u);
    const bad = { ...model, nodes: [{ ...model.nodes[0], faces: [{ vertices: [0, 1, 2], tvertices: [0, 1, 2], texture: 3, twoSide: false }] }] } as DerivedModel;
    expect(() => bakeModel(bad)).toThrow(/face texture 3/u);
  });
});

describe("water only on the selected GND cells (golden 2×2)", () => {
  it("selects exactly the cells whose lowest corner is below the RSW level; no whole-map plane", () => {
    const b = buildWaterBuffers(gnd, 1);
    expect(b.cells).toBe(1);
    expect(b.positions).toHaveLength(1 * 6 * 3);
    const xs = b.positions.filter((_, i) => i % 3 === 0);
    const ys = b.positions.filter((_, i) => i % 3 === 1);
    const zs = b.positions.filter((_, i) => i % 3 === 2);
    expect([Math.min(...xs), Math.max(...xs)]).toEqual([0, 2]); // cube 2 = (x 0, y 1): one 2 m tile
    expect([Math.min(...zs), Math.max(...zs)]).toEqual([-4, -2]);
    expect(new Set(ys)).toEqual(new Set([-0.2])); // RSW level 1 × 0.2 m, flat (no waves)
    expect(buildWaterBuffers(gnd, 3).cells).toBe(0);
    expect(buildWaterBuffers(gnd, -6).cells).toBe(4);
  });

  it("FormalWorld draws exactly those cells and fails closed when the count disagrees with the derived scene", () => {
    const w = new FormalWorld(data(), gat, factory);
    expect(w.water?.geometry.getAttribute("position").count).toBe(6);
    expect(w.water?.userData).toMatchObject({ formal: "water", cells: 1 });
    expect(w.water?.geometry.type).toBe("BufferGeometry");
    expect(() => new FormalWorld({ ...data(), waterCells: buildWaterBuffers(gnd, -6) }, gat, factory)).toThrow(/water cells 4 != derived 1/u);
  });
});

describe("official water and shadow", () => {
  it("water cycles through the 32 official frames by RSW anim speed", () => {
    const w = new FormalWorld(data(), gat, factory);
    expect(w.waterFrame).toBe("water.001");
    w.update(1000); // 60 ticks / animSpeed 3 = frame 20
    expect(w.waterFrame).toBe("water.021");
    expect(waterFrameAt(scene.water as NonNullable<DerivedScene["water"]>, 60_000)).toBe(frames[(1200 % 32)]);
  });

  it("shadow = official SPR frame at scale 1.0 with ACT alpha 128", () => {
    const layer = new OfficialShadowLayer(data(), factory, 4);
    expect(layer.alpha).toBe(128 / 255);
    expect(layer.scale).toBe(1);
    const mat = layer.mesh.material as THREE.ShaderMaterial;
    expect(mat.uniforms.uAlpha?.value).toBe(128 / 255);
    expect((mat.uniforms.uMap?.value as THREE.Texture).name).toBe("shadow");
    layer.mesh.geometry.computeBoundingBox();
    const size = new THREE.Vector3();
    layer.mesh.geometry.boundingBox?.getSize(size);
    expect([size.x, size.z].map((v) => Math.round(v * 1000) / 1000)).toEqual([0.4, 0.2]); // 16×8 px × 0.025 m
    layer.set([1, 0, -1, 2, 0, -2]);
    expect(layer.mesh.count).toBe(2);
    layer.set([1, 0, -1, 2, 0, -2], [0.5, 1.45]);
    const matrix = new THREE.Matrix4();
    layer.mesh.getMatrixAt(1, matrix);
    const scale = new THREE.Vector3();
    matrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
    expect(scale.x).toBeCloseTo(1.45);
    expect(scale.z).toBeCloseTo(1.45);
  });
});

describe("four-layer swordsman", () => {
  const full: SheetData = {
    atlas: { width: 1, height: 1 }, slots: {} as SheetData["slots"], frames: [],
    layers: [
      { spr: "player.swordsman.male.body.spr", act: "player.swordsman.male.body.act", palette: "palette.body.swordsman.male" },
      { spr: "player.hair01.male.spr", act: "player.hair01.male.act", palette: "palette.hair01.male" },
      { spr: "player.swordsman.male.sword.spr", act: "player.swordsman.male.sword.act", palette: null },
      { spr: "player.swordsman.male.guard.spr", act: "player.swordsman.male.guard.act", palette: null },
    ],
    layerOrder: [[0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3], [2, 3, 0, 1], [2, 3, 0, 1], [2, 3, 0, 1], [0, 1, 2, 3], [0, 1, 2, 3]],
  };
  it("accepts body + hair + sword + guard with original palettes and per-direction order", () => {
    expect(checkPlayerLayers(full)).toEqual([]);
  });
  it("rejects a body-only atlas, a missing palette and a missing layer order", () => {
    expect(checkPlayerLayers({ ...full, layers: full.layers?.slice(0, 1) }).map((m) => m.assetId)).toEqual(["player.hair01.male.spr", "player.swordsman.male.sword.spr", "player.swordsman.male.guard.spr"]);
    const noPal = full.layers?.map((l, i) => (i === 1 ? { ...l, palette: null } : l));
    expect(checkPlayerLayers({ ...full, layers: noPal }).map((m) => m.assetId)).toEqual(["palette.hair01.male"]);
    expect(checkPlayerLayers({ ...full, layerOrder: undefined }).map((m) => m.assetId)).toEqual(["player.swordsman.male.body.act"]);
  });
});

function fakeCtx(state: "suspended" | "running") {
  const log: string[] = [];
  const param = () => ({ value: 0 });
  const ctx = {
    state,
    destination: "dest",
    listener: { positionX: param(), positionY: param(), positionZ: param() },
    resume: () => { ctx.state = "running"; log.push("resume"); return Promise.resolve(); },
    close: () => Promise.resolve(),
    decodeAudioData: (b: ArrayBuffer) => Promise.resolve({ bytes: b.byteLength }),
    createBufferSource: () => ({ buffer: null as unknown, loop: false, connect: () => undefined, start: () => log.push("start"), stop: () => undefined }),
    createPanner: () => ({ refDistance: 0, maxDistance: 0, positionX: param(), positionY: param(), positionZ: param(), connect: () => undefined }),
    createGain: () => ({ gain: { value: 0 }, connect: () => undefined }),
  };
  return { ctx: ctx as unknown as AudioContextLike & { state: string }, log };
}

describe("formal audio: BGM 12 + RSW-positioned WAVs, autoplay gate", () => {
  it("blocked autoplay -> needsGesture, nothing plays; the 點擊啟用音訊 action resumes and starts the originals", async () => {
    const { ctx, log } = fakeCtx("suspended");
    const a = new FormalAudio(ctx, data());
    await a.prepare();
    expect(a.tryStart()).toBe(false);
    expect(a.needsGesture).toBe(true);
    expect(log).toEqual([]);
    await a.enable();
    expect(log).toEqual(["resume", "start", "start"]);
    expect(a.sources.map((s) => s.assetId)).toEqual(["bgm.prt_fild08", "wav.1"]);
    const p = a.sources[1]?.panner;
    expect([p?.positionX.value, p?.positionY.value, p?.positionZ.value]).toEqual([2, 1, -2]); // map centre (1 tile = 2 m); height 5 × 0.2
    expect(p?.maxDistance).toBe(20); // range 100 RO units × 0.2
  });

  it("running context starts immediately; decode failure is an error, not a substitute", async () => {
    const { ctx } = fakeCtx("running");
    const a = new FormalAudio(ctx, data());
    await a.prepare();
    expect(a.tryStart()).toBe(true);
    const bad = fakeCtx("running").ctx;
    bad.decodeAudioData = () => Promise.reject(new Error("EncodingError"));
    await expect(new FormalAudio(bad, data()).prepare()).rejects.toThrow(/EncodingError/u);
  });

  it("maps authoritative skill/hit events to official one-shot WAVs only", async () => {
    const d = data();
    for (const id of FORMAL_SKILL_AUDIO_IDS) d.audio.set(id, new ArrayBuffer(8));
    const { ctx } = fakeCtx("running");
    const a = new FormalAudio(ctx, d);
    await a.prepare();
    expect(a.tryStart()).toBe(true);
    a.playEvents([
      { type: "skill", source: "skill.sw.bash" } as RunEvent,
      { type: "hit", source: "skill.sw.basic_slash" } as RunEvent,
      { type: "hit", source: "skill.sw.bash" } as RunEvent,
      { type: "skill", source: "skill.sw.basic_slash" } as RunEvent,
    ]);
    expect(a.sources.slice(-2).map((s) => [s.assetId, s.source.loop])).toEqual([
      ["audio.skill.sw.bash", false],
      ["audio.hit.physical", false],
    ]);
  });

  it("throttles dense repeated cues across frames so mobile audio voices stay bounded", async () => {
    const d = data();
    for (const id of FORMAL_SKILL_AUDIO_IDS) d.audio.set(id, new ArrayBuffer(8));
    let now = 1_000;
    const { ctx } = fakeCtx("running");
    const a = new FormalAudio(ctx, d, () => now);
    await a.prepare();
    expect(a.tryStart()).toBe(true);
    const hit = [{ type: "hit", source: "skill.sw.basic_slash" } as RunEvent];
    a.playEvents(hit);
    a.playEvents(hit);
    expect(a.sources.filter((entry) => entry.assetId === "audio.hit.physical")).toHaveLength(1);
    now += 55;
    a.playEvents(hit);
    expect(a.sources.filter((entry) => entry.assetId === "audio.hit.physical")).toHaveLength(2);
  });

  it("stops sources and closes the context at most once during repeated cleanup", async () => {
    const { ctx } = fakeCtx("running");
    let stopped = 0;
    let closed = 0;
    const originalSource = ctx.createBufferSource.bind(ctx);
    ctx.createBufferSource = () => {
      const source = originalSource();
      source.stop = () => { stopped += 1; };
      return source;
    };
    ctx.close = () => { closed += 1; ctx.state = "closed"; return Promise.resolve(); };
    const audio = new FormalAudio(ctx, data());
    await audio.prepare();
    expect(audio.tryStart()).toBe(true);
    audio.dispose();
    audio.dispose();
    expect(stopped).toBe(2);
    expect(closed).toBe(1);
  });
});

describe("formal / fixture graph separation", () => {
  const src = resolve(import.meta.dirname, "../src");
  const staticImports = (file: string): string[] =>
    [...readFileSync(file, "utf8").matchAll(/^\s*import\s+(?!type\b)(?:[^"']*?from\s+)?["'](\.[^"']+)["']/gmu)].map((m) => resolve(dirname(file), m[1] as string));
  it("nothing reachable by static imports from main.tsx is a fixture-only module", () => {
    const seen = new Set<string>();
    const walk = (f: string): void => {
      if (seen.has(f) || !/\.(ts|tsx)$/u.test(f)) return;
      seen.add(f);
      for (const n of staticImports(f)) walk(n);
    };
    walk(join(src, "main.tsx"));
    const rel = [...seen].map((f) => relative(src, f).split(sep).join("/")).sort(); // POSIX on every OS
    expect(rel).toContain("game/formal/world.ts");
    expect(rel.filter((f) => f.startsWith("game/fixture/") || f === "BenchApp.tsx" || f === "game/loop.ts")).toEqual([]);
    // UI-B3: the formal entry must reach both the fail-closed UI loader and the guarded RO HUD.
    expect(rel).toEqual(expect.arrayContaining([
      "game/formal/ui.ts",
      "screens/Hud.tsx",
      "ui/ro/index.ts",
      "ui/ro/raster.ts",
    ]));
  });

  it("fixture modules are only imported dynamically behind the compile-time flag", () => {
    for (const f of ["main.tsx", "App.tsx"]) {
      const lines = readFileSync(join(src, f), "utf8").split("\n");
      lines.forEach((line, i) => {
        if (/import\(["']\.\/(?:BenchApp|game\/fixture\/)/u.test(line)) expect(lines.slice(Math.max(0, i - 4), i + 1).join("\n"), `${f}:${i + 1}`).toMatch(/FIXTURE_BUILD/u);
      });
    }
  });

  it("only --mode fixture builds the fixture bundle; env variables cannot turn a formal build into one", () => {
    expect(resolveClientBuild("production")).toEqual({ fixture: false, outDir: "dist" });
    expect(resolveClientBuild("development")).toEqual({ fixture: false, outDir: "dist" });
    expect(resolveClientBuild("fixture")).toEqual({ fixture: true, outDir: "dist-test" });
    expect(readFileSync(join(src, "gateway.ts"), "utf8")).not.toContain("VITE_ALLOW_SYNTHETIC");
  });
});

describe("audio decode failure names the exact asset (never defaults to BGM)", () => {
  const ids = ["bgm.prt_fild08", "map.prt_fild08.ambient_sound.001", "map.prt_fild08.ambient_sound.002", "map.prt_fild08.ambient_sound.003", "map.prt_fild08.ambient_sound.004", ...FORMAL_SKILL_AUDIO_IDS];
  it.each(ids)("%s fails to decode -> blocked with that ID and its canonical path", async (failing) => {
    const audioMap = new Map(ids.map((id, i) => [id, new ArrayBuffer(i + 1)]));
    const { ctx } = fakeCtx("running");
    const bad = ids.indexOf(failing) + 1;
    ctx.decodeAudioData = (b: ArrayBuffer) => (b.byteLength === bad ? Promise.reject(new Error("EncodingError")) : Promise.resolve({}));
    const err = await prepareFormalAudio(new FormalAudio(ctx, { ...data(), audio: audioMap }), whitelist).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MissingAssetsError);
    expect((err as MissingAssetsError).missing).toEqual([
      expect.objectContaining({ assetId: failing, canonicalPath: whitelist.get(failing).canonical_cp949_path, reason: expect.stringContaining("EncodingError") as unknown }),
    ]);
  });
});
