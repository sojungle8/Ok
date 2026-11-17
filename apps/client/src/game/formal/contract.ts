/**
 * Derived scene contract produced by `pnpm assets:extract --profile fan-local` (converter v2,
 * tools/assets/scene-extract.ts) and consumed by the formal renderer. Pure data + pure builders: no
 * three.js, no DOM, so the same code is checked against real extractor output in tests.
 */

export interface DerivedGnd {
  assetId: string;
  converterVersion: number;
  version: string;
  width: number;
  height: number;
  zoom: number;
  textures: { name: string; assetId: string | null }[];
  lightmap: { count: number; perCell: [number, number, number]; atlas: { file: string; width: number; height: number; cols: number; layout: string } };
  surfaces: { u: number[]; v: number[]; texture: number[]; lightmap: number[]; color: number[] };
  cubes: { heights: number[]; up: number[]; front: number[]; right: number[] };
}

export interface DerivedRsmNode {
  name: string;
  parent: string;
  textures: number[];
  matrix: number[];
  offset: [number, number, number];
  position: [number, number, number];
  rotAngle: number;
  rotAxis: [number, number, number];
  scale: [number, number, number];
  vertices: [number, number, number][];
  tvertices: { color: number; u: number; v: number }[];
  faces: { vertices: [number, number, number]; tvertices: [number, number, number]; texture: number; twoSide: boolean }[];
}

export interface DerivedModel {
  assetId: string;
  version: string;
  alpha: number;
  textures: { name: string; assetId: string | null }[];
  mainNode: string;
  nodes: DerivedRsmNode[];
}

export interface DerivedTextureMeta {
  assetId: string;
  format: "bmp" | "jpg";
  width: number;
  height: number;
  derived: { file: string; sha256: string } | { file: null; servedAs: "source" };
}

export interface DerivedScene {
  assetId: string;
  converterVersion: number;
  ground: string;
  water: { level: number; type: number | null; waveHeight: number | null; waveSpeed: number | null; wavePitch: number | null; animSpeed: number | null; frames: string[]; cells: number } | null;
  models: { name: string; file: string; modelAssetId: string | null; position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number] }[];
  sounds: { name: string; file: string; assetId: string | null; position: [number, number, number]; volume: number; width: number; height: number; range: number; cycle: number | null }[];
  bgm: string;
  shadow: string;
  textures: DerivedTextureMeta[];
}

export interface DerivedShadow {
  assetId: string;
  atlas: { width: number; height: number; file: string };
  frames: { x: number; y: number; w: number; h: number; type: "indexed" | "rgba"; index: number }[];
  actions: { delay: number; frames: { layers: { sprIndex: number; sprType: "indexed" | "rgba"; x: number; y: number; color: [number, number, number, number]; scaleX: number; scaleY: number }[] }[] }[];
  layerAlpha: number[];
}

/** 1 RO world unit = 0.2 m (one GAT cell = 5 units = 1 m, D-020). */
export const RO_UNIT_M = 0.2;

/**
 * RSW object position (origin at the map centre, y pointing down) -> simulation metres (x east,
 * y north) + world height. The GND covers width*zoom × height*zoom RO units.
 */
export function rswToWorld(gnd: Pick<DerivedGnd, "width" | "height" | "zoom">, p: readonly [number, number, number]): { x: number; y: number; height: number } {
  return {
    x: (p[0] + (gnd.width * gnd.zoom) / 2) * RO_UNIT_M,
    y: (p[2] + (gnd.height * gnd.zoom) / 2) * RO_UNIT_M,
    height: -p[1] * RO_UNIT_M,
  };
}

export interface GroundBuffers {
  /** One draw group per GND texture index that is actually used. */
  groups: { texture: number; assetId: string; positions: number[]; uvs: number[]; lightmapUvs: number[]; colors: number[] }[];
  quads: number;
}

/**
 * Ground geometry from the GND: per cube an "up" quad (and front / right walls when linked), each
 * carrying the surface's own texture UVs, its vertex colour and its embedded-lightmap UV (8×8 tile,
 * inner 6×6 texels). World: x east, y up, z = -north; 1 GND tile = zoom RO units.
 */
