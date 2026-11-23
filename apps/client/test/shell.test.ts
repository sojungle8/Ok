import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { whitelist } from "../src/gateway.ts";
import { formalShellAssetIds } from "../src/ui/ro/shell.tsx";

const clientSrc = resolve(import.meta.dirname, "../src");

describe("formal pre-run RO shell", () => {
  it("declares only the canonical original RO window/button closure plus the screen preview", () => {
    const title = formalShellAssetIds("title");
    const character = formalShellAssetIds("character-select");
    const stage = formalShellAssetIds("stage-select");
    expect(title).toHaveLength(21);
    expect(character).toEqual([...title, "ui.skill.sm_sword.icon"].sort());
    expect(stage).toEqual([...title, "ui.minimap.map.prt_fild08"].sort());
    for (const id of [...new Set([...title, ...character, ...stage])]) {
      const row = whitelist.get(id);
      expect(row.source_container, id).toBe("data.grf");
      expect(row.canonical_cp949_path, id).toMatch(/^data\\texture\\/u);
    }
  });

  it("uses verified primitives and text layout without a substitute bitmap or CSS-drawn panel", () => {
    const source = readFileSync(resolve(clientSrc, "ui/ro/shell.tsx"), "utf8");
    const css = readFileSync(resolve(clientSrc, "ui/ro/shell.css"), "utf8");
    expect(source).toContain("RoWindow");
    expect(source).toContain("RoThreeSliceButton");
    expect(source).toContain("RoRaster");
    expect(source).not.toMatch(/<img|<svg|<canvas|data:image|https?:\/\//u);
    expect(css).not.toMatch(/(?:^|[;{]\s*)(?:background|border|box-shadow|filter)\s*:/mu);
    expect(css).not.toMatch(/url\s*\(/u);
    expect(css).not.toMatch(/transform\s*:\s*scale/u);
  });

  it("keeps the legacy generic shell explicitly fixture-only in App", () => {
    const app = readFileSync(resolve(clientSrc, "App.tsx"), "utf8");
    expect(app).toContain("shellUi ? <RoTitleShell");
    expect(app).toContain(": FIXTURE_BUILD ? (");
    expect(app).toContain("TEST FIXTURE：正式版會載入原始 RO 視窗素材。");
    expect(app).toContain("<RoCharacterSelectShell");
    expect(app).toContain("<FormalPlayerPreview preview={shellPlayerPreview}");
    expect(app).toContain("<RoStageSelectShell");
  });
});
