/**
 * Formal visual static guard (UI-B2). Applied only to the formal RO primitive dependency graph
 * (src/ui/ro and what it imports), so blocked-diagnostics / test-fixture CSS elsewhere is not scanned.
 */
import { readFileSync } from "node:fs";
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

const stripComments = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/(^|[^:"'])\/\/.*$/gmu, "$1");

export function scanFormalVisual(source: string): string[] {
  const code = stripComments(source);
  return FORBIDDEN.filter((f) => f.pattern.test(code)).map((f) => f.family);
}

/** Every file reachable from `entry` by relative imports (static or dynamic). */
export function moduleGraph(entry: string): string[] {
  const seen = new Set<string>();
  const walk = (file: string): void => {
    if (seen.has(file) || !/\.(?:ts|tsx)$/u.test(file)) return;
    seen.add(file);
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)["'](\.[^"']+)["']/gu)) walk(resolve(dirname(file), m[1] as string));
  };
  walk(resolve(entry));
  return [...seen].sort();
}
