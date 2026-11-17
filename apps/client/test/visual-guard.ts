/**
 * Formal visual static guard (UI-B2). Applied only to the formal RO primitive dependency graph
 * (src/ui/ro and everything it reaches by relative imports, including CSS and CSS @import), so
 * blocked-diagnostics / test-fixture CSS elsewhere is not scanned. TS/TSX module structure (imports,
 * re-exports, dynamic imports, type-only forms) and raster sources are read from the TypeScript AST;
 * every path the guard reports is POSIX (`/`) on every OS.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import ts from "typescript";

/** Visual families scanned as text (comments stripped). `css` families apply to stylesheets only. */
export const FORBIDDEN: { family: string; pattern: RegExp; css?: boolean }[] = [
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
  { family: "placeholder-or-synthetic", pattern: /from\s*["'][^"']*(?:placeholder|synthetic|fixture|testkit)[^"']*["']|PlaceholderAssetGateway/iu },
  // Stylesheets can never hold a verified handle, so every CSS raster source is literal. TS/TSX raster
  // sources are checked on the AST (rasterSourceViolations) instead of this pattern.
  { family: "literal-raster-source", pattern: /\burl\s*\(|\bimage(?:-set)?\s*\(|<img\b/iu, css: true },
];

/** Non-relative runtime imports allowed in the primitive graph (type-only imports are not runtime). */
export const ALLOWED_EXTERNAL_RUNTIME = new Set(["preact", "preact/hooks", "preact/jsx-runtime", "@ro-survivor/asset-contracts", "@ro-survivor/content-schema"]);

/** The single helper allowed to turn a VerifiedRaster into a CSS raster source (see isAllowedRasterHelper). */
export const RASTER_URL_HELPER = "verifiedRasterUrl";

/** `path` relative to `root`, always with `/` separators. */
export function relPosix(root: string, path: string): string {
  return relative(root, path).split(sep).join("/");
}

const stripComments = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/(^|[^:"'])\/\/.*$/gmu, "$1");
const isCode = (f: string) => /\.(?:ts|tsx)$/u.test(f);
const isStyle = (f: string) => /\.css$/u.test(f);
const isFile = (f: string) => existsSync(f) && statSync(f).isFile();

function parse(file: string, src: string): ts.SourceFile {
  return ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.TSX);
}

function walkAst(node: ts.Node, visit: (n: ts.Node) => void): void {
  visit(node);
  ts.forEachChild(node, (c) => walkAst(c, visit));
}

const literalText = (n: ts.Node | undefined): string | null => (n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : null);

/** `<tag` / `tag(...)` names that load an external raster or document. */
const IMAGE_TAGS = /^(?:img|image|picture|source|video|audio|iframe|object|embed|input)$/iu;
/** Properties / attributes / setAttribute names that are always an external raster or document source. */
const SOURCE_PROPS = /^(?:src|srcset|poster)$/iu;
/** JSX attributes that load an external raster or document. */
const SOURCE_ATTRS = /^(?:src|srcset|srcSet|poster|data|href|xlinkHref|xlink:href)$/u;
/** Style properties that can carry a raster: the value must be a plain literal (whose text is scanned), or the helper call for backgroundImage. */
const STYLE_RASTER_PROPS = /^(?:backgroundImage|background-image|background|listStyleImage|list-style-image|listStyle|list-style|borderImage|border-image|borderImageSource|border-image-source|maskImage|mask-image|mask|webkitMaskImage|WebkitMaskImage|content|cursor)$/u;
const isPlainLiteral = (n: ts.Node | undefined): boolean => n !== undefined && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isNumericLiteral(n));

const propName = (n: ts.PropertyName | ts.JsxAttributeName): string | null => {
  if (ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isNumericLiteral(n)) return n.text;
  if (ts.isJsxNamespacedName(n)) return `${n.namespace.text}:${n.name.text}`;
  return null;
};

/**
 * The one allowed raster-source expression:
 *   function verifiedRasterUrl(<p>: VerifiedRaster): string { return `url("${checkRaster(<p>, "<field>").url}")`; }
 */
export function isAllowedRasterHelper(fn: ts.Node): fn is ts.FunctionDeclaration {
  if (!ts.isFunctionDeclaration(fn) || fn.name?.text !== RASTER_URL_HELPER || fn.parameters.length !== 1) return false;
  const p = fn.parameters[0] as ts.ParameterDeclaration;
  if (!ts.isIdentifier(p.name) || !p.type || !ts.isTypeReferenceNode(p.type) || p.type.typeName.getText() !== "VerifiedRaster") return false;
  const body = fn.body?.statements;
  if (!body || body.length !== 1) return false;
  const ret = body[0] as ts.Statement;
  if (!ts.isReturnStatement(ret) || !ret.expression || !ts.isTemplateExpression(ret.expression)) return false;
  const t = ret.expression;
  if (t.head.text !== 'url("' || t.templateSpans.length !== 1) return false;
  const span = t.templateSpans[0] as ts.TemplateSpan;
  if (span.literal.text !== '")') return false;
  const e = span.expression;
  if (!ts.isPropertyAccessExpression(e) || e.name.text !== "url" || !ts.isCallExpression(e.expression)) return false;
  const call = e.expression;
  return ts.isIdentifier(call.expression) && call.expression.text === "checkRaster" && call.arguments.length === 2 && ts.isIdentifier(call.arguments[0] as ts.Expression) && (call.arguments[0] as ts.Identifier).text === p.name.text && literalText(call.arguments[1]) !== null;
}

/** A call to the helper: `verifiedRasterUrl(<anything>)`. */
const isHelperCall = (n: ts.Node): boolean => ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === RASTER_URL_HELPER;

/**
 * AST raster-source check for TS/TSX. Rejects every `url(` / `image(` / `image-set(` in any string,
 * template or JSX text (interpolated or not) outside the exact allowed helper, image-loading elements
 * (JSX or h()/createElement/jsx("img", ...)), `new Image`, `src`-like attributes / properties /
 * assignments / setAttribute, and raster style properties whose value is not a helper call.
 * Returns the number of allowed helpers as well (more than one per graph is a violation).
 */
export function rasterSourceViolations(file: string, src: string): { violations: string[]; helpers: number } {
  const sf = parse(file, src);
  const hits = new Set<string>();
  let helpers = 0;
  const allowed = new Set<ts.Node>();
  walkAst(sf, (n) => {
    if (isAllowedRasterHelper(n)) {
      helpers += 1;
      const ret = (n.body?.statements[0] as ts.ReturnStatement).expression as ts.TemplateExpression;
      allowed.add(ret);
    }
  });
  const rasterText = /\burl\s*\(|\bimage(?:-set)?\s*\(|<img\b/iu;
  const inAllowed = (n: ts.Node): boolean => {
    for (let c: ts.Node | undefined = n; c; c = c.parent) if (allowed.has(c)) return true;
    return false;
  };
  walkAst(sf, (n) => {
    // 1. textual raster sources in any literal / template part / JSX text
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n) || ts.isJsxText(n)) {
      if (rasterText.test(n.text) && !inAllowed(n)) hits.add("literal-raster-source");
    }
    if (ts.isTemplateExpression(n) && !allowed.has(n)) {
      // literal parts joined: catches a source split across interpolations, e.g. `${a}url(${b}`
      if (rasterText.test([n.head.text, ...n.templateSpans.map((s) => s.literal.text)].join(""))) hits.add("literal-raster-source");
    }
    // 2. image-loading elements
    if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && IMAGE_TAGS.test(n.tagName.getText())) hits.add("literal-raster-source");
    if (ts.isCallExpression(n)) {
      const callee = n.expression.getText();
      const first = literalText(n.arguments[0]);
      if (/^(?:h|createElement|jsx|jsxs|jsxDEV|_jsx|_jsxs|document\.createElement|React\.createElement)$/u.test(callee) && first !== null && IMAGE_TAGS.test(first)) hits.add("literal-raster-source");
      if (/(?:^|\.)setAttribute(?:NS)?$/u.test(callee) && n.arguments.some((a) => { const t = literalText(a); return t !== null && (SOURCE_PROPS.test(t) || SOURCE_ATTRS.test(t) || t.toLowerCase() === "style"); })) hits.add("literal-raster-source");
      if (/(?:^|\.)setProperty$/u.test(callee) && n.arguments.some((a) => { const t = literalText(a); return t !== null && STYLE_RASTER_PROPS.test(t); })) hits.add("literal-raster-source");
    }
    if (ts.isNewExpression(n) && /^(?:Image|window\.Image|globalThis\.Image)$/u.test(n.expression.getText())) hits.add("literal-raster-source");
    // 3. src-like JSX attributes, object properties and assignments
    if (ts.isJsxAttribute(n)) {
      const name = propName(n.name);
      if (name !== null && SOURCE_ATTRS.test(name)) hits.add("literal-raster-source");
    }
    if ((ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n)) && n.name) {
      const name = propName(n.name);
      const init = ts.isPropertyAssignment(n) ? n.initializer : undefined;
      if (name !== null && SOURCE_PROPS.test(name)) hits.add("literal-raster-source");
      if (name !== null && STYLE_RASTER_PROPS.test(name)) {
        const viaHelper = init !== undefined && /^background-?image$/iu.test(name) && isHelperCall(init);
        if (!viaHelper && !isPlainLiteral(init)) hits.add("literal-raster-source");
      }
    }
    if (ts.isComputedPropertyName(n)) {
      const t = literalText(n.expression);
      if (t !== null && (SOURCE_PROPS.test(t) || STYLE_RASTER_PROPS.test(t))) hits.add("literal-raster-source");
    }
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const l = n.left;
      const name = ts.isPropertyAccessExpression(l) ? l.name.text : ts.isElementAccessExpression(l) ? literalText(l.argumentExpression) : null;
      if (name !== null && (SOURCE_PROPS.test(name) || (STYLE_RASTER_PROPS.test(name) && !isPlainLiteral(n.right)))) hits.add("literal-raster-source");
    }
  });
  if (helpers > 1) hits.add("duplicate-raster-url-helper");
  return { violations: [...hits], helpers };
}

/** Text families + raster sources. `file` decides CSS vs TS/TSX handling (default: TSX). */
export function scanFormalVisual(source: string, file = "x.tsx"): string[] {
  const code = stripComments(source);
  if (isStyle(file)) {
    const noImports = code.replace(/@import\b[^;]*;?/giu, "");
    return FORBIDDEN.filter((f) => f.pattern.test(f.css ? noImports : code)).map((f) => f.family);
  }
  const out = FORBIDDEN.filter((f) => !f.css && f.pattern.test(code)).map((f) => f.family);
  for (const v of rasterSourceViolations(file, source).violations) if (!out.includes(v)) out.push(v);
  return out;
}

/** Resolve a relative specifier: exact, then .ts/.tsx/.css/.module.css, then index.* in a directory. */
export function resolveRelative(fromFile: string, spec: string): string | null {
  const base = resolve(dirname(fromFile), spec.split("?")[0] as string);
  const exts = ["", ".ts", ".tsx", ".css", ".module.css"];
  for (const e of exts) if (isFile(base + e)) return base + e;
  for (const e of [".ts", ".tsx", ".css", ".module.css"]) if (isFile(join(base, `index${e}`))) return join(base, `index${e}`);
  return null;
}

export interface ModuleRefs {
  specs: { spec: string; typeOnly: boolean }[];
  /** Module loads the guard cannot follow statically: non-literal import()/require(), import.meta.glob. */
  opaque: string[];
}

const isTypeOnlyNamed = (els: ts.NodeArray<ts.ImportSpecifier | ts.ExportSpecifier>): boolean => els.length > 0 && els.every((e) => e.isTypeOnly);

/** Module references of a TS/TSX file from its AST. */
export function codeRefs(file: string, src: string): ModuleRefs {
  const sf = parse(file, src);
  const specs: ModuleRefs["specs"] = [];
  const opaque: string[] = [];
  walkAst(sf, (n) => {
    if (ts.isImportDeclaration(n)) {
      const spec = literalText(n.moduleSpecifier);
      if (spec === null) return;
      const c = n.importClause;
      const typeOnly = Boolean(c && (c.isTypeOnly || (!c.name && c.namedBindings && ts.isNamedImports(c.namedBindings) && isTypeOnlyNamed(c.namedBindings.elements))));
      specs.push({ spec, typeOnly });
    } else if (ts.isExportDeclaration(n) && n.moduleSpecifier) {
      const spec = literalText(n.moduleSpecifier);
      if (spec === null) return;
      const typeOnly = n.isTypeOnly || Boolean(n.exportClause && ts.isNamedExports(n.exportClause) && isTypeOnlyNamed(n.exportClause.elements));
      specs.push({ spec, typeOnly });
    } else if (ts.isImportEqualsDeclaration(n) && ts.isExternalModuleReference(n.moduleReference)) {
      const spec = literalText(n.moduleReference.expression);
      if (spec === null) opaque.push("non-literal-require");
      else specs.push({ spec, typeOnly: n.isTypeOnly });
    } else if (ts.isCallExpression(n) && (n.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(n.expression) && n.expression.text === "require"))) {
      const spec = literalText(n.arguments[0]);
      if (spec === null || n.arguments.length !== 1) opaque.push(n.expression.kind === ts.SyntaxKind.ImportKeyword ? "non-literal-dynamic-import" : "non-literal-require");
      if (spec !== null) specs.push({ spec, typeOnly: false });
    } else if ((ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) && ts.isMetaProperty(n.expression) && n.expression.keywordToken === ts.SyntaxKind.ImportKeyword) {
      const name = ts.isPropertyAccessExpression(n) ? n.name.text : literalText(n.argumentExpression);
      if (name === null || /^glob/u.test(name)) opaque.push("import-meta-glob");
    }
  });
  return { specs, opaque };
}

