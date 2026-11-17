/**
 * UI-B2 — detached RO primitive library (not imported by the shipped formal screen yet).
 * Every visible pixel is one verified original RO raster (VerifiedRaster from the loader) drawn at its
 * native size times a positive integer scale with nearest-neighbour sampling. Layout uses only
 * positioning; nothing is drawn with CSS surfaces, gradients, filters, SVG, emoji, fonts or canvas.
 * Each primitive has a pure `plan*` function (validation + layout) and a component that renders it.
 */
import type { JSX } from "preact";
import { MissingAssetsError } from "../../game/requirements.ts";
import { isVerifiedRaster, missingRaster, type RasterRegistry, type VerifiedRaster } from "./raster.ts";

export type RoButtonState = "off" | "on" | "hover" | "down" | "disabled";

export function contractError(field: string, reason: string): MissingAssetsError {
  return new MissingAssetsError([{ assetId: null, container: "contract", canonicalPath: field, reason }]);
}

function checkScale(scale: number): number {
  if (!Number.isInteger(scale) || scale < 1) throw contractError("scale", `scale ${scale} is not a positive integer`);
  return scale;
}
function checkRaster(r: unknown, field: string): VerifiedRaster {
  if (!isVerifiedRaster(r)) throw contractError(field, "not a verified raster issued by the UI loader");
  if (r.disposed) throw missingRaster(r.assetId, `${field}: verified raster was disposed`);
  return r;
}

/** One positioned piece: a verified raster at native size (× scale), optionally repeated horizontally. */
export interface Piece {
  assetId: string;
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Tile the raster along x across `width` (only ever true for a three-slice middle). */
  repeatX: boolean;
  /** Size of one tile: the raster's native size × scale (never stretched). */
  tileWidth: number;
}

function piece(r: VerifiedRaster, x: number, y: number, scale: number, width = r.width * scale, repeatX = false): Piece {
  return { assetId: r.assetId, url: r.url, x, y, width, height: r.height * scale, repeatX, tileWidth: r.width * scale };
}

const pieceStyle = (p: Piece, scale: number): JSX.CSSProperties => ({
  position: "absolute",
  left: `${p.x}px`,
  top: `${p.y}px`,
  width: `${p.width}px`,
  height: `${p.height}px`,
  backgroundImage: `url("${p.url}")`,
  backgroundRepeat: p.repeatX ? "repeat-x" : "no-repeat",
  backgroundSize: `${p.tileWidth}px ${p.height}px`,
  imageRendering: "pixelated",
  ["--ro-scale" as string]: String(scale),
});

function Pieces({ pieces, scale, width, height }: { pieces: Piece[]; scale: number; width: number; height: number }) {
  return (
    <div class="ro-primitive" style={{ position: "relative", width: `${width}px`, height: `${height}px` }}>
      {pieces.map((p) => <div key={`${p.assetId}:${p.x}`} data-ro-asset={p.assetId} style={pieceStyle(p, scale)} />)}
    </div>
  );
}

// ---------------------------------------------------------------- RoRaster
export function planRaster(raster: VerifiedRaster, scale = 1): { pieces: Piece[]; width: number; height: number } {
  const r = checkRaster(raster, "raster");
  const s = checkScale(scale);
  return { pieces: [piece(r, 0, 0, s)], width: r.width * s, height: r.height * s };
}
export function RoRaster({ raster, scale = 1 }: { raster: VerifiedRaster; scale?: number }) {
  const p = planRaster(raster, scale);
  return <Pieces pieces={p.pieces} scale={scale} width={p.width} height={p.height} />;
}

