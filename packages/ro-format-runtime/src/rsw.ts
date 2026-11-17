import { BinaryReader, expectMagic, FormatError } from "./binary.ts";

export interface RswModel {
  name: string;
  file: string;
  node: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
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
  if (v >= 103) r.skip(4); // water level
  if (v >= 108) r.skip(16); // water type, wave height, speed, pitch
  if (v >= 109) r.skip(4); // water anim speed
  if (v >= 105) r.skip(8 + 12 + 12); // light longitude/latitude, diffuse, ambient
  if (v >= 107) r.skip(4); // shadow opacity
  if (v >= 106) r.skip(16); // ground bounds
  const objectCount = r.i32();
  if (objectCount < 0 || objectCount > 200_000) throw new FormatError("RSW", `bad object count ${objectCount}`);
  const models: RswModel[] = [];
  const soundFiles: string[] = [];
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
      r.skip(80);
      soundFiles.push(r.cstring(80));
      r.skip(12 + 4 + 4 + 4 + 4);
      if (v >= 200) r.skip(4);
      counts.sounds += 1;
    } else if (type === 4) {
      r.skip(80 + 12 + 4 + 4 + 16);
      counts.effects += 1;
    } else {
      throw new FormatError("RSW", `unknown object type ${type} at index ${i} (offset ${r.offset - 4})`);
    }
  }
  return { version, iniFile, gndFile, gatFile, srcFile, models, counts, soundFiles };
}

/** Dependency closure report: what a map needs beyond the whitelisted RSW/GND/GAT. */
export function mapDependencies(rsw: Rsw, gndTextures: readonly string[]): {
  gnd: string;
  gat: string;
  textures: string[];
  models: string[];
  sounds: string[];
} {
  return {
    gnd: rsw.gndFile,
    gat: rsw.gatFile,
    textures: [...new Set(gndTextures)].sort(),
    models: [...new Set(rsw.models.map((m) => m.file))].sort(),
    sounds: [...new Set(rsw.soundFiles)].sort(),
  };
}
