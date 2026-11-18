/**
 * Small pre-run preview of the verified, locally derived four-layer Swordsman atlas.
 * The DOM only crops pixels from that atlas; it does not draw, recolour or substitute actor art.
 */
import { FORMAL_PLAYER_LAYERS, FORMAL_PLAYER_PALETTES, missingFromWhitelist, type AssetWhitelist } from "@ro-survivor/asset-contracts";
import { useEffect, useState } from "preact/hooks";
import { checkPlayerLayers } from "../assets.ts";
import { MissingAssetsError, missingWhitelisted, type MissingAsset } from "../requirements.ts";
import type { SheetData } from "../sprites.ts";
import type { FormalDecoders } from "./load.ts";

const BODY = FORMAL_PLAYER_LAYERS[0];
const PREVIEW_DIRECTION = 0;
const PREVIEW_SCALE = 1;
const PREVIEW_WIDTH = 96;
const PREVIEW_HEIGHT = 108;
const PREVIEW_FOOT_X = 48;
const PREVIEW_FOOT_Y = 95;

export const FORMAL_PLAYER_PREVIEW_SOURCE_IDS = [
  ...FORMAL_PLAYER_LAYERS.flatMap((layer) => [`${layer}.spr`, `${layer}.act`]),
  ...FORMAL_PLAYER_PALETTES,
] as const;

export interface PlayerPreviewGatewayLike {
  checkSource(assetId: string): Promise<void>;
  getJson<T>(assetId: string): Promise<T>;
  getDerivedImage(assetId: string): Promise<Uint8Array>;
}

export interface FormalPlayerPreviewAsset {
  readonly assetId: typeof BODY;
  readonly data: SheetData;
  readonly url: string;
  readonly disposed: boolean;
  dispose(): void;
}

interface PreviewSheetData extends SheetData {
  atlas: SheetData["atlas"] & { sha256: string };
}

export interface PlayerPreviewFramePlan {
  frameIndex: number;
  left: number;
  top: number;
  width: number;
  height: number;
  backgroundX: number;
  backgroundY: number;
  atlasWidth: number;
  atlasHeight: number;
}

const reasonOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));

