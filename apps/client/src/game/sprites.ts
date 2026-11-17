import * as THREE from "three";

/** Subset of the extractor's metadata the renderer needs (see tools/assets/extract-lib.ts). */
export interface SheetFrame {
  x: number;
  y: number;
  w: number;
  h: number;
  originX: number;
  originY: number;
  flipX: boolean;
}

export type Slot = "idle" | "walk" | "attack" | "hit" | "death" | "cast";

export interface SheetData {
  atlas: { width: number; height: number };
  slots: Record<Slot, { directions: { frames: number[]; delayMs: number }[] }>;
  frames: SheetFrame[];
}

export interface SpriteSheet {
  data: SheetData;
  texture: THREE.Texture;
  /** World metres per sprite pixel. */
  pxToWorld: number;
  source: "placeholder" | "fan-local";
  textureBytes: number;
}

export function makeTexture(image: TexImageSource & { width: number; height: number }): THREE.Texture {
  const tex = new THREE.Texture(image as HTMLImageElement);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.flipY = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// RO direction order 0 S,1 SW,2 W,3 NW,4 N; 5-7 are mirrors of 3-1 (stored once).
const NOSE: [number, number][] = [[0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1]];
const MIRROR_OF: Record<number, number> = { 5: 3, 6: 2, 7: 1 };

/**
 * Code-drawn placeholder actor (ellipse + direction nose). Directions 5-7 reuse 3-1 with flipX,
 * mirroring how RO sprites store them, so the mirror path is exercised without RO material.
 */
export function placeholderSheet(kind: "player" | "monster"): SpriteSheet {
  const w = kind === "player" ? 28 : 30;
  const h = kind === "player" ? 44 : 26;
  const walkFrames = 4;
  const canvas = document.createElement("canvas");
  canvas.width = (w + 1) * (1 + walkFrames);
  canvas.height = (h + 1) * 5;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d canvas unavailable");
  const frames: SheetFrame[] = [];
  const body = kind === "player" ? "#3f6fd8" : "#f08cb4";
  const draw = (col: number, row: number, dir: number, bob: number): number => {
    const ox = col * (w + 1);
    const oy = row * (h + 1);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(ox + w / 2, oy + h - h / 2.2 - bob, w / 2 - 1, h / 2.2 - 1, 0, 0, Math.PI * 2);
    ctx.fill();
    if (kind === "player") {
      ctx.fillStyle = "#6b4a2b";
      ctx.fillRect(ox + 6, oy + 2 - bob, w - 12, 9);
    }
    const [nx, ny] = NOSE[dir] ?? [0, 1];
    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.arc(ox + w / 2 + nx * (w / 2 - 5), oy + h - h / 2.2 - bob + ny * (h / 2.2 - 5), 3, 0, Math.PI * 2);
    ctx.fill();
    frames.push({ x: ox, y: oy, w, h, originX: Math.floor(w / 2), originY: h - 1, flipX: false });
    return frames.length - 1;
  };
  const idle: number[] = [];
  const walk: number[][] = [];
  for (let dir = 0; dir <= 4; dir += 1) {
    idle[dir] = draw(0, dir, dir, 0);
    walk[dir] = Array.from({ length: walkFrames }, (_, f) => draw(1 + f, dir, dir, f % 2));
  }
  const mirrored = (idx: number): number => {
    const f = frames[idx] as SheetFrame;
    frames.push({ ...f, originX: f.w - f.originX, flipX: true });
    return frames.length - 1;
  };
  const dirs = (pick: (d: number) => number[]) =>
    Array.from({ length: 8 }, (_, d) => {
      const src = MIRROR_OF[d];
      return { frames: src === undefined ? pick(d) : pick(src).map(mirrored), delayMs: 150 };
    });
  const idleDirs = dirs((d) => [idle[d] as number]);
  const walkDirs = dirs((d) => walk[d] as number[]);
  // Binarise alpha so anti-aliased canvas edges do not leave light fringes (pixel-art look).
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = (img.data[i] as number) >= 128 ? 255 : 0;
  ctx.putImageData(img, 0, 0);
  const data: SheetData = {
    atlas: { width: canvas.width, height: canvas.height },
    slots: { idle: { directions: idleDirs }, walk: { directions: walkDirs }, attack: { directions: idleDirs }, hit: { directions: idleDirs }, death: { directions: idleDirs }, cast: { directions: idleDirs } },
    frames,
  };
  return { data, texture: makeTexture(canvas), pxToWorld: kind === "player" ? 0.045 : 0.04, source: "placeholder", textureBytes: canvas.width * canvas.height * 4 };
}

export async function sheetFromDerived(png: Uint8Array, data: SheetData): Promise<SpriteSheet> {
  const blob = new Blob([png as Uint8Array<ArrayBuffer>], { type: "image/png" });
  const bitmap = await createImageBitmap(blob, { imageOrientation: "none", premultiplyAlpha: "none" });
  return { data, texture: makeTexture(bitmap), pxToWorld: 0.025, source: "fan-local", textureBytes: bitmap.width * bitmap.height * 4 };
}
