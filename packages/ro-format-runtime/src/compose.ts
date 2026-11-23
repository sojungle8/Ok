import { FormatError } from "./binary.ts";
import type { Act, ActFrame } from "./act.ts";
import { frameToRgba, type Sprite } from "./spr.ts";

export interface ComposedFrame {
  width: number;
  height: number;
  rgba: Uint8Array;
  /** Position of the actor origin (foot pivot) inside the image. */
  originX: number;
  originY: number;
}

export interface ComposeLayerSource {
  sprite: Sprite;
  frame: ActFrame;
}

interface Placed {
  rgba: Uint8Array;
  w: number;
  h: number;
  left: number;
  top: number;
  mirror: boolean;
  tint: [number, number, number, number];
}

/**
 * Compose one animation frame from one or more ACT/SPR layer sets (body, hair, weapon, shield),
 * all sharing one clock. Layers draw in order; each keeps its own pivot. Scale is applied with
 * nearest-neighbour; rotation is not applied in the spike (reported by `rotatedLayers`).
 */
export function composeFrame(sources: readonly ComposeLayerSource[]): ComposedFrame & { rotatedLayers: number } {
  const placed: Placed[] = [];
  let rotatedLayers = 0;
  for (const { sprite, frame } of sources) {
    for (const layer of frame.layers) {
      if (layer.sprIndex < 0) continue;
      const list = layer.sprType === "rgba" ? sprite.rgba : sprite.indexed;
      const spr = list[layer.sprIndex];
      if (!spr) throw new FormatError("COMPOSE", `layer references missing ${layer.sprType} frame ${layer.sprIndex}`);
      if (layer.rotation % 360 !== 0) rotatedLayers += 1;
      const src = frameToRgba(spr, sprite.palette);
      const w = Math.max(1, Math.round(spr.width * Math.abs(layer.scaleX)));
      const h = Math.max(1, Math.round(spr.height * Math.abs(layer.scaleY)));
      const scaled = new Uint8Array(w * h * 4);
      for (let y = 0; y < h; y += 1) {
        const sy = Math.min(spr.height - 1, Math.floor((y * spr.height) / h));
        for (let x = 0; x < w; x += 1) {
          const sx = Math.min(spr.width - 1, Math.floor((x * spr.width) / w));
          scaled.set(src.subarray((sy * spr.width + sx) * 4, (sy * spr.width + sx) * 4 + 4), (y * w + x) * 4);
        }
      }
      // Layer (x, y) is the offset of the image centre from the actor origin.
      placed.push({ rgba: scaled, w, h, left: layer.x - Math.floor(w / 2), top: layer.y - Math.floor(h / 2), mirror: layer.mirror, tint: layer.color });
    }
  }
  if (placed.length === 0) return { width: 1, height: 1, rgba: new Uint8Array(4), originX: 0, originY: 0, rotatedLayers };
  const minX = Math.min(...placed.map((p) => p.left));
  const minY = Math.min(...placed.map((p) => p.top));
  const maxX = Math.max(...placed.map((p) => p.left + p.w));
  const maxY = Math.max(...placed.map((p) => p.top + p.h));
  const width = maxX - minX;
  const height = maxY - minY;
  const out = new Uint8Array(width * height * 4);
  for (const p of placed) {
    for (let y = 0; y < p.h; y += 1) {
      for (let x = 0; x < p.w; x += 1) {
        const sx = p.mirror ? p.w - 1 - x : x;
        const s = (y * p.w + sx) * 4;
        const a = ((p.rgba[s + 3] as number) * p.tint[3]) / 255;
        if (a === 0) continue;
        const d = ((p.top - minY + y) * width + (p.left - minX + x)) * 4;
        const fa = a / 255;
        for (let c = 0; c < 3; c += 1) {
          const v = ((p.rgba[s + c] as number) * (p.tint[c] as number)) / 255;
          out[d + c] = Math.round(v * fa + (out[d + c] as number) * (1 - fa));
        }
        out[d + 3] = Math.max(out[d + 3] as number, Math.round(a));
      }
    }
  }
  return { width, height, rgba: out, originX: -minX, originY: -minY, rotatedLayers };
}

export interface AnimationSummary {
  actions: number;
  directions: number;
  framesPerAction: number[];
  delaysMs: number[];
  soundEvents: { action: number; frame: number; sound: string }[];
}

export function summarizeAct(act: Act): AnimationSummary {
  const soundEvents: AnimationSummary["soundEvents"] = [];
  act.actions.forEach((a, ai) =>
    a.frames.forEach((f, fi) => {
      if (f.soundIndex >= 0) soundEvents.push({ action: ai, frame: fi, sound: act.sounds[f.soundIndex] ?? `#${f.soundIndex}` });
    }),
  );
  return {
    actions: act.actions.length,
    directions: 8,
    framesPerAction: act.actions.map((a) => a.frames.length),
    delaysMs: act.actions.map((a) => Math.round(a.delay * 25)),
    soundEvents,
  };
}