export function buildGroundBuffers(gnd: DerivedGnd): GroundBuffers {
  const { width: W, height: H, zoom } = gnd;
  const tile = zoom * RO_UNIT_M;
  const lm = gnd.lightmap.atlas;
  const [tw, th] = gnd.lightmap.perCell;
  const groups = new Map<number, GroundBuffers["groups"][number]>();
  let quads = 0;
  const h = (cube: number, corner: number): number => -(gnd.cubes.heights[cube * 4 + corner] ?? 0) * RO_UNIT_M;
  const addQuad = (surface: number, corners: [number, number, number][]): void => {
    const texture = gnd.surfaces.texture[surface] ?? -1;
    if (texture < 0) return;
    const assetId = gnd.textures[texture]?.assetId;
    if (!assetId) throw new Error(`GND surface ${surface}: texture ${texture} has no asset ID`);
    let g = groups.get(texture);
    if (!g) {
      g = { texture, assetId, positions: [], uvs: [], lightmapUvs: [], colors: [] };
      groups.set(texture, g);
    }
    const lmId = gnd.surfaces.lightmap[surface] ?? 0;
    const lx = (lmId % lm.cols) * tw;
    const ly = Math.floor(lmId / lm.cols) * th;
    const color = [0, 1, 2].map((k) => (gnd.surfaces.color[surface * 4 + k] ?? 255) / 255);
    // Two triangles: corners 0-1-2 and 2-1-3 (corner order: 0 = (x, y), 1 = (x+1, y), 2 = (x, y+1), 3 = (x+1, y+1)).
    for (const c of [0, 1, 2, 2, 1, 3]) {
      const p = corners[c] as [number, number, number];
      g.positions.push(p[0], p[1], p[2]);
      g.uvs.push(gnd.surfaces.u[surface * 4 + c] ?? 0, gnd.surfaces.v[surface * 4 + c] ?? 0);
      g.lightmapUvs.push((lx + 1 + (c % 2) * (tw - 2)) / lm.width, (ly + 1 + Math.floor(c / 2) * (th - 2)) / lm.height);
      g.colors.push(...color);
    }
    quads += 1;
  };
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const i = y * W + x;
      const x0 = x * tile;
      const x1 = (x + 1) * tile;
      const z0 = -y * tile;
      const z1 = -(y + 1) * tile;
      const up = gnd.cubes.up[i] ?? -1;
      if (up >= 0) addQuad(up, [[x0, h(i, 0), z0], [x1, h(i, 1), z0], [x0, h(i, 2), z1], [x1, h(i, 3), z1]]);
      const front = gnd.cubes.front[i] ?? -1;
      if (front >= 0 && y + 1 < H) {
        const n = i + W;
        addQuad(front, [[x0, h(i, 2), z1], [x1, h(i, 3), z1], [x0, h(n, 0), z1], [x1, h(n, 1), z1]]);
      }
      const right = gnd.cubes.right[i] ?? -1;
      if (right >= 0 && x + 1 < W) {
        const n = i + 1;
        addQuad(right, [[x1, h(i, 1), z0], [x1, h(i, 3), z1], [x1, h(n, 0), z0], [x1, h(n, 2), z1]]);
      }
    }
  }
  return { groups: [...groups.values()].sort((a, b) => a.texture - b.texture), quads };
}

export interface ModelInstance {
  modelAssetId: string;
  name: string;
  world: { x: number; y: number; height: number };
  rotationDeg: [number, number, number];
  scale: [number, number, number];
}

/** Every RSW placement must resolve to a loaded model; an unresolved one blocks the world. */
export function buildModelInstances(scene: DerivedScene, gnd: DerivedGnd, models: ReadonlyMap<string, DerivedModel>): ModelInstance[] {
  return scene.models.map((m) => {
    if (!m.modelAssetId || !models.has(m.modelAssetId)) throw new Error(`RSW placement ${m.name}: model ${m.file} is not loaded`);
    return { modelAssetId: m.modelAssetId, name: m.name, world: rswToWorld(gnd, m.position), rotationDeg: m.rotation, scale: m.scale };
  });
}

/** Shadow quad from the official shadow ACT (action 0, frame 0, layer 0) at scale 1.0. */
export function shadowParams(shadow: DerivedShadow): { rect: { x: number; y: number; w: number; h: number }; offsetX: number; offsetY: number; alpha: number; scale: 1 } {
  const layer = shadow.actions[0]?.frames[0]?.layers[0];
  if (!layer) throw new Error("official shadow ACT has no layer");
  const rect = shadow.frames.find((f) => f.type === layer.sprType && f.index === layer.sprIndex);
  if (!rect) throw new Error(`official shadow: frame ${layer.sprType} ${layer.sprIndex} missing`);
  return { rect: { x: rect.x, y: rect.y, w: rect.w, h: rect.h }, offsetX: layer.x, offsetY: layer.y, alpha: layer.color[3] / 255, scale: 1 };
}

