/**
 * Formal visual static guard (UI-B2). Applied only to the formal RO primitive dependency graph
 * (src/ui/ro and everything it reaches by relative imports, including CSS and CSS @import), so
 * blocked-diagnostics / test-fixture CSS elsewhere is not scanned.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

export const FORBIDDEN: { family: string; pattern: RegExp }[] = [
  { family: "gradient", pattern: /\b(?:repeating-)?(?:linear|radial|conic)-gradient\s*\(/iu },
  { family: "border-radius", pattern: /border-?radius/iu },
  { family: "box-shadow", pattern: /(?:box|text)-?shadow|drop-shadow/iu },
  { family: "css-border-surface", pattern: /\bborder(?:-?(?:top|right|bottom|left))?(?:-?(?:width|style|color|image))?["']?\s*:/iu },
  { family: "pseudo-element-surface", pattern: /::?(?:before|after)\b/iu },
  { family: "css-colour-fill", pattern: /background-?color|\bbackground["']?\s*:/iu },
  { family: "css-state-synthesis", pattern: /\bfilter["']?\s*:|\bopacity["']?\s*:|mix-?blend/iu },
  { family: "inline-svg", pattern: /<svg\b|createElementNS|image\/svg|\.svg\b/iu },
  { family: "emoji", pattern: /\p{Extended_Pictographic}/u },
  { family: "icon-font", pattern: /@font-face|font-?family["']?\s*:[^;\n]*(?:icon|awesome|material|glyph)/iu },
  { family: "canvas-webgl-texture", pattern: /getContext\s*\(|CanvasRenderingContext|WebGL|OffscreenCanvas|toDataURL|createImageData|\bnew\s+THREE\./u },
  { family: "network-or-gateway", pattern: /\bfetch\s*\(|XMLHttpRequest|\/v1\/(?:assets|derived)|getDerivedImage|getBinary|getJson|HttpAssetGatewayClient/u },
  { family: "placeholder-or-synthetic", pattern: /from\s+["'][^"']*(?:placeholder|synthetic|fixture|testkit)[^"']*["']|PlaceholderAssetGateway/iu },
  // Only a verified handle's object URL may be a raster source: url("${handle.url}") in a template.
  { family: "literal-raster-source", pattern: /\burl\(\s*["']?(?!\$\{)[^\s)"'$]|<img\b|\bsrc\s*=|new\s+Image\s*\(/iu },
];

/** Non-relative runtime imports allowed in the primitive graph (type-only imports are not runtime). */
export const ALLOWED_EXTERNAL_RUNTIME = new Set(["preact", "preact/hooks", "preact/jsx-runtime", "@ro-survivor/asset-contracts", "@ro-survivor/content-schema"]);

