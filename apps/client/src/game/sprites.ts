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
  atlas: { width: number; height: number; sha256?: string };
  slots: Record<Slot, { directions: { frames: number[]; delayMs: number }[] }>;
  frames: SheetFrame[];
  /** Layer sets composed into the atlas (body first) and their palettes (extractor v2). */
  layers?: { spr: string; act: string; palette: string | null }[] | undefined;
  /** Per direction: draw order (indices into `layers`), back to front. */
  layerOrder?: number[][] | undefined;
}

export interface SpriteSheet {
  data: SheetData;
  texture: THREE.Texture;
  /** World metres per sprite pixel. */
  pxToWorld: number;
  source: "fan-local";
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

export async function sheetFromDerived(png: Uint8Array, data: SheetData): Promise<SpriteSheet> {
  const blob = new Blob([png as Uint8Array<ArrayBuffer>], { type: "image/png" });
  const bitmap = await createImageBitmap(blob, { imageOrientation: "none", premultiplyAlpha: "none" });
  return { data, texture: makeTexture(bitmap), pxToWorld: 0.025, source: "fan-local", textureBytes: bitmap.width * bitmap.height * 4 };
}
