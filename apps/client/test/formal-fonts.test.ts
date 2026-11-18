import { describe, expect, it } from "vitest";
import { installFormalFonts, type FormalFontEnvironment } from "../src/game/formal/fonts.ts";
import { MissingAssetsError } from "../src/game/requirements.ts";
import { whitelist } from "../src/gateway.ts";
import type { FormalUiAssets } from "../src/game/formal/ui.ts";

const ui = (fonts: Map<string, ArrayBuffer>): FormalUiAssets => ({ fonts } as unknown as FormalUiAssets);

function environment(failWeight: string | null = null) {
  const added: object[] = [];
  const deleted: object[] = [];
  const env: FormalFontEnvironment = {
    create: (_family, _bytes, descriptors) => {
      const face = { weight: descriptors.weight, load: () => descriptors.weight === failWeight ? Promise.reject(new Error("bad font")) : Promise.resolve(face) };
      return face;
    },
    set: {
      add: (face) => {
        added.push(face);
        return env.set;
      },
      delete: (face) => {
        deleted.push(face);
        return true;
      },
    },
  };
  return { env, added, deleted };
}

describe("formal RO fonts", () => {
  it("loads the two verified client fonts and disposes idempotently", async () => {
    const e = environment();
    const installed = await installFormalFonts(ui(new Map([
      ["ui.font.scdream4", new ArrayBuffer(4)],
      ["ui.font.scdream6", new ArrayBuffer(6)],
    ])), whitelist, e.env);
    expect(e.added).toHaveLength(2);
    expect(installed.family).toBe("RO SCDream");
    installed.dispose();
    installed.dispose();
    expect(installed.disposed).toBe(true);
    expect(e.deleted).toHaveLength(2);
  });

  it("fails closed with the exact font ID and canonical path", async () => {
    const e = environment("600");
    const err = await installFormalFonts(ui(new Map([
      ["ui.font.scdream4", new ArrayBuffer(4)],
      ["ui.font.scdream6", new ArrayBuffer(6)],
    ])), whitelist, e.env).catch((reason: unknown) => reason);
    expect(err).toBeInstanceOf(MissingAssetsError);
    expect((err as MissingAssetsError).missing).toEqual([
      expect.objectContaining({ assetId: "ui.font.scdream6", canonicalPath: whitelist.get("ui.font.scdream6").canonical_cp949_path }),
    ]);
    expect(e.added).toHaveLength(0);
  });
});
