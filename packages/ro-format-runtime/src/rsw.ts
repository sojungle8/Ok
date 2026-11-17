import { BinaryReader, expectMagic, FormatError } from "./binary.ts";

export interface RswModel {
  name: string;
  file: string;
  node: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

export interface RswSound {
  name: string;
  file: string;
  position: [number, number, number];
  volume: number;
  width: number;
  height: number;
  range: number;
  /** Seconds between plays (RSW ≥ 2.0), null otherwise. */
  cycle: number | null;
}

export interface Rsw {
  version: string;
  iniFile: string;
  gndFile: string;
  gatFile: string;
  srcFile: string;
  models: RswModel[];
  counts: { models: number; lights: number; sounds: number; effects: number };
  soundFiles: string[];
  /** Water type (RSW ≥ 1.8), or null when the version has no water type. */
  waterType: number | null;
  /** Water parameters (RSW ≥ 1.3); fields the version lacks are null. */
  water: { level: number; type: number | null; waveHeight: number | null; waveSpeed: number | null; wavePitch: number | null; animSpeed: number | null } | null;
  sounds: RswSound[];
}

function ver(major: number, minor: number): number {
  return major * 100 + minor;
}

/**
 * RSW 1.2 – 2.1 (classic maps such as prt_fild08). Newer layouts (2.2+ build numbers, 2.5+
 * extra fields) are rejected explicitly until a real file is checked locally.
 */
export function parseRsw(bytes: Uint8Array): Rsw {
  const r = new BinaryReader(bytes, "RSW");
  expectMagic(r, "GRSW");
  const major = r.u8();
  const minor = r.u8();
  const v = ver(major, minor);
  const version = `${major}.${minor}`;
  if (v < 102 || v > 201) throw new FormatError("RSW", `unsupported version ${version} (supported 1.2-2.1)`);
  const iniFile = r.cstring(40);
  const gndFile = r.cstring(40);
  const gatFile = v >= 104 ? r.cstring(40) : "";
  const srcFile = r.cstring(40);
  let water: Rsw["water"] = null;
  if (v >= 103) water = { level: r.f32(), type: null, waveHeight: null, waveSpeed: null, wavePitch: null, animSpeed: null };
  let waterType: number | null = null;
  if (v >= 108 && water) {
    waterType = r.i32();
    water.type = waterType;
    water.waveHeight = r.f32();
    water.waveSpeed = r.f32();
    water.wavePitch = r.f32();
  }
  if (v >= 109 && water) water.animSpeed = r.i32();
  if (v >= 105) r.skip(8 + 12 + 12); // light longitude/latitude, diffuse, ambient
  if (v >= 107) r.skip(4); // shadow opacity
  if (v >= 106) r.skip(16); // ground bounds
  const objectCount = r.i32();
  if (objectCount < 0 || objectCount > 200_000) throw new FormatError("RSW", `bad object count ${objectCount}`);
  const models: RswModel[] = [];
  const soundFiles: string[] = [];
  const sounds: RswSound[] = [];
  const counts = { models: 0, lights: 0, sounds: 0, effects: 0 };
  for (let i = 0; i < objectCount; i += 1) {
    const type = r.i32();
    if (type === 1) {
      let name = "";
      if (v >= 103) {
        name = r.cstring(40);
        r.skip(12); // anim type, anim speed, block type
      }
      const file = r.cstring(80);
      const node = r.cstring(80);
      const position: [number, number, number] = [r.f32(), r.f32(), r.f32()];
      const rotation: [number, number, number] = [r.f32(), r.f32(), r.f32()];
      const scale: [number, number, number] = [r.f32(), r.f32(), r.f32()];
      models.push({ name, file, node, position, rotation, scale });
      counts.models += 1;
    } else if (type === 2) {
      r.skip(80 + 12 + 12 + 4);
      counts.lights += 1;
    } else if (type === 3) {
      const name = r.cstring(80);
      const file = r.cstring(80);
      const position = [r.f32(), r.f32(), r.f32()] as [number, number, number];
      const volume = r.f32();
      const width = r.i32();
      const height = r.i32();
      const range = r.f32();
      const cycle = v >= 200 ? r.f32() : null;
      soundFiles.push(file);
      sounds.push({ name, file, position, volume, width, height, range, cycle });
      counts.sounds += 1;
    } else if (type === 4) {
      r.skip(80 + 12 + 4 + 4 + 16);
      counts.effects += 1;
    } else {
      throw new FormatError("RSW", `unknown object type ${type} at index ${i} (offset ${r.offset - 4})`);
    }
  }
  return { version, iniFile, gndFile, gatFile, srcFile, models, counts, soundFiles, waterType, water, sounds };
}

/** Dependency closure report: what a map needs beyond the whitelisted RSW/GND/GAT. */
export function mapDependencies(rsw: Rsw, gndTextures: readonly string[]): {
  gnd: string;
  gat: string;
  textures: string[];
  models: string[];
  sounds: string[];
  waterType: number | null;
} {
  return {
    gnd: rsw.gndFile,
    gat: rsw.gatFile,
    textures: [...new Set(gndTextures)].sort(),
    models: [...new Set(rsw.models.map((m) => m.file))].sort(),
    sounds: [...new Set(rsw.soundFiles)].sort(),
    waterType: rsw.waterType,
  };
}