// ---------------------------------------------------------------- RoThreeSlice
/** left + repeated middle + right; caps keep their native size, only `mid` repeats. */
export function planThreeSlice(left: VerifiedRaster, mid: VerifiedRaster, right: VerifiedRaster, width: number, scale = 1): { pieces: Piece[]; width: number; height: number } {
  const [l, m, r] = [checkRaster(left, "left"), checkRaster(mid, "mid"), checkRaster(right, "right")];
  const s = checkScale(scale);
  if (new Set([l.assetId, m.assetId, r.assetId]).size !== 3) throw contractError("threeSlice", "left / mid / right must be three distinct assets");
  const parts = [l, m, r].map((x) => x.entry.slice);
  const expected = ["left", "mid", "right"] as const;
  parts.forEach((sl, i) => {
    if (!sl || sl.part !== expected[i]) throw contractError("threeSlice", `${[l, m, r][i]?.assetId ?? "?"} is not a declared ${expected[i] ?? "?"} slice`);
  });
  if (new Set(parts.map((x) => x?.group)).size !== 1) throw contractError("threeSlice", "slice parts belong to different groups");
  const midWidth = width - (l.width + r.width) * s;
  if (!Number.isInteger(width) || midWidth < 0) throw contractError("width", `width ${width} is smaller than both caps (${(l.width + r.width) * s})`);
  const height = Math.max(l.height, m.height, r.height) * s;
  return {
    pieces: [piece(l, 0, 0, s), piece(m, l.width * s, 0, s, midWidth, true), piece(r, l.width * s + midWidth, 0, s)],
    width,
    height,
  };
}
export function RoThreeSlice(props: { left: VerifiedRaster; mid: VerifiedRaster; right: VerifiedRaster; width: number; scale?: number }) {
  const p = planThreeSlice(props.left, props.mid, props.right, props.width, props.scale ?? 1);
  return <Pieces pieces={p.pieces} scale={props.scale ?? 1} width={p.width} height={p.height} />;
}

// ---------------------------------------------------------------- RoButton
/** Canonical control family of a button raster: its ID without the state token (+ slice part). */
export function buttonFamily(r: VerifiedRaster): string {
  const sl = r.entry.slice;
  if (sl) return `${sl.group.split(".").slice(0, -1).join(".")}|${sl.part}`;
  return r.assetId.split(".").slice(0, -1).join(".");
}
/**
 * `declared` maps every interaction state the button has in the client to its exact logical ID.
 * Every declared state must resolve to a verified raster; the shown state must be declared. There is
 * no fallback to another state and no CSS filter / opacity state synthesis.
 */
export function planButton(rasters: RasterRegistry, declared: Partial<Record<RoButtonState, string>>, state: RoButtonState, scale = 1): { assetId: string; pieces: Piece[]; width: number; height: number } {
  const s = checkScale(scale);
  const entries = Object.entries(declared) as [RoButtonState, string][];
  if (entries.length === 0) throw contractError("button.declared", "a button must declare at least one state");
  const families = new Set<string>();
  for (const [st, id] of entries) {
    const r = checkRaster(rasters.get(id), `button.${st}`); // throws with the canonical container / path when missing
    if (r.entry.role !== "button" || r.entry.state !== st) throw contractError(`button.${st}`, `${id} is declared as ${r.entry.role}/${r.entry.state ?? "none"}, not button/${st}`);
    families.add(buttonFamily(r));
  }
  // All declared states must be the same canonical control (and the same slice part for sliced buttons).
  if (families.size !== 1) throw contractError("button.family", `declared states mix controls: ${[...families].sort().join(", ")}`);
  const id = declared[state];
  if (!id) throw contractError(`button.${state}`, `state ${state} is not declared for this button (no fallback)`);
  const r = checkRaster(rasters.get(id), `button.${state}`);
  return { assetId: id, pieces: [piece(r, 0, 0, s)], width: r.width * s, height: r.height * s };
}
export function RoButton(props: { rasters: RasterRegistry; declared: Partial<Record<RoButtonState, string>>; state: RoButtonState; scale?: number; label: string; onPress?: () => void }) {
  const p = planButton(props.rasters, props.declared, props.state, props.scale ?? 1);
  return (
    <button type="button" class="ro-button" aria-label={props.label} data-ro-state={props.state} onClick={props.onPress} style={{ all: "unset", display: "inline-block", cursor: "inherit" }}>
      <Pieces pieces={p.pieces} scale={props.scale ?? 1} width={p.width} height={p.height} />
    </button>
  );
}

