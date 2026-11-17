import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { computeBuildInfo } from "./build-info.ts";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const { buildId, profile } = computeBuildInfo(repoRoot, process.env);

export default defineConfig({
  plugins: [preact()],
  base: "./",
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
    __BUILD_PROFILE__: JSON.stringify(profile),
  },
  server: {
    host: "127.0.0.1",
    fs: { allow: [repoRoot] },
  },
  preview: { host: "127.0.0.1" },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
  },
});
