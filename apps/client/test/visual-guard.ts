/**
 * Formal visual static guard (UI-B2). Applied only to the formal RO primitive dependency graph
 * (src/ui/ro and everything it reaches by relative imports, including CSS and CSS @import), so
 * blocked-diagnostics / test-fixture CSS elsewhere is not scanned.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

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

/** Every file reachable from `entry` by relative imports: TS/TSX (static + dynamic) and CSS (incl. @import). */
export function moduleGraph(entry: string): string[] {
  const seen = new Set<string>();
  const walk = (file: string): void => {
    if (seen.has(file) || !(isCode(file) || isStyle(file)) || !existsSync(file)) return;
    seen.add(file);
    const src = readFileSync(file, "utf8");
    const specs = isStyle(file)
      ? [...src.matchAll(/@import\s+(?:url\(\s*)?["']?([^"')\s;]+)/gu)].map((m) => m[1] as string)
      : [...src.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)["']([^"']+)["']/gu)].map((m) => m[1] as string);
    for (const s of specs) if (s.startsWith(".")) walk(resolve(dirname(file), s.split("?")[0] as string));
  };
  walk(resolve(entry));
  return [...seen].sort();
}

/** Runtime imports of a TS/TSX module that are not relative (type-only imports excluded). */
export function externalRuntimeImports(source: string): string[] {
  const code = stripComments(source);
  const out: string[] = [];
  for (const m of code.matchAll(/^\s*import\s+(type\s+)?([^"';]*?)\s*(?:from\s+)?["']([^"']+)["']/gmu)) {
    if (m[1]) continue; // `import type …`
    const spec = m[3] as string;
    if (!spec.startsWith(".")) out.push(spec);
  }
  for (const m of code.matchAll(/import\s*\(\s*["']([^"']+)["']\s*\)/gu)) if (!(m[1] as string).startsWith(".")) out.push(m[1] as string);
  return out;
}

/** Full guard over a graph: forbidden visual families in code and styles, and non-allowlisted runtime packages. */
export function guardGraph(entry: string): { file: string; violations: string[] }[] {
  return moduleGraph(entry)
    .map((file) => {
      const src = readFileSync(file, "utf8");
      const violations = scanFormalVisual(src);
      if (isCode(file)) for (const spec of externalRuntimeImports(src)) if (!ALLOWED_EXTERNAL_RUNTIME.has(spec)) violations.push(`external-import:${spec}`);
      return { file, violations };
    })
    .filter((r) => r.violations.length > 0);
}