// ---------------------------------------------------------------- RoGauge
/** Official empty three-slice under the official fill three-slice clipped to the clamped ratio. */
export function planGauge(empty: [VerifiedRaster, VerifiedRaster, VerifiedRaster], fill: [VerifiedRaster, VerifiedRaster, VerifiedRaster], ratio: number, width: number, scale = 1) {
  for (const r of [...empty, ...fill]) {
    if (checkRaster(r, "gauge").entry.role !== "gauge") throw contractError("gauge", `${r.assetId} is not an official gauge part`);
  }
  const clamped = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
  const back = planThreeSlice(...empty, width, scale);
  const front = planThreeSlice(...fill, width, scale);
  const clip = Math.round(clamped * width);
  return { ratio: clamped, clipWidth: clip, back: back.pieces, fill: front.pieces, width, height: Math.max(back.height, front.height) };
}
export function RoGauge(props: { empty: [VerifiedRaster, VerifiedRaster, VerifiedRaster]; fill: [VerifiedRaster, VerifiedRaster, VerifiedRaster]; ratio: number; width: number; scale?: number }) {
  const s = props.scale ?? 1;
  const p = planGauge(props.empty, props.fill, props.ratio, props.width, s);
  return (
    <div class="ro-gauge" data-ro-ratio={p.ratio} style={{ position: "relative", width: `${p.width}px`, height: `${p.height}px` }}>
      <Pieces pieces={p.back} scale={s} width={p.width} height={p.height} />
      <div style={{ position: "absolute", left: "0px", top: "0px", width: `${p.clipWidth}px`, height: `${p.height}px`, overflow: "hidden" }}>
        <Pieces pieces={p.fill} scale={s} width={p.width} height={p.height} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- RoSlot
/** Original slot frame + optional original icon; hotkey / count are plain DOM text only. */
export function planSlot(frame: VerifiedRaster, icon: VerifiedRaster | null, scale = 1) {
  const f = checkRaster(frame, "slot.frame");
  if (f.entry.role !== "slot" && f.entry.role !== "frame") throw contractError("slot.frame", `${f.assetId} is ${f.entry.role}, not a slot frame`);
  const s = checkScale(scale);
  const pieces = [piece(f, 0, 0, s)];
  if (icon !== null) {
    const i = checkRaster(icon, "slot.icon");
    if (i.entry.role !== "icon") throw contractError("slot.icon", `${i.assetId} is ${i.entry.role}, not an icon`);
    pieces.push(piece(i, Math.floor(((f.width - i.width) * s) / 2), Math.floor(((f.height - i.height) * s) / 2), s));
  }
  return { pieces, width: f.width * s, height: f.height * s };
}
export function RoSlot(props: { rasters: RasterRegistry; frameId: string; iconId?: string; hotkey?: string; count?: number; scale?: number }) {
  const icon = props.iconId === undefined ? null : props.rasters.get(props.iconId);
  const p = planSlot(props.rasters.get(props.frameId), icon, props.scale ?? 1);
  return (
    <div class="ro-slot" style={{ position: "relative", width: `${p.width}px`, height: `${p.height}px` }}>
      <Pieces pieces={p.pieces} scale={props.scale ?? 1} width={p.width} height={p.height} />
      {props.hotkey !== undefined ? <span class="ro-slot-hotkey" style={{ position: "absolute", left: "1px", top: "0px" }}>{props.hotkey}</span> : null}
      {props.count !== undefined ? <span class="ro-slot-count" style={{ position: "absolute", right: "1px", bottom: "0px" }}>{props.count}</span> : null}
    </div>
  );
}

export { missingRaster };
