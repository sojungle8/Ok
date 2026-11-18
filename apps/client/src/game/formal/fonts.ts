import type { AssetWhitelist } from "@ro-survivor/asset-contracts";
import { MissingAssetsError, missingWhitelisted, type MissingAsset } from "../requirements.ts";
import type { FormalUiAssets } from "./ui.ts";

interface FontFaceLike {
  load(): Promise<FontFaceLike>;
}

interface FontFaceSetLike {
  add(face: FontFaceLike): FontFaceSetLike;
  delete(face: FontFaceLike): boolean;
}

export interface FormalFontEnvironment {
  create(family: string, bytes: ArrayBuffer, descriptors: { weight: string; style: string }): FontFaceLike;
  set: FontFaceSetLike;
}

export interface InstalledFormalFonts {
  readonly family: "RO SCDream";
  readonly disposed: boolean;
  dispose(): void;
}

const browserFontEnvironment = (): FormalFontEnvironment => ({
  create: (family, bytes, descriptors) => new FontFace(family, bytes, descriptors),
  set: document.fonts,
});

/** Install only the two font files verified by the formal UI loader; no OS-font lookup is accepted. */
export async function installFormalFonts(
  ui: FormalUiAssets,
  whitelist: AssetWhitelist,
  environment: FormalFontEnvironment = browserFontEnvironment(),
): Promise<InstalledFormalFonts> {
  const definitions = [
    { id: "ui.font.scdream4", weight: "400" },
    { id: "ui.font.scdream6", weight: "600" },
  ] as const;
  const faces: FontFaceLike[] = [];
  const missing: MissingAsset[] = [];
  for (const definition of definitions) {
    const bytes = ui.fonts.get(definition.id);
    if (!bytes) {
      missing.push(missingWhitelisted(whitelist, definition.id, "verified font bytes are missing"));
      continue;
    }
    try {
      faces.push(await environment.create("RO SCDream", bytes, { weight: definition.weight, style: "normal" }).load());
    } catch (err) {
      missing.push(missingWhitelisted(whitelist, definition.id, `font decode failed: ${err instanceof Error ? err.message : String(err)}`));
    }
  }
  if (missing.length > 0) throw new MissingAssetsError(missing);
  for (const face of faces) environment.set.add(face);
  let disposed = false;
  return {
    family: "RO SCDream",
    get disposed() {
      return disposed;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const face of faces) environment.set.delete(face);
    },
  };
}