/** RSW ambient sounds -> world positions; every sound must have a whitelisted asset. */
export function soundPlacements(scene: DerivedScene, gnd: DerivedGnd): { assetId: string; world: { x: number; y: number; height: number }; volume: number; rangeM: number; cycleS: number | null }[] {
  return scene.sounds.map((s) => {
    if (!s.assetId) throw new Error(`RSW sound ${s.name}: ${s.file} has no asset ID`);
    return { assetId: s.assetId, world: rswToWorld(gnd, s.position), volume: s.volume, rangeM: s.range * RO_UNIT_M, cycleS: s.cycle };
  });
}

export interface WaterBuffers {
  /** Selected GND cells (same rule as the extractor: max(corner heights) > water level). */
  cells: number;
  /** Two triangles per selected cell at the RSW water level (world metres, z = -north). */
  positions: number[];
  /** One official frame spans two GND tiles (repeat wrapping); calibrated locally (DEFERRED_LOCAL). */
  uvs: number[];
}

/**
 * Water surface only over the GND cells that lie below the RSW water level — the rule the
 * extractor uses for `scene.water.cells` (RO heights grow downwards). Waves are not applied.
 */
export function buildWaterBuffers(gnd: DerivedGnd, level: number): WaterBuffers {
  const tile = gnd.zoom * RO_UNIT_M;
  const y = -level * RO_UNIT_M;
  const positions: number[] = [];
  const uvs: number[] = [];
  let cells = 0;
  for (let cy = 0; cy < gnd.height; cy += 1) {
    for (let cx = 0; cx < gnd.width; cx += 1) {
      const i = cy * gnd.width + cx;
      const hs = [0, 1, 2, 3].map((k) => gnd.cubes.heights[i * 4 + k] ?? 0);
      if (!(Math.max(...hs) > level)) continue;
      cells += 1;
      const corners: [number, number][] = [[cx, cy], [cx + 1, cy], [cx, cy + 1], [cx + 1, cy + 1]];
      for (const c of [0, 1, 2, 2, 1, 3]) {
        const [gx, gy] = corners[c] as [number, number];
        positions.push(gx * tile, y, -gy * tile);
        uvs.push(gx / 2, gy / 2);
      }
    }
  }
  return { cells, positions, uvs };
}

/** Water frame for a time: RO advances one of the 32 frames every `animSpeed` render frames (60 Hz). */
export function waterFrameAt(water: NonNullable<DerivedScene["water"]>, timeMs: number): string {
  if (water.frames.length === 0) throw new Error("water has no frames");
  const ticks = Math.floor((timeMs / 1000) * 60);
  const step = Math.max(1, water.animSpeed ?? 3);
  return water.frames[Math.floor(ticks / step) % water.frames.length] as string;
}

/** Every derived / source asset the formal scene needs, by logical ID (all must load or the world is blocked). */
export function sceneRequiredIds(scene: DerivedScene): { derivedJson: string[]; derivedPng: string[]; source: string[] } {
  const models = [...new Set(scene.models.map((m) => m.modelAssetId).filter((x): x is string => x !== null))].sort();
  return {
    derivedJson: [scene.ground, ...models, `${scene.shadow}.act`],
    derivedPng: [scene.ground, `${scene.shadow}.spr`, ...scene.textures.filter((t) => t.format === "bmp").map((t) => t.assetId)],
    source: [...(scene.water?.frames ?? []), scene.bgm, ...scene.sounds.map((s) => s.assetId).filter((x): x is string => x !== null)],
  };
}

