import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import preact from "@preact/preset-vite";
import { computeBuildInfo, resolveClientBuild } from "./build-info.ts";
import { APP_MANIFEST, serviceWorkerSource, shellFiles } from "./pwa/app-shell.ts";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const { buildId, profile } = computeBuildInfo(repoRoot, process.env);

/**
 * Formal builds never contain fixture code: imports of test-fixture-only modules (game/fixture/*,
 * BenchApp) resolve to a stub that throws, so not even an orphan chunk of them is emitted.
 */
export const FIXTURE_ONLY_IMPORT = /(?:^|\/)(?:game\/fixture\/[^/]+|BenchApp\.tsx)$/u;
function excludeFixtureModules(): Plugin {
  const STUB = "\0ro-fixture-excluded";
  return {
    name: "ro-formal-excludes-fixture",
    enforce: "pre",
    resolveId(source) {
      return FIXTURE_ONLY_IMPORT.test(source) ? STUB : null;
    },
    load(id) {
      return id === STUB ? 'throw new Error("test-fixture module is not part of the formal build");' : null;
    },
  };
}

/** Emit sw.js + manifest.webmanifest listing only the built shell files (Phase 3.3). */
function appShell(id: string): Plugin {
  return {
    name: "ro-app-shell",
    apply: "build",
    generateBundle(_options, bundle) {
      this.emitFile({ type: "asset", fileName: "manifest.webmanifest", source: JSON.stringify(APP_MANIFEST, null, 2) });
      const files = shellFiles([...Object.keys(bundle), "index.html", "manifest.webmanifest"]);
      this.emitFile({ type: "asset", fileName: "sw.js", source: serviceWorkerSource(id, files) });
    },
  };
}

export default defineConfig(({ mode }) => {
  const client = resolveClientBuild(mode);
  return {
  plugins: [preact(), ...(client.fixture ? [] : [excludeFixtureModules()]), appShell(buildId)],
  base: "./",
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
    __BUILD_PROFILE__: JSON.stringify(profile),
    // Compile-time constant: fixture code paths are dead code in formal builds and are dropped.
    __FIXTURE_BUILD__: JSON.stringify(client.fixture),
  },
  server: {
    host: "127.0.0.1",
    fs: { allow: [repoRoot] },
  },
  preview: { host: "127.0.0.1" },
  build: {
    outDir: client.outDir,
    emptyOutDir: true,
    sourcemap: false,
  },
  };
});