/** Module specifiers of a file: AST for TS/TSX; case-insensitive @import (quoted, url(), bare) for CSS. */
function specifiers(file: string, src: string): ModuleRefs {
  if (!isStyle(file)) return codeRefs(file, src);
  const code = stripComments(src);
  const specs = [...code.matchAll(/@import\s+(?:url\(\s*)?["']?([^"')\s;]+)/giu)].map((m) => ({ spec: m[1] as string, typeOnly: false }));
  return { specs, opaque: [] };
}

/** Every file reachable from `entry` by relative imports / re-exports: TS/TSX and CSS (incl. @import). */
export function moduleGraph(entry: string): string[] {
  const seen = new Set<string>();
  const walk = (file: string): void => {
    if (seen.has(file) || !(isCode(file) || isStyle(file)) || !isFile(file)) return;
    seen.add(file);
    for (const { spec } of specifiers(file, readFileSync(file, "utf8")).specs) {
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
  return specifiers(file, source).specs.filter((x) => !x.typeOnly && !x.spec.startsWith(".")).map((x) => x.spec);
}

/**
 * Full guard over a graph: forbidden visual families and raster sources in code and styles,
 * non-allowlisted runtime packages, opaque module loads, unresolved relative imports, and at most one
 * raster URL helper in the whole graph. `file` is absolute; use relPosix for a portable name.
 */
export function guardGraph(entry: string): { file: string; violations: string[] }[] {
  const files = moduleGraph(entry);
  let helpers = 0;
  const rows = files.map((file) => {
    const src = readFileSync(file, "utf8");
    const violations = scanFormalVisual(src, file);
    const refs = specifiers(file, src);
    if (isCode(file)) {
      helpers += rasterSourceViolations(file, src).helpers;
      for (const spec of externalRuntimeImports(src, file)) if (!ALLOWED_EXTERNAL_RUNTIME.has(spec)) violations.push(`external-import:${spec}`);
      for (const o of refs.opaque) if (!violations.includes(o)) violations.push(o);
    }
    if (isStyle(file)) for (const { spec } of refs.specs) if (!spec.startsWith(".")) violations.push(`non-relative-css-import:${spec}`);
    for (const { spec } of refs.specs) if (spec.startsWith(".") && !resolveRelative(file, spec)) violations.push(`unresolved-import:${spec}`);
    return { file, violations };
  });
  if (helpers > 1) for (const r of rows) if (!r.violations.includes("duplicate-raster-url-helper") && rasterSourceViolations(r.file, readFileSync(r.file, "utf8")).helpers > 0) r.violations.push("duplicate-raster-url-helper");
  return rows.filter((r) => r.violations.length > 0);
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
 * Loader-only mint guard over every production source under `root` (apps/client/src), from the AST:
 * which files import `game/formal/rasterMint.ts` (static, re-export, literal dynamic import), which
 * reference `mintRasterSet` at all (call, alias, property, string), and which contain module loads the
 * guard cannot follow (`opaque`: non-literal import()/require(), import.meta.glob — none are allowed).
 * `ui/ro/raster.ts` may import only the brand check. Every path is POSIX and relative to `root`.
 */
export function mintUsage(root: string): { importers: string[]; callers: string[]; opaque: string[]; rasterImportsOnlyBrand: boolean } {
  const mint = join(root, "game", "formal", "rasterMint.ts");
  const importers: string[] = [];
  const callers: string[] = [];
  const opaque: string[] = [];
  let rasterImportsOnlyBrand = true;
  for (const f of allSources(root)) {
    if (f === mint) continue;
    const name = relPosix(root, f);
    const src = readFileSync(f, "utf8");
    const refs = codeRefs(f, src);
    if (refs.opaque.length > 0) opaque.push(name);
    const imports = refs.specs.filter((x) => x.spec.startsWith(".") && resolveRelative(f, x.spec) === mint);
    if (imports.length > 0) importers.push(name);
    const sf = parse(f, src);
    let referencesMint = false;
    walkAst(sf, (n) => {
      if ((ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isPrivateIdentifier(n)) && n.text.includes("mintRasterSet")) referencesMint = true;
    });
    if (referencesMint) callers.push(name);
    if (name === "ui/ro/raster.ts" && imports.length > 0) {
      let onlyBrand = !referencesMint;
      walkAst(sf, (n) => {
        if (ts.isImportDeclaration(n) && literalText(n.moduleSpecifier) !== null && resolveRelative(f, literalText(n.moduleSpecifier) as string) === mint) {
          const c = n.importClause;
          const els = c?.namedBindings && ts.isNamedImports(c.namedBindings) ? c.namedBindings.elements : null;
          if (!c || c.name || !els || els.length !== 1 || (els[0] as ts.ImportSpecifier).name.text !== "isMintedRaster" || (els[0] as ts.ImportSpecifier).propertyName) onlyBrand = false;
        } else if (ts.isExportDeclaration(n) && n.moduleSpecifier && literalText(n.moduleSpecifier) !== null && resolveRelative(f, literalText(n.moduleSpecifier) as string) === mint) onlyBrand = false;
        else if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword) onlyBrand = false;
      });
      rasterImportsOnlyBrand = onlyBrand;
    }
  }
  return { importers: importers.sort(), callers: callers.sort(), opaque: opaque.sort(), rasterImportsOnlyBrand };
}
