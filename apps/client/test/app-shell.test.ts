import { describe, expect, it } from "vitest";
import { APP_MANIFEST, serviceWorkerSource, shellFiles } from "../pwa/app-shell.ts";
import { PWA_ICON_ASSET_ID, PWA_ICON_SCALES, renderPixelRatio, runtimeManifest } from "../src/pwa.ts";

describe("offline app shell", () => {
  it("precaches only built HTML/JS/CSS/manifest, never RO data, local assets or the worker itself", () => {
    const files = shellFiles([
      "assets/index-abc.js", "assets/index-abc.css", "index.html", "manifest.webmanifest", "sw.js",
      "assets/shadow.png", "data/texture/effect/piero.bmp", ".local-assets/x.js", "bgm/12.mp3", "assets/map.gnd", "assets/a.str",
      "assets/index-abc.js",
    ]);
    expect(files).toEqual(["assets/index-abc.css", "assets/index-abc.js", "index.html", "manifest.webmanifest"]);
    expect(() => shellFiles(["../outside.js"])).toThrow(/outside the build output/u);
  });

  it("generates a versioned cache that passes every non-shell or cross-origin request to the network", () => {
    const sw = serviceWorkerSource("0.0.0+abc/def.20261122", ["assets/a.js", "index.html"]);
    expect(sw).toContain('const CACHE = "ro-survivor-shell-0.0.0+abc_def.20261122";');
    expect(sw).toContain('const SHELL = ["./","./assets/a.js","./index.html"];');
    expect(sw).toContain("url.origin !== self.location.origin || !SHELL_PATHS.has(url.pathname)");
    expect(sw).not.toMatch(/skipWaiting|clients\.claim|location\.reload/u);
    expect(sw).toContain('req.method !== "GET"');
  });

  it("declares a standalone fan-game manifest without bundled RO art", () => {
    expect(APP_MANIFEST).toMatchObject({ start_url: "./", scope: "./", display: "fullscreen", orientation: "any" });
    expect(APP_MANIFEST.icons).toEqual([]);
  });

  it("caps the render pixel ratio at 1.5x for coarse pointers and 2x otherwise", () => {
    expect(renderPixelRatio(3, true)).toBe(1.5);
    expect(renderPixelRatio(3, false)).toBe(2);
    expect(renderPixelRatio(1, true)).toBe(1);
    expect(renderPixelRatio(Number.NaN, false)).toBe(1);
  });

  it("builds the runtime manifest with absolute URLs and icons from the verified RO raster only", () => {
    const icons = [{ src: "data:image/png;base64,AA==", sizes: "192x192", type: "image/png" as const, purpose: "any" as const }];
    const m = runtimeManifest(APP_MANIFEST, "https://host.test/game/index.html?x=1", icons);
    expect(m).toMatchObject({ start_url: "https://host.test/game/", scope: "https://host.test/game/", name: APP_MANIFEST.name, icons });
    expect(PWA_ICON_ASSET_ID).toBe("ui.skill.sm_bash.icon");
    expect(PWA_ICON_SCALES.map((s) => 24 * s)).toEqual([192, 384]);
  });
});