async function sha256Upper(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function previewContractProblems(data: SheetData): string[] {
  const problems: string[] = [];
  const direction = data.slots.idle?.directions[PREVIEW_DIRECTION];
  if (!direction || direction.frames.length < 2 || !Number.isFinite(direction.delayMs) || direction.delayMs < 25) {
    problems.push("idle direction 0 must contain at least two timed frames");
    return problems;
  }
  for (const index of direction.frames) {
    const frame = data.frames[index];
    if (!frame) {
      problems.push(`idle frame ${index} is absent from the atlas metadata`);
      continue;
    }
    if (frame.flipX) problems.push(`idle frame ${index} is mirrored; direction 0 must use original pixels`);
    if (frame.w < 1 || frame.h < 1 || frame.x < 0 || frame.y < 0 || frame.x + frame.w > data.atlas.width || frame.y + frame.h > data.atlas.height) {
      problems.push(`idle frame ${index} rectangle is outside ${data.atlas.width}x${data.atlas.height}`);
    }
    const left = PREVIEW_FOOT_X - frame.originX * PREVIEW_SCALE;
    const top = PREVIEW_FOOT_Y - frame.originY * PREVIEW_SCALE;
    const right = left + frame.w * PREVIEW_SCALE;
    const bottom = top + frame.h * PREVIEW_SCALE;
    if (left < 0 || top < 0 || right > PREVIEW_WIDTH || bottom > PREVIEW_HEIGHT) {
      problems.push(`idle frame ${index} would be clipped by the ${PREVIEW_WIDTH}x${PREVIEW_HEIGHT} preview viewport`);
    }
  }
  return problems;
}

/** Load only the actor sources and its already-derived atlas; no map, monster, UI or audio is read. */
export async function loadFormalPlayerPreview(
  gateway: PlayerPreviewGatewayLike,
  decoders: FormalDecoders,
  whitelist: AssetWhitelist,
  urlApi: Pick<typeof URL, "createObjectURL" | "revokeObjectURL"> = URL,
): Promise<FormalPlayerPreviewAsset> {
  const missing: MissingAsset[] = missingFromWhitelist(whitelist, FORMAL_PLAYER_PREVIEW_SOURCE_IDS).map((entry) => ({ ...entry }));
  if (missing.length > 0) throw new MissingAssetsError(missing);
  await Promise.all(FORMAL_PLAYER_PREVIEW_SOURCE_IDS.map(async (id) => {
    try {
      await gateway.checkSource(id);
    } catch (err) {
      missing.push(missingWhitelisted(whitelist, id, `player preview source unavailable: ${reasonOf(err)}`));
    }
  }));
  if (missing.length > 0) throw new MissingAssetsError(missing.sort((a, b) => (a.assetId ?? "").localeCompare(b.assetId ?? "")));

  let data: PreviewSheetData;
  let png: Uint8Array;
  try {
    data = await gateway.getJson<PreviewSheetData>(`${BODY}.act`);
  } catch (err) {
    throw new MissingAssetsError([missingWhitelisted(whitelist, `${BODY}.act`, `player preview metadata unavailable: ${reasonOf(err)}`)]);
  }
  try {
    png = await gateway.getDerivedImage(`${BODY}.spr`);
  } catch (err) {
    throw new MissingAssetsError([missingWhitelisted(whitelist, `${BODY}.spr`, `player preview atlas unavailable: ${reasonOf(err)}`)]);
  }

  missing.push(...checkPlayerLayers(data, whitelist));
  for (const reason of previewContractProblems(data)) missing.push(missingWhitelisted(whitelist, `${BODY}.act`, `player preview metadata invalid: ${reason}`));
  if (!/^[0-9A-F]{64}$/u.test(data.atlas.sha256 ?? "")) missing.push(missingWhitelisted(whitelist, `${BODY}.act`, "player preview metadata has no valid atlas SHA-256"));
  else {
    const got = await sha256Upper(png);
    if (got !== data.atlas.sha256) missing.push(missingWhitelisted(whitelist, `${BODY}.spr`, `player preview atlas SHA-256 ${got} != metadata ${data.atlas.sha256}`));
  }
  let decoded: Awaited<ReturnType<FormalDecoders["image"]>> | null = null;
  try {
    decoded = await decoders.image(png, "image/png");
    if (decoded.width !== data.atlas.width || decoded.height !== data.atlas.height) {
      missing.push(missingWhitelisted(whitelist, `${BODY}.spr`, `decoded player preview ${decoded.width}x${decoded.height} != metadata ${data.atlas.width}x${data.atlas.height}`));
    }
  } catch (err) {
    missing.push(missingWhitelisted(whitelist, `${BODY}.spr`, `player preview atlas decode failed: ${reasonOf(err)}`));
  } finally {
    decoded?.close?.();
  }
  if (missing.length > 0) throw new MissingAssetsError(missing);

  const objectUrl = urlApi.createObjectURL(new Blob([png as Uint8Array<ArrayBuffer>], { type: "image/png" }));
  let liveUrl: string | null = objectUrl;
  return {
    assetId: BODY,
    data,
    get url() {
      if (liveUrl === null) throw new Error(`player preview ${BODY} was disposed`);
      return liveUrl;
    },
    get disposed() { return liveUrl === null; },
    dispose() {
      if (liveUrl === null) return;
      const url = liveUrl;
      liveUrl = null;
      urlApi.revokeObjectURL(url);
    },
  };
}

export function planPlayerPreviewFrame(preview: FormalPlayerPreviewAsset, sequenceIndex: number): PlayerPreviewFramePlan {
  if (preview.disposed) throw new Error(`player preview ${preview.assetId} was disposed`);
  const direction = preview.data.slots.idle?.directions[PREVIEW_DIRECTION];
  if (!direction || direction.frames.length === 0) throw new Error("player preview idle animation is absent");
  const frameIndex = direction.frames[((sequenceIndex % direction.frames.length) + direction.frames.length) % direction.frames.length] as number;
  const frame = preview.data.frames[frameIndex];
  if (!frame || frame.flipX) throw new Error(`player preview frame ${frameIndex} is unavailable or mirrored`);
  return {
    frameIndex,
    left: PREVIEW_FOOT_X - frame.originX * PREVIEW_SCALE,
    top: PREVIEW_FOOT_Y - frame.originY * PREVIEW_SCALE,
    width: frame.w * PREVIEW_SCALE,
    height: frame.h * PREVIEW_SCALE,
    backgroundX: frame.x === 0 ? 0 : -frame.x * PREVIEW_SCALE,
    backgroundY: frame.y === 0 ? 0 : -frame.y * PREVIEW_SCALE,
    atlasWidth: preview.data.atlas.width * PREVIEW_SCALE,
    atlasHeight: preview.data.atlas.height * PREVIEW_SCALE,
  };
}

export function FormalPlayerPreview({ preview }: { preview: FormalPlayerPreviewAsset }) {
  const [sequence, setSequence] = useState(0);
  const delay = Math.max(25, preview.data.slots.idle?.directions[PREVIEW_DIRECTION]?.delayMs ?? 100);
  useEffect(() => {
    setSequence(0);
    const timer = setInterval(() => setSequence((value) => value + 1), delay);
    return () => clearInterval(timer);
  }, [preview, delay]);
  const frame = planPlayerPreviewFrame(preview, sequence);
  return (
    <div
      class="formal-player-preview"
      data-testid="swordsman-actor-preview"
      data-ro-actor="original-ro-four-layer"
      data-ro-source={preview.assetId}
      data-ro-frame={frame.frameIndex}
      aria-label="原始 RO 四層男劍士待機動畫"
      style={{ position: "relative", width: `${PREVIEW_WIDTH}px`, height: `${PREVIEW_HEIGHT}px`, overflow: "hidden", imageRendering: "pixelated" }}
    >
      <div
        style={{
          position: "absolute",
          left: `${frame.left}px`,
          top: `${frame.top}px`,
          width: `${frame.width}px`,
          height: `${frame.height}px`,
          backgroundImage: `url("${preview.url}")`,
          backgroundPosition: `${frame.backgroundX}px ${frame.backgroundY}px`,
          backgroundSize: `${frame.atlasWidth}px ${frame.atlasHeight}px`,
          backgroundRepeat: "no-repeat",
          imageRendering: "pixelated",
        }}
      />
    </div>
  );
}
