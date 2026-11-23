import { isVerifiedRaster, missingRaster, type RasterRegistry, type VerifiedRaster } from "./raster.ts";
import { RoRaster } from "./primitives.tsx";

export const RO_MOBILE_CONTROL_HINT_SIZE = 120;
export const RO_MOBILE_CONTROL_HINT_SCALE = 2;

export type RoMobileControlDirection = "up" | "right" | "down" | "left";

const RO_MOBILE_CONTROL_LAYOUT = [
  { direction: "up", assetId: "ui.arrow.up", x: 49, y: 6 },
  { direction: "right", assetId: "ui.arrow.right", x: 92, y: 49 },
  { direction: "down", assetId: "ui.arrow.down", x: 49, y: 92 },
  { direction: "left", assetId: "ui.arrow.left", x: 6, y: 49 },
] as const satisfies readonly { direction: RoMobileControlDirection; assetId: string; x: number; y: number }[];

export interface RoMobileControlHintPiece {
  direction: RoMobileControlDirection;
  assetId: string;
  raster: VerifiedRaster;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

export interface RoMobileControlHintPlan {
  width: number;
  height: number;
  pieces: RoMobileControlHintPiece[];
}

export function formalMobileControlAssetIds(): string[] {
  return RO_MOBILE_CONTROL_LAYOUT.map((piece) => piece.assetId);
}

function verifiedArrow(rasters: RasterRegistry, assetId: string): VerifiedRaster {
  const raster: unknown = rasters.get(assetId);
  if (!isVerifiedRaster(raster)) throw missingRaster(assetId, "mobile control hint requires a verified raster issued by the formal UI loader");
  if (raster.disposed) throw missingRaster(assetId, "mobile control hint raster was disposed");
  if (raster.assetId !== assetId || raster.entry.logical_asset_id !== assetId) throw missingRaster(assetId, `mobile control hint received ${raster.assetId} instead`);
  if (raster.entry.role !== "button") throw missingRaster(assetId, `mobile control hint received role ${raster.entry.role}, expected button`);
  if (raster.width !== 11 || raster.height !== 11) throw missingRaster(assetId, `mobile control hint expected native 11x11, got ${raster.width}x${raster.height}`);
  return raster;
}

export function planMobileControlHint(rasters: RasterRegistry): RoMobileControlHintPlan {
  const pieces = RO_MOBILE_CONTROL_LAYOUT.map((layout): RoMobileControlHintPiece => {
    const raster = verifiedArrow(rasters, layout.assetId);
    const width = raster.width * RO_MOBILE_CONTROL_HINT_SCALE;
    const height = raster.height * RO_MOBILE_CONTROL_HINT_SCALE;
    if (layout.x < 0 || layout.y < 0 || layout.x + width > RO_MOBILE_CONTROL_HINT_SIZE || layout.y + height > RO_MOBILE_CONTROL_HINT_SIZE) {
      throw missingRaster(layout.assetId, `mobile control hint piece exceeds ${RO_MOBILE_CONTROL_HINT_SIZE}x${RO_MOBILE_CONTROL_HINT_SIZE}`);
    }
    return { direction: layout.direction, assetId: layout.assetId, raster, x: layout.x, y: layout.y, width, height, scale: RO_MOBILE_CONTROL_HINT_SCALE };
  });
  return { width: RO_MOBILE_CONTROL_HINT_SIZE, height: RO_MOBILE_CONTROL_HINT_SIZE, pieces };
}

export function RoMobileControlHint({ rasters }: { rasters: RasterRegistry }) {
  const plan = planMobileControlHint(rasters);
  return (
    <div class="ro-mobile-control-hint" data-testid="ro-mobile-control-hint" data-ro-control="original-ro-raster-drag-hint" aria-hidden="true">
      {plan.pieces.map((piece) => (
        <div
          key={piece.assetId}
          class="ro-mobile-control-direction"
          data-ro-direction={piece.direction}
          style={{ position: "absolute", left: `${piece.x}px`, top: `${piece.y}px`, width: `${piece.width}px`, height: `${piece.height}px` }}
        >
          {RoRaster({ raster: piece.raster, scale: piece.scale })}
        </div>
      ))}
    </div>
  );
}