const stripComments = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/(^|[^:"'])\/\/.*$/gmu, "$1");

export function scanFormalVisual(source: string): string[] {
  const code = stripComments(source);
  return FORBIDDEN.filter((f) => f.pattern.test(code)).map((f) => f.family);
}

const isCode = (f: string) => /\.(?:ts|tsx)$/u.test(f);
const isStyle = (f: string) => /\.css$/u.test(f);
const isFile = (f: string) => existsSync(f) && statSync(f).isFile();

/** Resolve a relative specifier: exact, then .ts/.tsx/.css/.module.css, then index.* in a directory. */
export function resolveRelative(fromFile: string, spec: string): string | null {
  const base = resolve(dirname(fromFile), spec.split("?")[0] as string);
  const exts = ["", ".ts", ".tsx", ".css", ".module.css"];
  for (const e of exts) if (isFile(base + e)) return base + e;
  for (const e of [".ts", ".tsx", ".css", ".module.css"]) if (isFile(join(base, `index${e}`))) return join(base, `index${e}`);
  return null;
}

/** Module specifiers referenced by a file: TS/TSX imports, dynamic imports and runtime re-exports; CSS @import. */
function specifiers(file: string, src: string): { spec: string; typeOnly: boolean }[] {
  const code = stripComments(src);
  if (isStyle(file)) return [...code.matchAll(/@import\s+(?:url\(\s*)?["']?([^"')\s;]+)/gu)].map((m) => ({ spec: m[1] as string, typeOnly: false }));
  const out: { spec: string; typeOnly: boolean }[] = [];
  for (const m of code.matchAll(/^\s*(import|export)\s+(type\s+)?([^"';]*?)\s*from\s+["']([^"']+)["']/gmu)) out.push({ spec: m[4] as string, typeOnly: Boolean(m[2]) });
  for (const m of code.matchAll(/^\s*import\s+["']([^"']+)["']/gmu)) out.push({ spec: m[1] as string, typeOnly: false });
  for (const m of code.matchAll(/import\s*\(\s*["']([^"']+)["']\s*\)/gu)) out.push({ spec: m[1] as string, typeOnly: false });
  return out;
}

/** Every file reachable from `entry` by relative imports / re-exports: TS/TSX and CSS (incl. @import). */
export function moduleGraph(entry: string): string[] {
  const seen = new Set<string>();
  const walk = (file: string): void => {
    if (seen.has(file) || !(isCode(file) || isStyle(file)) || !isFile(file)) return;
    seen.add(file);
    for (const { spec } of specifiers(file, readFileSync(file, "utf8"))) {
      if (!spec.startsWith(".")) continue;
      const r = resolveRelative(file, spec);
      if (r) walk(r);
    }
  };
  walk(resolve(entry));
  return [...seen].sort();
}

/** Non-relative runtime specifiers (imports, dynamic imports and re-exports); type-only ones excluded. */
export function externalRuntimeImports(source: string, file = "x.ts"): string[] {
  return specifiers(file, source).filter((x) => !x.typeOnly && !x.spec.startsWith(".")).map((x) => x.spec);
}

/** Full guard over a graph: forbidden visual families in code and styles, and non-allowlisted runtime packages. */
export function guardGraph(entry: string): { file: string; violations: string[] }[] {
  return moduleGraph(entry)
    .map((file) => {
      const src = readFileSync(file, "utf8");
      const violations = scanFormalVisual(src);
      if (isCode(file)) for (const spec of externalRuntimeImports(src, file)) if (!ALLOWED_EXTERNAL_RUNTIME.has(spec)) violations.push(`external-import:${spec}`);
      if (isStyle(file)) for (const { spec } of specifiers(file, src)) if (!spec.startsWith(".")) violations.push(`non-relative-css-import:${spec}`);
      for (const { spec } of specifiers(file, src)) if (spec.startsWith(".") && !resolveRelative(file, spec)) violations.push(`unresolved-import:${spec}`);
      return { file, violations };
    })
    .filter((r) => r.violations.length > 0);
}

/** All TS/TSX files under `root`. */
function allSources(root: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (isCode(p)) out.push(p);
    }
  };
  walk(root);
  return out.sort();
}

/**
 * Loader-only mint guard over every production source under `root` (apps/client/src): which files
 * import `game/formal/rasterMint.ts` and which call `mintRasterSet(`; `ui/ro/raster.ts` may import only
 * the brand check.
 */
export function mintUsage(root: string): { importers: string[]; callers: string[]; rasterImportsOnlyBrand: boolean } {
  const mint = join(root, "game/formal/rasterMint.ts");
  const importers: string[] = [];
  const callers: string[] = [];
  let rasterImportsOnlyBrand = true;
  for (const f of allSources(root)) {
    if (f === mint) continue;
    const src = stripComments(readFileSync(f, "utf8"));
    const imports = specifiers(f, src).filter((x) => x.spec.startsWith(".") && resolveRelative(f, x.spec) === mint);
    if (imports.length > 0) importers.push(relative(root, f));
    if (/\bmintRasterSet\s*\(/u.test(src)) callers.push(relative(root, f));
    if (relative(root, f) === join("ui", "ro", "raster.ts") && imports.length > 0) {
      rasterImportsOnlyBrand = /import\s*\{\s*isMintedRaster\s*\}\s*from/u.test(src) && !/mintRasterSet/u.test(src);
    }
  }
  return { importers: importers.sort(), callers: callers.sort(), rasterImportsOnlyBrand };
}
