import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import preact from "@preact/preset-vite";
import { computeBuildInfo, resolveClientBuild } from "./build-info.ts";

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

export default defineConfig(({ mode }) => {
  const client = resolveClientBuild(mode);
  return {
  plugins: [preact(), ...(client.fixture ? [] : [excludeFixtureModules()])],
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
