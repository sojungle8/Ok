import { BinaryReader, expectMagic, FormatError } from "./binary.ts";

export interface GndSurface {
  u: [number, number, number, number];
  v: [number, number, number, number];
  textureId: number;
  lightmapId: number;
  color: [number, number, number, number];
}

export interface GndCube {
  heights: [number, number, number, number];
  tileUp: number;
  tileFront: number;
  tileRight: number;
}

export interface Gnd {
  version: string;
  width: number;
  height: number;
  zoom: number;
  textures: string[];
  lightmap: { count: number; perCell: [number, number, number] };
  surfaces: GndSurface[];
  cubes: GndCube[];
}

/** GND 1.5 – 1.7 (cube tile indices are i32). Older versions are rejected explicitly. */
export function parseGnd(bytes: Uint8Array): Gnd {
  const r = new BinaryReader(bytes, "GND");
  expectMagic(r, "GRGN");
  const major = r.u8();
  const minor = r.u8();
  const version = `${major}.${minor}`;
  if (major !== 1 || minor < 5 || minor > 9) throw new FormatError("GND", `unsupported version ${version}`);
  const width = r.i32();
  const height = r.i32();
  const zoom = r.f32();
  const textureCount = r.i32();
  const nameLength = r.i32();
  if (width <= 0 || height <= 0 || width > 1024 || height > 1024) throw new FormatError("GND", `bad size ${width}x${height}`);
  if (textureCount < 0 || textureCount > 4096 || nameLength <= 0 || nameLength > 256) {
    throw new FormatError("GND", `bad texture table ${textureCount}x${nameLength}`);
  }
  const textures: string[] = [];
  for (let i = 0; i < textureCount; i += 1) textures.push(r.cstring(nameLength));
  const lightmapCount = r.i32();
  const perCell: [number, number, number] = [r.i32(), r.i32(), r.i32()];
  const lmBytes = perCell[0] * perCell[1] * perCell[2] * 4;
  if (lightmapCount < 0 || lmBytes <= 0 || lmBytes > 4096) throw new FormatError("GND", `bad lightmap header ${lightmapCount} ${perCell.join("x")}`);
  r.skip(lightmapCount * lmBytes);
  const surfaceCount = r.i32();
  if (surfaceCount < 0 || surfaceCount > 4_000_000) throw new FormatError("GND", `bad surface count ${surfaceCount}`);
  const surfaces: GndSurface[] = [];
  for (let i = 0; i < surfaceCount; i += 1) {
    const u: [number, number, number, number] = [r.f32(), r.f32(), r.f32(), r.f32()];
    const v: [number, number, number, number] = [r.f32(), r.f32(), r.f32(), r.f32()];
    const textureId = r.i16();
    const lightmapId = r.u16();
    const b = r.u8();
    const g = r.u8();
    const rr = r.u8();
    const a = r.u8();
    surfaces.push({ u, v, textureId, lightmapId, color: [rr, g, b, a] });
  }
  const cubes: GndCube[] = [];
  for (let i = 0; i < width * height; i += 1) {
    const heights: [number, number, number, number] = [r.f32(), r.f32(), r.f32(), r.f32()];
    cubes.push({ heights, tileUp: r.i32(), tileFront: r.i32(), tileRight: r.i32() });
  }
  if (r.remaining !== 0) throw new FormatError("GND", `${r.remaining} trailing bytes after parse`);
  return { version, width, height, zoom, textures, lightmap: { count: lightmapCount, perCell }, surfaces, cubes };
}