type M4 = number[]; // column-major 4×4
const ident = (): M4 => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function mul(a: M4, b: M4): M4 {
  const o = new Array<number>(16).fill(0);
  for (let c = 0; c < 4; c += 1) for (let r = 0; r < 4; r += 1) for (let k = 0; k < 4; k += 1) o[c * 4 + r] = (o[c * 4 + r] as number) + (a[k * 4 + r] as number) * (b[c * 4 + k] as number);
  return o;
}
const translate = (x: number, y: number, z: number): M4 => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
const scaleM = (x: number, y: number, z: number): M4 => [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1];
function axisAngle(axis: readonly [number, number, number], angle: number): M4 {
  const len = Math.hypot(...axis);
  if (len === 0 || angle === 0) return ident();
  const [x, y, z] = axis.map((v) => v / len) as [number, number, number];
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const t = 1 - c;
  return [t * x * x + c, t * x * y + s * z, t * x * z - s * y, 0, t * x * y - s * z, t * y * y + c, t * y * z + s * x, 0, t * x * z + s * y, t * y * z - s * x, t * z * z + c, 0, 0, 0, 0, 1];
}
const apply = (m: M4, v: readonly [number, number, number]): [number, number, number] => [
  (m[0] as number) * v[0] + (m[4] as number) * v[1] + (m[8] as number) * v[2] + (m[12] as number),
  (m[1] as number) * v[0] + (m[5] as number) * v[1] + (m[9] as number) * v[2] + (m[13] as number),
  (m[2] as number) * v[0] + (m[6] as number) * v[1] + (m[10] as number) * v[2] + (m[14] as number),
];

export interface BakedModel {
  /** Per model-texture index: triangles in world-scale model space (metres, y up, z = -north), origin at the bottom centre. */
  groups: { texture: number; assetId: string; positions: number[]; uvs: number[] }[];
  triangles: number;
}

/**
 * Static pose of a legacy GRSM model: every node's vertices go through its 3×3 shape matrix and
 * offset, then its node transform (position for child nodes, axis-angle rotation, scale) and the
 * parent chain; the result is recentred on the bounding-box bottom centre (RO y points down) and
 * converted to metres. Animation keys are not applied (static props). The exact RO transform order
 * is confirmed against the user's client locally (DEFERRED_LOCAL).
 */
export function bakeModel(model: DerivedModel): BakedModel {
  const byName = new Map(model.nodes.map((n) => [n.name, n]));
  const worldOf = new Map<string, M4>();
  const nodeWorld = (name: string, depth = 0): M4 => {
    const cached = worldOf.get(name);
    if (cached) return cached;
    const n = byName.get(name);
    if (!n || depth > 64) throw new Error(`RSM ${model.assetId}: node ${name} missing or cyclic`);
    const isMain = n.name === model.mainNode || n.parent === "" || n.parent === n.name;
    const local = mul(mul(isMain ? ident() : translate(...n.position), axisAngle(n.rotAxis, n.rotAngle)), scaleM(...n.scale));
    const w = isMain ? local : mul(nodeWorld(n.parent, depth + 1), local);
    worldOf.set(name, w);
    return w;
  };
  const tris: { texture: number; p: [number, number, number][]; uv: [number, number][] }[] = [];
  for (const n of model.nodes) {
    const m = n.matrix;
    const shape: M4 = [m[0] ?? 1, m[1] ?? 0, m[2] ?? 0, 0, m[3] ?? 0, m[4] ?? 1, m[5] ?? 0, 0, m[6] ?? 0, m[7] ?? 0, m[8] ?? 1, 0, n.offset[0], n.offset[1], n.offset[2], 1];
    const full = mul(nodeWorld(n.name), shape);
    for (const f of n.faces) {
      const texture = n.textures[f.texture];
      if (texture === undefined) throw new Error(`RSM ${model.assetId} node ${n.name}: face texture ${f.texture} not in node textures`);
      const p = f.vertices.map((vi) => apply(full, n.vertices[vi] as [number, number, number]));
      const uv = f.tvertices.map((ti) => [n.tvertices[ti]?.u ?? 0, n.tvertices[ti]?.v ?? 0] as [number, number]);
      tris.push({ texture, p, uv });
    }
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const t of tris) for (const [x, y, z] of t.p) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const groups = new Map<number, BakedModel["groups"][number]>();
  for (const t of tris) {
    const assetId = model.textures[t.texture]?.assetId;
    if (!assetId) throw new Error(`RSM ${model.assetId}: texture ${t.texture} has no asset ID`);
    let g = groups.get(t.texture);
    if (!g) {
      g = { texture: t.texture, assetId, positions: [], uvs: [] };
      groups.set(t.texture, g);
    }
    t.p.forEach(([x, y, z], k) => {
      g.positions.push((x - cx) * RO_UNIT_M, -(y - maxY) * RO_UNIT_M, -(z - cz) * RO_UNIT_M);
      g.uvs.push(...(t.uv[k] as [number, number]));
    });
  }
  return { groups: [...groups.values()].sort((a, b) => a.texture - b.texture), triangles: tris.length };
}
