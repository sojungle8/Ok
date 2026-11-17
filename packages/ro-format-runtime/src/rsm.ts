import { BinaryReader, expectMagic, FormatError } from "./binary.ts";

export interface RsmFace {
  vertices: [number, number, number];
  tvertices: [number, number, number];
  /** Index into the node's texture list. */
  texture: number;
  twoSide: boolean;
  smoothGroup: number;
}

export interface RsmNode {
  name: string;
  parent: string;
  /** Indices into the model's texture table. */
  textures: number[];
  /** Row-major 3x3 transform. */
  matrix: [number, number, number, number, number, number, number, number, number];
  offset: [number, number, number];
  position: [number, number, number];
  rotAngle: number;
  rotAxis: [number, number, number];
  scale: [number, number, number];
  vertices: [number, number, number][];
  /** Texture vertices: colour (ARGB u32, 0xFFFFFFFF before 1.2) + u, v. */
  tvertices: { color: number; u: number; v: number }[];
  faces: RsmFace[];
  posKeyframes: { frame: number; position: [number, number, number] }[];
  rotKeyframes: { frame: number; quaternion: [number, number, number, number] }[];
}

export interface Rsm {
  version: string;
  animLength: number;
  shadeType: number;
  /** 0–255 (1.4+), 255 otherwise. */
  alpha: number;
  /** Texture names relative to data\texture\. */
  textures: string[];
  mainNode: string;
  nodes: RsmNode[];
  posKeyframes: { frame: number; position: [number, number, number] }[];
  volumeBoxes: { size: [number, number, number]; position: [number, number, number]; rotation: [number, number, number]; flag: number }[];
  trailingBytes: number;
}

const LIMIT = 1_000_000;
function count(r: BinaryReader, what: string, max = LIMIT): number {
  const n = r.i32();
  if (n < 0 || n > max) throw new FormatError("RSM", `bad ${what} count ${n} at offset ${r.offset - 4}`);
  return n;
}
const v3 = (r: BinaryReader): [number, number, number] => [r.f32(), r.f32(), r.f32()];

/**
 * Clean-room parser for GRSM 1.1 – 1.5 (prt_fild08 uses 1.4), written from public format
 * knowledge. RSM 2.x is rejected explicitly. Every index (texture, vertex, texture vertex) is
 * range-checked so a malformed model fails here instead of drawing garbage.
 */
export function parseRsm(bytes: Uint8Array): Rsm {
  const r = new BinaryReader(bytes, "RSM");
  expectMagic(r, "GRSM");
  const major = r.u8();
  const minor = r.u8();
  const version = `${major}.${minor}`;
  const v = major * 100 + minor;
  if (major !== 1 || minor < 1 || minor > 5) throw new FormatError("RSM", `unsupported version ${version} (supported 1.1-1.5)`);
  const animLength = r.i32();
  const shadeType = r.i32();
  const alpha = v >= 104 ? r.u8() : 255;
  r.skip(16);
  const textures: string[] = [];
  const texCount = count(r, "texture", 4096);
  for (let i = 0; i < texCount; i += 1) textures.push(r.cstring(40));
  const mainNode = r.cstring(40);
  const nodeCount = count(r, "node", 4096);
  if (nodeCount === 0) throw new FormatError("RSM", "model has no nodes");
  const nodes: RsmNode[] = [];
  for (let n = 0; n < nodeCount; n += 1) {
    const name = r.cstring(40);
    const parent = r.cstring(40);
    const nodeTextures: number[] = [];
    const ntc = count(r, "node texture", 4096);
    for (let i = 0; i < ntc; i += 1) {
      const t = r.i32();
      if (t < 0 || t >= textures.length) throw new FormatError("RSM", `node ${name}: texture index ${t} outside ${textures.length}`);
      nodeTextures.push(t);
    }
    const matrix = Array.from({ length: 9 }, () => r.f32()) as RsmNode["matrix"];
    const offset = v3(r);
    const position = v3(r);
    const rotAngle = r.f32();
    const rotAxis = v3(r);
    const scale = v3(r);
    const vertices: [number, number, number][] = [];
    const vc = count(r, "vertex");
    for (let i = 0; i < vc; i += 1) vertices.push(v3(r));
    const tvertices: RsmNode["tvertices"] = [];
    const tc = count(r, "texture vertex");
    for (let i = 0; i < tc; i += 1) {
      const color = v >= 102 ? r.u32() : 0xffffffff;
      tvertices.push({ color, u: r.f32(), v: r.f32() });
    }
    const faces: RsmFace[] = [];
    const fc = count(r, "face");
    for (let i = 0; i < fc; i += 1) {
      const vi: [number, number, number] = [r.u16(), r.u16(), r.u16()];
      const ti: [number, number, number] = [r.u16(), r.u16(), r.u16()];
      const texture = r.u16();
      r.skip(2);
      const twoSide = r.i32() !== 0;
      const smoothGroup = v >= 102 ? r.i32() : 0;
      if (vi.some((x) => x >= vc)) throw new FormatError("RSM", `node ${name} face ${i}: vertex index outside ${vc}`);
      if (ti.some((x) => x >= tc)) throw new FormatError("RSM", `node ${name} face ${i}: texture vertex index outside ${tc}`);
      if (texture >= ntc) throw new FormatError("RSM", `node ${name} face ${i}: texture ${texture} outside node's ${ntc}`);
      faces.push({ vertices: vi, tvertices: ti, texture, twoSide, smoothGroup });
    }
    const posKeyframes: RsmNode["posKeyframes"] = [];
    if (v >= 105) {
      const pk = count(r, "position keyframe");
      for (let i = 0; i < pk; i += 1) posKeyframes.push({ frame: r.i32(), position: v3(r) });
    }
    const rotKeyframes: RsmNode["rotKeyframes"] = [];
    const rk = count(r, "rotation keyframe");
    for (let i = 0; i < rk; i += 1) rotKeyframes.push({ frame: r.i32(), quaternion: [r.f32(), r.f32(), r.f32(), r.f32()] });
    nodes.push({ name, parent, textures: nodeTextures, matrix, offset, position, rotAngle, rotAxis, scale, vertices, tvertices, faces, posKeyframes, rotKeyframes });
  }
  if (!nodes.some((n) => n.name === mainNode)) throw new FormatError("RSM", `main node ${JSON.stringify(mainNode)} not found`);
  const names = new Set(nodes.map((n) => n.name));
  for (const n of nodes) {
    if (n.name !== mainNode && n.parent !== "" && !names.has(n.parent)) throw new FormatError("RSM", `node ${n.name}: unknown parent ${JSON.stringify(n.parent)}`);
  }
  const posKeyframes: Rsm["posKeyframes"] = [];
  if (v < 105 && r.remaining > 0) {
    const pk = count(r, "model position keyframe");
    for (let i = 0; i < pk; i += 1) posKeyframes.push({ frame: r.i32(), position: v3(r) });
  }
  const volumeBoxes: Rsm["volumeBoxes"] = [];
  if (r.remaining > 0) {
    const vb = count(r, "volume box", 4096);
    for (let i = 0; i < vb; i += 1) volumeBoxes.push({ size: v3(r), position: v3(r), rotation: v3(r), flag: v >= 103 ? r.i32() : 0 });
  }
  return { version, animLength, shadeType, alpha, textures, mainNode, nodes, posKeyframes, volumeBoxes, trailingBytes: r.remaining };
}
