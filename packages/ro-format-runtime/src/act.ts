import { BinaryReader, expectMagic, FormatError } from "./binary.ts";

export interface ActLayer {
  x: number;
  y: number;
  /** Index into the SPR frame list of `sprType` (-1 = empty layer). */
  sprIndex: number;
  mirror: boolean;
  color: [number, number, number, number];
  scaleX: number;
  scaleY: number;
  /** Degrees. */
  rotation: number;
  sprType: "indexed" | "rgba";
  width: number | null;
  height: number | null;
}

export interface ActAnchor {
  x: number;
  y: number;
  attr: number;
}

export interface ActFrame {
  layers: ActLayer[];
  /** Index into `sounds`, or -1. */
  soundIndex: number;
  anchors: ActAnchor[];
}

export interface ActAction {
  frames: ActFrame[];
  /** Frame interval multiplier (1 unit = 25 ms); 4 when the file has no delays (< 2.2). */
  delay: number;
}

export interface Act {
  version: string;
  actions: ActAction[];
  sounds: string[];
}

export const ACT_DELAY_UNIT_MS = 25;

/** ACT 2.0 – 2.5. Older (1.x) files are rejected explicitly. */
export function parseAct(bytes: Uint8Array): Act {
  const r = new BinaryReader(bytes, "ACT");
  expectMagic(r, "AC");
  const minor = r.u8();
  const major = r.u8();
  const version = `${major}.${minor}`;
  if (major !== 2 || minor > 5) throw new FormatError("ACT", `unsupported version ${version}`);
  const v = minor; // 2.v
  const actionCount = r.u16();
  r.skip(10);
  const actions: ActAction[] = [];
  for (let a = 0; a < actionCount; a += 1) {
    const frameCount = r.u32();
    if (frameCount > 10_000) throw new FormatError("ACT", `implausible frame count ${frameCount} in action ${a}`);
    const frames: ActFrame[] = [];
    for (let f = 0; f < frameCount; f += 1) {
      r.skip(32); // two legacy bounding rectangles
      const layerCount = r.u32();
      if (layerCount > 1000) throw new FormatError("ACT", `implausible layer count ${layerCount}`);
      const layers: ActLayer[] = [];
      for (let l = 0; l < layerCount; l += 1) {
        const x = r.i32();
        const y = r.i32();
        const sprIndex = r.i32();
        const mirror = r.u32() !== 0;
        const color: [number, number, number, number] = [r.u8(), r.u8(), r.u8(), r.u8()];
        let scaleX: number;
        let scaleY: number;
        if (v >= 4) {
          scaleX = r.f32();
          scaleY = r.f32();
        } else {
          scaleX = r.f32();
          scaleY = scaleX;
        }
        const rotation = r.i32();
        const sprType = r.i32() === 1 ? "rgba" : "indexed";
        let width: number | null = null;
        let height: number | null = null;
        if (v >= 5) {
          width = r.i32();
          height = r.i32();
        }
        layers.push({ x, y, sprIndex, mirror, color, scaleX, scaleY, rotation, sprType, width, height });
      }
      const soundIndex = r.i32();
      const anchors: ActAnchor[] = [];
      if (v >= 3) {
        const anchorCount = r.i32();
        if (anchorCount < 0 || anchorCount > 100) throw new FormatError("ACT", `implausible anchor count ${anchorCount}`);
        for (let k = 0; k < anchorCount; k += 1) {
          r.skip(4);
          const ax = r.i32();
          const ay = r.i32();
          const attr = r.i32();
          anchors.push({ x: ax, y: ay, attr });
        }
      }
      frames.push({ layers, soundIndex, anchors });
    }
    actions.push({ frames, delay: 4 });
  }
  const sounds: string[] = [];
  if (v >= 1) {
    const soundCount = r.u32();
    if (soundCount > 1000) throw new FormatError("ACT", `implausible sound count ${soundCount}`);
    for (let s = 0; s < soundCount; s += 1) sounds.push(r.cstring(40));
  }
  if (v >= 2) {
    for (const action of actions) action.delay = r.f32();
  }
  if (r.remaining !== 0) throw new FormatError("ACT", `${r.remaining} trailing bytes after parse`);
  return { version, actions, sounds };
}

/** RO sprite actions are grouped in blocks of 8 directions. */
export const DIRECTIONS = 8;

export const MONSTER_ACTIONS = ["idle", "walk", "attack", "hit", "death"] as const;
export const PLAYER_ACTIONS = [
  "idle", "walk", "sit", "pickup", "ready", "attack1", "hit", "freeze1", "death", "freeze2", "attack2", "attack3", "cast",
] as const;

export function actionIndex(group: number, direction: number): number {
  return group * DIRECTIONS + (((direction % DIRECTIONS) + DIRECTIONS) % DIRECTIONS);
}
