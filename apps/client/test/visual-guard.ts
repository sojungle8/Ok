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

/** Blank the `[pos, end)` UTF-16 ranges, keeping newlines so line structure survives. */
function blank(src: string, ranges: readonly (readonly [number, number])[]): string {
  let out = "";
  let last = 0;
  for (const [pos, end] of [...ranges].sort((a, b) => a[0] - b[0])) {
    if (pos < last) continue;
    out += src.slice(last, pos) + src.slice(pos, end).replace(/[^\n]/gu, " ");
    last = end;
  }
  return out + src.slice(last);
}

/**
 * TS/TSX comments removed with the TypeScript parser: only real comment trivia between tokens is
 * blanked, so `//` or `/*` inside strings, templates, regexes or JSX text is kept.
 */
export function stripCodeComments(file: string, src: string): string {
  const sf = parse(file, src);
  const ranges = new Map<number, number>();
  const jsxText: [number, number][] = [];
  const visit = (n: ts.Node): void => {
    if (n.kind === ts.SyntaxKind.JsxText) jsxText.push([n.pos, n.end]);
    else {
      // leading: comments after a line break; trailing: same-line comments after a token
      for (const r of ts.getLeadingCommentRanges(src, n.pos) ?? []) ranges.set(r.pos, r.end);
      for (const r of ts.getTrailingCommentRanges(src, n.end) ?? []) ranges.set(r.pos, r.end);
    }
    for (const c of n.getChildren(sf)) visit(c);
  };
  visit(sf);
  // JSX text is never a comment, even when it starts with `//` right after a tag
  const inJsxText = (pos: number) => jsxText.some(([s, e]) => pos >= s && pos < e);
  return blank(src, [...ranges].filter(([pos]) => !inJsxText(pos)));
}

/** CSS comments (block only — CSS has no `//` comments) removed outside quoted strings. */
export function stripCssComments(src: string): string {
  const ranges: [number, number][] = [];
  let quote: string | null = null;
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (quote !== null) {
      if (c === "\\") i += 1;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === "/" && src[i + 1] === "*") {
      const close = src.indexOf("*/", i + 2);
      const end = close < 0 ? src.length : close + 2;
      ranges.push([i, end]);
      i = end - 1;
    }
  }
  return blank(src, ranges);
}

/** Expression without parentheses / `as` / `satisfies` / non-null wrappers. */
function unwrap(n: ts.Node | undefined): ts.Node | undefined {
  let c = n;
  while (c && (ts.isParenthesizedExpression(c) || ts.isAsExpression(c) || ts.isSatisfiesExpression(c) || ts.isNonNullExpression(c) || ts.isTypeAssertionExpression(c))) c = c.expression;
  return c;
}
const literalText = (n: ts.Node | undefined): string | null => {
  const u = unwrap(n);
  return u && (ts.isStringLiteral(u) || ts.isNoSubstitutionTemplateLiteral(u)) ? u.text : null;
};

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

/** The canonical primitive module, the only file that may declare or call the raster URL helper. */
export const isCanonicalPrimitiveModule = (file: string): boolean => /(?:^|[\\/])ui[\\/]ro[\\/]primitives\.tsx$/u.test(file);

/** Element factories: capabilities imported from preact / react (first argument is a tag or a vnode). */
const ELEMENT_FACTORIES = new Set(["h", "createElement", "cloneElement", "jsx", "jsxs", "jsxDEV", "_jsx", "_jsxs", "_jsxDEV"]);
const UI_MODULE = /^(?:preact|react)(?:\/|$)/u;
/** The only intrinsic elements the formal primitives may create (allowlist; anything else fails closed). */
export const INTRINSIC_ALLOW: ReadonlySet<string> = new Set(["div", "span", "button"]);
/**
 * Ambient globals the formal graph may reference, with the static members it may read on them
 * (`"*"` = any member). Every other free identifier (document, window, globalThis, Reflect, eval,
 * Function, …) and every other member fails closed.
 */
export const GLOBAL_ALLOW: Readonly<Record<string, ReadonlySet<string> | "*">> = {
  undefined: "*",
  NaN: "*",
  Infinity: "*",
  Math: "*",
  Array: new Set(["from"]),
  ArrayBuffer: new Set(["isView"]),
  Symbol: new Set(["iterator", "toStringTag"]),
  Number: new Set(["isInteger", "isFinite"]),
  String: new Set(),
  Boolean: new Set(),
  // Function only for the import-time call-binder (Function.prototype.bind / call); never callable
  Function: new Set(["prototype"]),
  Object: new Set(["freeze", "isFrozen", "entries", "isExtensible", "create", "getPrototypeOf", "getOwnPropertyDescriptor"]),
  Map: new Set(),
  Set: new Set(["prototype"]),
  WeakSet: new Set(["prototype"]),
  Error: new Set(),
  TypeError: new Set(),
  AggregateError: new Set(),
  Uint8Array: new Set(["of", "prototype"]),
  Blob: new Set(),
  URL: new Set(["createObjectURL", "revokeObjectURL"]),
  crypto: new Set(["subtle"]),
  structuredClone: new Set(),
};
/**
 * Restricted globals that are functions / constructors: besides allowlisted members they may be called,
 * constructed, used with instanceof / `extends`, or captured in a top-level const at module init.
 * Namespace-like globals (Object, Array, Number, URL, crypto, Symbol, ArrayBuffer) are usable only as
 * `G.<allowed member>` — `const O = Object` and similar aliases fail closed.
 */
const CALLABLE_GLOBALS: ReadonlySet<string> = new Set(["String", "Boolean", "Map", "Set", "WeakSet", "Error", "TypeError", "AggregateError", "Uint8Array", "Blob", "structuredClone"]);
/**
 * Property-writing capabilities. The formal graph needs none of them, so any reference at all — member,
 * computed / string name, alias, destructuring, call / apply / bind — fails closed (`setter-capability`).
 */
export const SETTER_CAPABILITIES: ReadonlySet<string> = new Set(["setAttribute", "setAttributeNS", "setAttributeNode", "setAttributeNodeNS", "toggleAttribute", "setProperty", "defineProperty", "defineProperties", "__defineGetter__", "__defineSetter__", "setPrototypeOf", "assign", "attributeStyleMap", "cssText", "setNamedItem", "setNamedItemNS"]);
/** Member names that reach constructors / prototypes reflectively: never allowed in the formal graph. */
const REFLECTIVE_MEMBERS = new Set(["constructor", "__proto__", "__defineGetter__", "__defineSetter__", "__lookupGetter__", "__lookupSetter__"]);
/** String literals that name a source, an HTML sink, a style raster property, a factory or a reflective member. */
const DANGEROUS_NAME = /^(?:src|srcset|srcSet|poster|innerHTML|outerHTML|insertAdjacentHTML|dangerouslySetInnerHTML|srcdoc|backgroundImage|background-image|listStyleImage|list-style-image|borderImage|border-image|borderImageSource|border-image-source|maskImage|mask-image|webkitMaskImage|WebkitMaskImage|h|createElement|createElementNS|cloneElement|jsx|jsxs|jsxDEV|constructor|__proto__|prototype)$/u;

/** One file parsed into a single-file program (no lib, no resolution) so bindings can be traced to their declarations. */
function analyze(file: string, src: string): { sf: ts.SourceFile; checker: ts.TypeChecker } {
  const name = `/formal/input${file.endsWith(".ts") ? ".ts" : ".tsx"}`;
  const sf = ts.createSourceFile(name, src, ts.ScriptTarget.Latest, true, name.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.TSX);
  const host: ts.CompilerHost = {
    getSourceFile: (f) => (f === name ? sf : undefined),
    getDefaultLibFileName: () => "/formal/lib.d.ts",
    writeFile: () => undefined,
    getCurrentDirectory: () => "/formal",
    getCanonicalFileName: (f) => f,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
    fileExists: (f) => f === name,
    readFile: (f) => (f === name ? src : undefined),
  };
  const program = ts.createProgram([name], { noLib: true, noResolve: true, noEmit: true, types: [], target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.Preserve }, host);
  return { sf: program.getSourceFile(name) ?? sf, checker: program.getTypeChecker() };
}

/** Any assignment expression: `=`, compound (`+=`, …) and logical (`||=`, `&&=`, `??=`). */
const isAssignment = (n: ts.Node): n is ts.BinaryExpression => ts.isBinaryExpression(n) && n.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && n.operatorToken.kind <= ts.SyntaxKind.LastAssignment;

/**
 * A compile-time constant string: a string literal, a no-substitution template, or `a + b` where both
 * sides are constant strings (after parentheses / `as`). Anything else is not provably constant (null).
 */
export function constantString(n: ts.Node | undefined): string | null {
  const u = unwrap(n);
  if (!u) return null;
  if (ts.isStringLiteral(u) || ts.isNoSubstitutionTemplateLiteral(u)) return u.text;
  if (ts.isBinaryExpression(u) && u.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const l = constantString(u.left);
    const r = constantString(u.right);
    return l !== null && r !== null ? l + r : null;
  }
  return null;
}

/** A leaf written by an assignment target, or an unsupported target node (fails closed). */
type TargetLeaf = { kind: "identifier"; node: ts.Identifier } | { kind: "property"; node: ts.PropertyAccessExpression } | { kind: "element"; node: ts.ElementAccessExpression } | { kind: "unknown"; node: ts.Node };

/**
 * Every leaf an assignment / for-in / for-of / ++ / -- target writes: identifiers, property and element
 * accesses, recursing through array / object destructuring, spreads, defaults and wrappers. Any other
 * target shape is reported as `unknown`.
 */
export function walkAssignmentTarget(target: ts.Node | undefined, visit: (leaf: TargetLeaf) => void): void {
  const u = unwrap(target);
  if (!u || ts.isOmittedExpression(u)) return;
  if (ts.isIdentifier(u)) visit({ kind: "identifier", node: u });
  else if (ts.isPropertyAccessExpression(u)) visit({ kind: "property", node: u });
  else if (ts.isElementAccessExpression(u)) visit({ kind: "element", node: u });
  else if (ts.isArrayLiteralExpression(u)) for (const e of u.elements) walkAssignmentTarget(e, visit);
  else if (ts.isSpreadElement(u) || ts.isSpreadAssignment(u)) walkAssignmentTarget(u.expression, visit);
  else if (ts.isObjectLiteralExpression(u)) {
    for (const p of u.properties) {
      if (ts.isShorthandPropertyAssignment(p)) visit({ kind: "identifier", node: p.name });
      else if (ts.isPropertyAssignment(p)) walkAssignmentTarget(p.initializer, visit);
      else if (ts.isSpreadAssignment(p)) walkAssignmentTarget(p.expression, visit);
      else visit({ kind: "unknown", node: p });
    }
  } else if (ts.isBinaryExpression(u) && u.operatorToken.kind === ts.SyntaxKind.EqualsToken) walkAssignmentTarget(u.left, visit); // default value
  else visit({ kind: "unknown", node: u });
}

/** The target written by `n` (assignment of any operator, ++ / --, for-in / for-of expression target, delete), or null. */
export function writeTargetOf(n: ts.Node): ts.Node | null {
  if (isAssignment(n)) return n.left;
  if ((ts.isPrefixUnaryExpression(n) || ts.isPostfixUnaryExpression(n)) && (n.operator === ts.SyntaxKind.PlusPlusToken || n.operator === ts.SyntaxKind.MinusMinusToken)) return n.operand;
  if ((ts.isForInStatement(n) || ts.isForOfStatement(n)) && !ts.isVariableDeclarationList(n.initializer)) return n.initializer;
  if (ts.isDeleteExpression(n)) return n.expression;
  return null;
}

/** Identifiers written anywhere under `root` (shared walker for bindings and guard parameters). */
export function writtenIdentifiers(root: ts.Node): ts.Identifier[] {
  const out: ts.Identifier[] = [];
  walkAst(root, (n) => {
    walkAssignmentTarget(writeTargetOf(n) ?? undefined, (leaf) => {
      if (leaf.kind === "identifier") out.push(leaf.node);
    });
  });
  return out;
}

/** The declaration a value / type identifier is bound to in its file (null = free / ambient). */
function declarationOf(checker: ts.TypeChecker, id: ts.Identifier): ts.Declaration | null {
  const p = id.parent;
  const sym =
    ts.isShorthandPropertyAssignment(p) && p.name === id
      ? checker.getShorthandAssignmentValueSymbol(p)
      : ts.isExportSpecifier(p) && !p.parent.parent.moduleSpecifier
        ? checker.getExportSpecifierLocalTargetSymbol(p) // `export { h }` → the local binding it exports
        : checker.getSymbolAtLocation(id);
  return sym?.declarations?.[0] ?? null;
}

/** `import { <imported> } from "<module>"` (no alias) — the declaration of an import binding, or null. */
function importOf(decl: ts.Declaration | null): { module: string; imported: string; aliased: boolean } | null {
  if (!decl || !ts.isImportSpecifier(decl)) return null;
  const module = literalText(decl.parent.parent.parent.moduleSpecifier) ?? "";
  return { module, imported: (decl.propertyName ?? decl.name).text, aliased: decl.propertyName !== undefined };
}

/** Identifier in a position that names a property / type / label, not a value binding. */
function isNonValueName(id: ts.Identifier): boolean {
  const p = id.parent;
  if ((ts.isPropertyAccessExpression(p) || ts.isQualifiedName(p)) && (ts.isPropertyAccessExpression(p) ? p.name : p.right) === id) return true;
  if ((ts.isPropertyAssignment(p) || ts.isPropertySignature(p) || ts.isMethodDeclaration(p) || ts.isPropertyDeclaration(p) || ts.isMethodSignature(p) || ts.isGetAccessorDeclaration(p) || ts.isSetAccessorDeclaration(p) || ts.isEnumMember(p)) && p.name === id) return true;
  if ((ts.isBindingElement(p) || ts.isImportSpecifier(p) || ts.isExportSpecifier(p)) && p.propertyName === id) return true;
  if (ts.isJsxAttribute(p) || ts.isLabeledStatement(p) || ts.isBreakOrContinueStatement(p)) return true;
  if ((ts.isJsxOpeningElement(p) || ts.isJsxSelfClosingElement(p) || ts.isJsxClosingElement(p)) && p.tagName === id) return true;
  for (let c: ts.Node = id; c.parent; c = c.parent) {
    // `class X extends <expr>` is a value position; `implements` / interface heritage are types
    if (ts.isExpressionWithTypeArguments(c) && ts.isHeritageClause(c.parent) && c.parent.token === ts.SyntaxKind.ExtendsKeyword && ts.isClassLike(c.parent.parent)) return false;
    if (ts.isTypeNode(c) || ts.isInterfaceDeclaration(c) || ts.isTypeAliasDeclaration(c) || ts.isHeritageClause(c)) return true;
  }
  return false;
}

/**
 * The exact `checkRaster` guard of the canonical module: a top-level function whose first statement is
 * `if (!isVerifiedRaster(<p>)) throw …`, with `isVerifiedRaster` the unaliased import from "./raster.ts",
 * whose last statement is `return <p>`, and which never reassigns `<p>`.
 */
function isCanonicalCheckRaster(checker: ts.TypeChecker, fn: ts.Declaration | null, sf: ts.SourceFile): boolean {
  if (!fn || !ts.isFunctionDeclaration(fn) || fn.parent !== sf || fn.name?.text !== "checkRaster" || !fn.body) return false;
  const p = fn.parameters[0];
  if (!p || !ts.isIdentifier(p.name)) return false;
  const param = p.name.text;
  const st = fn.body.statements;
  const first = st[0];
  const last = st[st.length - 1];
  if (!first || !ts.isIfStatement(first) || !ts.isThrowStatement(first.thenStatement) || first.elseStatement) return false;
  const cond = first.expression;
  if (!ts.isPrefixUnaryExpression(cond) || cond.operator !== ts.SyntaxKind.ExclamationToken || !ts.isCallExpression(cond.operand)) return false;
  const call = cond.operand;
  if (!ts.isIdentifier(call.expression) || call.arguments.length !== 1 || !ts.isIdentifier(call.arguments[0] as ts.Node) || (call.arguments[0] as ts.Identifier).text !== param) return false;
  const brand = importOf(declarationOf(checker, call.expression));
  if (!brand || brand.module !== "./raster.ts" || brand.imported !== "isVerifiedRaster" || brand.aliased) return false;
  if (!last || !ts.isReturnStatement(last) || !last.expression || !ts.isIdentifier(last.expression) || last.expression.text !== param) return false;
  let reassigned = false;
  let returns = 0;
  let nestedFunction = false;
  walkAst(fn.body, (n) => {
    // any redeclaration of the parameter name inside the guard (var / let / const / catch / function / class)
    if ((ts.isVariableDeclaration(n) || ts.isBindingElement(n) || ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n)) && n.name && ts.isIdentifier(n.name) && n.name.text === param) reassigned = true;
    // the only return anywhere in the guard is the final `return <param>` (no early, conditional or nested return)
    if (ts.isReturnStatement(n)) returns += 1;
    if (ts.isFunctionLike(n)) nestedFunction = true;
  });
  // any write to the parameter: every assignment operator, ++ / --, destructuring, for-in / for-of target
  if (writtenIdentifiers(fn.body).some((id) => id.text === param)) reassigned = true;
  return !reassigned && returns === 1 && !nestedFunction;
}

/**
 * The exact helper with binding provenance (canonical module only): the shape below, where
 * `VerifiedRaster` is the unaliased import from "./raster.ts" and `checkRaster` is the canonical local guard.
 */
function isProvenRasterHelper(checker: ts.TypeChecker, fn: ts.Node, sf: ts.SourceFile): fn is ts.FunctionDeclaration {
  if (!isAllowedRasterHelper(fn) || fn.parent !== sf) return false;
  const type = (fn.parameters[0] as ts.ParameterDeclaration).type as ts.TypeReferenceNode;
  if (!ts.isIdentifier(type.typeName)) return false;
  const t = importOf(declarationOf(checker, type.typeName));
  if (!t || t.module !== "./raster.ts" || t.imported !== "VerifiedRaster" || t.aliased) return false;
  const ret = (fn.body?.statements[0] as ts.ReturnStatement).expression as ts.TemplateExpression;
  const call = ((ret.templateSpans[0] as ts.TemplateSpan).expression as ts.PropertyAccessExpression).expression as ts.CallExpression;
  return isCanonicalCheckRaster(checker, declarationOf(checker, call.expression as ts.Identifier), sf);
}

/**
 * AST raster-source check for TS/TSX. Rejects every `url(` / `image(` / `image-set(` in any string,
 * template or JSX text (interpolated or not) outside the exact allowed helper, image-loading elements
 * (JSX or h()/createElement/jsx("img", ...)), `new Image`, `src`-like attributes / properties /
 * assignments / setAttribute, and raster style properties whose value is not a helper call.
 *
 * Fail-closed rules (R4) — anything the guard cannot prove safe from the AST and its bindings is rejected:
 * - helper provenance: the helper counts only as the top-level declaration in the canonical module whose
 *   `VerifiedRaster` / `checkRaster` are the real bindings (isProvenRasterHelper); every other use of the
 *   name must be a direct call resolving to that declaration. Anything else is `raster-helper-binding`;
 * - element factories are capabilities: a binding imported from preact / react may only be called directly
 *   with a literal allowlisted intrinsic tag and static props; any alias, argument, return, export,
 *   member, bind / call / apply, comma or other indirect reference, namespace / default import,
 *   re-export, `cloneElement` and every reflective factory member is `opaque-element-tag` /
 *   `opaque-element-props`;
 * - JSX tags are allowlisted intrinsics or a top-level function declared in the same file;
 * - free identifiers must be allowlisted globals (and only allowlisted members of them):
 *   `unknown-global:<name>` / `unknown-global-member:<name>`;
 * - dynamic property names (computed keys, element-access writes / calls / deletes, setAttribute /
 *   setProperty / defineProperty names), object and JSX spreads, reflective members and string literals
 *   naming sources / sinks / factories are `opaque-property-name` / `opaque-object-spread` /
 *   `opaque-jsx-spread`.
 * Returns the number of allowed helpers as well (more than one per graph is a violation).
 */
export function rasterSourceViolations(file: string, src: string): { violations: string[]; helpers: number } {
  const { sf, checker } = analyze(file, src);
  const hits = new Set<string>();
  const canonical = isCanonicalPrimitiveModule(file);
  const allowed = new Set<ts.Node>();
  // bindings written anywhere in the file (=, compound / logical assignment, ++ / --, for-in / for-of
  // targets, destructuring): a function / class / import binding must never be one of them
  const mutated = new Set<ts.Declaration>();
  walkAst(sf, (n) => {
    const ids: ts.Identifier[] = [];
    walkAssignmentTarget(writeTargetOf(n) ?? undefined, (leaf) => {
      if (leaf.kind === "identifier") ids.push(leaf.node);
    });
    for (const id of ids) {
      const d = declarationOf(checker, id);
      if (d) mutated.add(d);
      if (d && (ts.isFunctionDeclaration(d) || ts.isClassDeclaration(d) || ts.isImportSpecifier(d) || ts.isImportClause(d) || ts.isNamespaceImport(d) || ts.isEnumDeclaration(d))) hits.add("binding-mutation");
    }
  });
  const helperDecls = sf.statements.filter((s): s is ts.FunctionDeclaration => canonical && isProvenRasterHelper(checker, s, sf) && !mutated.has(s));
  const helpers = helperDecls.length;
  for (const d of helperDecls) allowed.add((d.body?.statements[0] as ts.ReturnStatement).expression as ts.TemplateExpression);
  const helperDecl = helpers === 1 ? helperDecls[0] : undefined;
  /** A call whose callee resolves to the one proven helper declaration. */
  const isHelperCall = (n: ts.Node | undefined): boolean => {
    const u = unwrap(n);
    return helperDecl !== undefined && u !== undefined && ts.isCallExpression(u) && ts.isIdentifier(u.expression) && declarationOf(checker, u.expression) === helperDecl;
  };
  /** Import binding of an element factory from preact / react. */
  const factoryOf = (id: ts.Identifier): boolean => {
    const imp = importOf(declarationOf(checker, id));
    return imp !== null && UI_MODULE.test(imp.module) && ELEMENT_FACTORIES.has(imp.imported);
  };
  const staticProps = (n: ts.Node | undefined): boolean => {
    const p = unwrap(n);
    return p === undefined || p.kind === ts.SyntaxKind.NullKeyword || (ts.isObjectLiteralExpression(p) && p.properties.every((x) => ts.isPropertyAssignment(x) && !ts.isComputedPropertyName(x.name)));
  };
  /** A top-level `const X = Symbol.iterator` binding (the only symbol key the formal graph uses). */
  const isIteratorSymbol = (k: ts.Node | undefined): boolean => {
    const u = unwrap(k);
    const isSym = (e: ts.Node | undefined): boolean => !!e && ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.expression) && e.expression.text === "Symbol" && declarationOf(checker, e.expression) === null && e.name.text === "iterator";
    if (isSym(u)) return true;
    if (!u || !ts.isIdentifier(u)) return false;
    const d = declarationOf(checker, u);
    return !!d && ts.isVariableDeclaration(d) && !!(d.parent.flags & ts.NodeFlags.Const) && d.parent.parent.parent === sf && isSym(unwrap(d.initializer)) && !mutated.has(d);
  };
  /**
   * Verdict on a property key (element access, computed name, setter argument): a constant string is
   * checked against setter / dangerous / reflective names; otherwise only a numeric key, a union of safe
   * string-literal types, or the captured iterator symbol is provably safe. Anything else is opaque.
   */
  const keyVerdict = (k: ts.Node | undefined): "ok" | "setter" | "dangerous" | "opaque" => {
    const u = unwrap(k);
    if (!u) return "opaque";
    const s = constantString(u);
    const named = (x: string): "ok" | "setter" | "dangerous" => (SETTER_CAPABILITIES.has(x) ? "setter" : DANGEROUS_NAME.test(x) || REFLECTIVE_MEMBERS.has(x) || SOURCE_PROPS.test(x) || STYLE_RASTER_PROPS.test(x) ? "dangerous" : "ok");
    if (s !== null) return named(s);
    if (ts.isNumericLiteral(u) || isIteratorSymbol(u)) return "ok";
    const type = checker.getTypeAtLocation(u);
    if (type.flags & ts.TypeFlags.NumberLike) return "ok";
    const parts = type.isUnion() ? type.types : [type];
    if (parts.every((t) => t.isStringLiteral() || t.isNumberLiteral())) {
      for (const t of parts) if (t.isStringLiteral() && named(t.value) !== "ok") return named(t.value);
      return "ok";
    }
    return "opaque";
  };
  const keyHit = (k: ts.Node | undefined): void => {
    const v = keyVerdict(k);
    if (v === "setter") hits.add("setter-capability");
    else if (v !== "ok") hits.add("opaque-property-name");
  };
  for (const s of sf.statements) {
    if (ts.isImportDeclaration(s) && s.importClause && !s.importClause.isTypeOnly && UI_MODULE.test(literalText(s.moduleSpecifier) ?? "")) {
      const c = s.importClause;
      // a namespace / default import of preact / react hands every factory out reflectively
      if (c.name || (c.namedBindings && ts.isNamespaceImport(c.namedBindings))) hits.add("opaque-element-tag");
      if (c.namedBindings && ts.isNamedImports(c.namedBindings)) {
        for (const e of c.namedBindings.elements) if (!e.isTypeOnly && ELEMENT_FACTORIES.has((e.propertyName ?? e.name).text) && (e.propertyName || (e.propertyName ?? e.name).text === "cloneElement")) hits.add("opaque-element-tag");
      }
    }
    // re-exporting a factory (or a whole UI module) hands it to code the guard cannot follow
    if (ts.isExportDeclaration(s) && s.moduleSpecifier && UI_MODULE.test(literalText(s.moduleSpecifier) ?? "") && (!s.exportClause || !ts.isNamedExports(s.exportClause) || s.exportClause.elements.some((e) => ELEMENT_FACTORIES.has((e.propertyName ?? e.name).text)))) hits.add("opaque-element-tag");
  }
  walkAst(sf, (n) => {
    if (ts.isIdentifier(n) && !isNonValueName(n)) {
      const decl = declarationOf(checker, n);
      // helper provenance (R4-2)
      if (n.text === RASTER_URL_HELPER) {
        const isDecl = helperDecl !== undefined && helperDecl.name === n;
        const isCall = helperDecl !== undefined && decl === helperDecl && ts.isCallExpression(n.parent) && n.parent.expression === n;
        if (!isDecl && !isCall) hits.add("raster-helper-binding");
      }
      // factory capability (R4-3): only the import itself or a direct, literal-intrinsic, static-props call
      if (factoryOf(n) && !ts.isImportSpecifier(n.parent)) {
        const p = n.parent;
        const direct = ts.isCallExpression(p) && p.expression === n;
        const tag = direct ? literalText(p.arguments[0]) : null;
        if (!direct || tag === null || !INTRINSIC_ALLOW.has(tag)) hits.add("opaque-element-tag");
        else if (!staticProps(p.arguments[1]) || p.arguments.length > 2) hits.add("opaque-element-props");
      }
      // free identifiers must be allowlisted globals, and only allowlisted members of them
      if (decl === null && !ts.isImportSpecifier(n.parent)) {
        const allow = Object.hasOwn(GLOBAL_ALLOW, n.text) ? GLOBAL_ALLOW[n.text] : undefined;
        if (allow === undefined) hits.add(`unknown-global:${n.text}`);
        else if (allow !== "*") {
          // a restricted global is usable only as `G.<allowed member>`; a callable one may also be called /
          // constructed, be the right side of instanceof / a class `extends`, or be captured in a top-level
          // const. Any other use (alias of a namespace, argument, element access, spread, …) fails closed.
          const p = n.parent;
          const topLevelConst = ts.isVariableDeclaration(p) && p.initializer === n && !!(p.parent.flags & ts.NodeFlags.Const) && p.parent.parent.parent === sf;
          const callableUse = (ts.isCallExpression(p) || ts.isNewExpression(p)) && p.expression === n;
          const instanceofRight = ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword && p.right === n;
          const extendsClause = ts.isExpressionWithTypeArguments(p) && p.expression === n;
          if (ts.isPropertyAccessExpression(p) && p.expression === n) {
            if (!allow.has(p.name.text)) hits.add(`unknown-global-member:${n.text}.${p.name.text}`);
          } else if (!(CALLABLE_GLOBALS.has(n.text) && (topLevelConst || callableUse || instanceofRight || extendsClause))) hits.add(`unknown-global-member:${n.text}`);
        }
      }
    }
    if ((ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isPrivateIdentifier(n)) && n.text === RASTER_URL_HELPER && !ts.isIdentifier(n)) hits.add("raster-helper-binding");
    // setter capabilities: any identifier (member, binding, alias, shorthand) or string / template naming one
    if ((ts.isIdentifier(n) || ts.isPrivateIdentifier(n) || ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && SETTER_CAPABILITIES.has(n.text)) hits.add("setter-capability");
    // reflective members and string literals that name a source / sink / factory
    if (ts.isPropertyAccessExpression(n) && REFLECTIVE_MEMBERS.has(n.name.text)) hits.add("opaque-property-name");
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && DANGEROUS_NAME.test(n.text) && !ts.isImportDeclaration(n.parent) && !ts.isExportDeclaration(n.parent)) hits.add("opaque-property-name");
    // any factory-named member (document.createElement, x.h, P.h) outside a direct literal-intrinsic call
    if (ts.isPropertyAccessExpression(n) && ELEMENT_FACTORIES.has(n.name.text)) hits.add("opaque-element-tag");
    // HTML-string element creation is another way to build <img src> at runtime
    const htmlSink = /^(?:innerHTML|outerHTML|insertAdjacentHTML|dangerouslySetInnerHTML|srcdoc|createContextualFragment|parseFromString|write|writeln)$/u;
    if ((ts.isPropertyAccessExpression(n) && htmlSink.test(n.name.text)) || ((ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n) || ts.isJsxAttribute(n)) && htmlSink.test(propName(n.name) ?? ""))) hits.add("opaque-element-tag");
    // property names must be statically known
    if (ts.isCallExpression(n)) {
      const callee = unwrap(n.expression);
      const name = callee && ts.isIdentifier(callee) ? callee.text : callee && ts.isPropertyAccessExpression(callee) ? callee.name.text : null;
      if (name !== null && /^(?:setAttribute|setAttributeNS|setProperty|removeAttribute|defineProperty|defineProperties)$/u.test(name)) {
        const nameArg = name === "setAttributeNS" || name === "defineProperty" ? n.arguments[1] : n.arguments[0];
        if (name === "defineProperties" || keyVerdict(nameArg) !== "ok") hits.add("opaque-property-name");
      }
    }
    // every element access — read, write, call, alias — needs a provably safe key
    if (ts.isElementAccessExpression(n)) keyHit(n.argumentExpression);
    // every write target leaf (all assignment operators, ++ / --, destructuring, for-in / for-of, delete)
    walkAssignmentTarget(writeTargetOf(n) ?? undefined, (leaf) => {
      if (leaf.kind === "unknown") hits.add("opaque-assignment-target");
    });
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const t = n.tagName;
      const intrinsic = ts.isIdentifier(t) && /^[a-z]/u.test(t.text);
      const decl = ts.isIdentifier(t) && !intrinsic ? declarationOf(checker, t) : null;
      const localComponent = decl !== null && ts.isFunctionDeclaration(decl) && decl.parent === sf && !mutated.has(decl);
      if (intrinsic ? !INTRINSIC_ALLOW.has(t.text) : !localComponent) hits.add("opaque-element-tag");
    }
    if (ts.isJsxSpreadAttribute(n)) hits.add("opaque-jsx-spread");
    if (ts.isSpreadAssignment(n)) hits.add("opaque-object-spread");
    if (ts.isComputedPropertyName(n) && !ts.isTypeElement(n.parent)) keyHit(n.expression);
  });
  if (!canonical) {
    // an exact helper copy outside the canonical module is not allowed, so its template is a literal source
    for (const s of sf.statements) if (isAllowedRasterHelper(s)) hits.add("raster-helper-binding");
  }
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
        const viaHelper = /^background-?image$/iu.test(name) && isHelperCall(init);
        if (!viaHelper && !isPlainLiteral(init)) hits.add("literal-raster-source");
      }
    }
    if (ts.isComputedPropertyName(n)) {
      const t = literalText(n.expression);
      if (t !== null && (SOURCE_PROPS.test(t) || STYLE_RASTER_PROPS.test(t))) hits.add("literal-raster-source");
    }
    // every write leaf — any assignment operator, ++ / --, destructuring, for-in / for-of, delete — on a
    // source / raster-style property is rejected; only a direct (non-destructuring) plain `=` of a literal
    // (whose text is scanned above) is accepted for a style property
    const target = writeTargetOf(n);
    if (target) {
      const direct = unwrap(target);
      const plainLiteralSet = ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && isPlainLiteral(n.right);
      walkAssignmentTarget(target, (leaf) => {
        const name = leaf.kind === "property" ? leaf.node.name.text : leaf.kind === "element" ? constantString(leaf.node.argumentExpression) : null;
        if (name === null) return;
        const literalOk = plainLiteralSet && leaf.node === direct;
        if (SOURCE_PROPS.test(name) || (STYLE_RASTER_PROPS.test(name) && !literalOk)) hits.add("literal-raster-source");
      });
    }
  });
  if (helpers > 1) hits.add("duplicate-raster-url-helper");
  return { violations: [...hits], helpers };
}

/** Text families + raster sources. `file` decides CSS vs TS/TSX handling (default: TSX). */
export function scanFormalVisual(source: string, file = "x.tsx"): string[] {
  if (isStyle(file)) {
    const code = stripCssComments(source);
    const noImports = code.replace(/@import\b[^;]*;?/giu, "");
    return FORBIDDEN.filter((f) => f.pattern.test(f.css ? noImports : code)).map((f) => f.family);
  }
  const code = stripCodeComments(file, source);
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
  const code = stripCssComments(src);
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
/** The production files the helper's provenance is anchored to (not "any file with that name"). */
const CLIENT_SRC = resolve(import.meta.dirname, "../src");
export const REAL_PRIMITIVES = join(CLIENT_SRC, "ui", "ro", "primitives.tsx");
export const REAL_RASTER = join(CLIENT_SRC, "ui", "ro", "raster.ts");
export const REAL_MINT = join(CLIENT_SRC, "game", "formal", "rasterMint.ts");

/**
 * The real loader brand: `REAL_MINT` exports `isMintedRaster(x)` returning a `&&` chain that ends in
 * `mintedHas(x)`, where `mintedHas` is the top-level `const … = WeakSet.prototype.has.bind(minted)` and
 * `minted` the top-level `const minted = new WeakSet…()`.
 */
/** Reads a source file; `GuardSources` lets tests evaluate the anchored graph with in-memory replacements. */
export type GuardSources = ReadonlyMap<string, string>;
const reader = (sources?: GuardSources) => (file: string): string => sources?.get(resolve(file)) ?? readFileSync(file, "utf8");

function isRealMintModule(file: string, sources?: GuardSources): boolean {
  return resolve(file) === REAL_MINT && isFile(file) && isRealMintSource(file, reader(sources)(file));
}

/**
 * Content check of the loader brand (path-independent, so look-alike fixtures can be tested):
 * - exactly one exported top-level `isMintedRaster(<p>)` with one identifier parameter, whose body is a
 *   single `return` of a `&&` chain ending in `mintedHas(<p>)` — exactly one argument, that parameter;
 * - `mintedHas` is a top-level `const` initialised with `WeakSet.prototype.has.bind(<set>)`;
 * - `<set>` is a top-level `const` initialised with `new WeakSet()` / `new WeakSet<T>()` (no arguments);
 * - both `WeakSet` references are the ambient global (no local declaration shadows them), and neither
 *   `mintedHas` nor `<set>` is ever written.
 */
/**
 * The brand is added only on the real success path of `mintRasterSet`, pinned by exact AST shape:
 *
 *   let issued = null;                                       // top-level in mintRasterSet
 *   try {                                                    // top-level in mintRasterSet
 *     for (let i = 0; i < count; i += 1) {
 *       const it = prepared[i] …;                            // prepared: top-level const of mintRasterSet
 *       const url = createUrl(it.bytes);
 *       …
 *       issued = { handle: new Handle(it.assetId, it.width, it.height, it.entry, url), next: issued };
 *     }
 *   } catch (…) { … }
 *   const chain = issued;                                    // top-level in mintRasterSet
 *   for (let link = chain; link !== null; link = link.next) mintedAdd(link.handle);   // or { … } with only that
 *
 * - the add call's nearest function-like ancestor is mintRasterSet (no nested helper);
 * - every `link` resolves to the loop's own declaration, which is written only by its incrementor;
 * - `issued` is written exactly once, by that assignment; it is read only by `next: issued` and
 *   `const chain = issued` (no alias); `Handle` is the module's top-level class;
 * - no property named `handle` / `next` is ever written anywhere in the module.
 */
/**
 * The `Handle` class, locked by exact AST allowlist (anything else fails):
 *
 *   class Handle implements VerifiedRaster {               // no `extends`, no decorators
 *     readonly assetId: string; readonly width: number; readonly height: number;
 *     readonly entry: …; #url: string | null;              // no initialisers, nothing else
 *     constructor(assetId, width, height, entry, url) {    // five plain parameters (no parameter properties / defaults)
 *       this.assetId = assetId; this.width = width; this.height = height; this.entry = entry; this.#url = url;
 *       freeze(this);                                      // the captured Object.freeze
 *     }                                                    // → no return anywhere, no other statement
 *     get url() { if (this.#url === null) throw …; return this.#url; }
 *     get disposed() { return this.#url === null; }
 *     dispose() { if (this.#url === null) return; const u = this.#url; this.#url = null; revokeUrl(u); }
 *   }
 *   freeze(Handle.prototype); freeze(Handle);              // top-level
 *
 * and no write anywhere in the module targets `Handle` or anything reached through it.
 */
/** An arrow function with zero modifiers (in particular no `async`) and no type parameters. */
function isPlainArrowNode(n: ts.Node | undefined): n is ts.ArrowFunction {
  return !!n && ts.isArrowFunction(n) && (n.modifiers?.length ?? 0) === 0 && !n.typeParameters;
}
/** A parameter that is one plain identifier (no rest, default, `?`, modifiers or destructuring). */
function isPlainParamNode(p: ts.ParameterDeclaration | undefined): p is ts.ParameterDeclaration & { name: ts.Identifier } {
  return !!p && ts.isIdentifier(p.name) && !p.dotDotDotToken && !p.initializer && !p.questionToken && (ts.getModifiers(p)?.length ?? 0) === 0;
}

function isLockedHandleClass(checker: ts.TypeChecker, sf: ts.SourceFile, cls: ts.ClassDeclaration): boolean {
  const declOf = (e: ts.Node | undefined): ts.Declaration | null => (e && ts.isIdentifier(e) ? declarationOf(checker, e) : null);
  const moduleConstInit = (e: ts.Node | undefined, name: string): ts.Expression | undefined => {
    const d = declOf(e);
    return d && ts.isVariableDeclaration(d) && ts.isVariableDeclarationList(d.parent) && d.parent.declarations.length === 1 && !!(d.parent.flags & ts.NodeFlags.Const) && ts.isVariableStatement(d.parent.parent) && d.parent.parent.parent === sf && ts.isIdentifier(d.name) && d.name.text === name ? unwrap(d.initializer) as ts.Expression | undefined : undefined;
  };
  const ambientMember = (e: ts.Node | undefined, obj: string, member: string): boolean => !!e && ts.isPropertyAccessExpression(e) && e.name.text === member && ts.isIdentifier(e.expression) && e.expression.text === obj && declOf(e.expression) === null;
  const isFreeze = (e: ts.Node | undefined): boolean => ambientMember(moduleConstInit(e, "freeze"), "Object", "freeze");
  const isThis = (e: ts.Node | undefined): boolean => !!e && e.kind === ts.SyntaxKind.ThisKeyword;
  const isThisUrl = (e: ts.Node | undefined): boolean => !!e && ts.isPropertyAccessExpression(e) && isThis(e.expression) && ts.isPrivateIdentifier(e.name) && e.name.text === "#url";
  const isUrlNull = (e: ts.Node | undefined): boolean => !!e && ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken && isThisUrl(e.left) && e.right.kind === ts.SyntaxKind.NullKeyword;
  const exprStmt = (s: ts.Statement | undefined): ts.Expression | null => (s && ts.isExpressionStatement(s) ? s.expression : null);
  // class shape: no decorators / modifiers other than none, no extends, only `implements`
  if (ts.getDecorators(cls)?.length || cls.modifiers?.length || cls.typeParameters) return false;
  if ((cls.heritageClauses ?? []).some((h) => h.token !== ts.SyntaxKind.ImplementsKeyword)) return false;
  const fields = ["assetId", "width", "height", "entry"];
  const seen = new Set<string>();
  let ctor: ts.ConstructorDeclaration | undefined;
  let urlGetter: ts.GetAccessorDeclaration | undefined;
  let disposedGetter: ts.GetAccessorDeclaration | undefined;
  let dispose: ts.MethodDeclaration | undefined;
  for (const m of cls.members) {
    const mods = (ts.canHaveModifiers(m) ? ts.getModifiers(m) : undefined) ?? [];
    if (ts.canHaveDecorators(m) && ts.getDecorators(m)?.length) return false;
    if (ts.isPropertyDeclaration(m) && !m.initializer && !m.questionToken && !m.exclamationToken) {
      const name = ts.isIdentifier(m.name) ? m.name.text : ts.isPrivateIdentifier(m.name) ? m.name.text : null;
      const readonlyOnly = mods.length === 1 && mods[0]?.kind === ts.SyntaxKind.ReadonlyKeyword;
      if (name !== null && fields.includes(name) && readonlyOnly && !seen.has(name)) seen.add(name);
      else if (name === "#url" && mods.length === 0 && !seen.has(name)) seen.add(name);
      else return false;
    } else if (ts.isConstructorDeclaration(m) && !ctor && mods.length === 0) ctor = m;
    else if (ts.isGetAccessorDeclaration(m) && mods.length === 0 && ts.isIdentifier(m.name) && m.name.text === "url" && !urlGetter) urlGetter = m;
    else if (ts.isGetAccessorDeclaration(m) && mods.length === 0 && ts.isIdentifier(m.name) && m.name.text === "disposed" && !disposedGetter) disposedGetter = m;
    else if (ts.isMethodDeclaration(m) && mods.length === 0 && ts.isIdentifier(m.name) && m.name.text === "dispose" && !dispose && !m.asteriskToken && m.parameters.length === 0) dispose = m;
    else return false; // static members, static blocks, setters, other methods / fields, index signatures, …
  }
  if (seen.size !== 5 || !ctor?.body || !urlGetter?.body || !disposedGetter?.body || !dispose?.body) return false;
  // constructor: five plain parameters bound to the five fields, then freeze(this); nothing else, no return
  const params = ctor.parameters;
  if (params.length !== 5 || params.some((p) => !ts.isIdentifier(p.name) || p.initializer || p.dotDotDotToken || p.questionToken || (ts.getModifiers(p)?.length ?? 0) > 0)) return false;
  const st = ctor.body.statements;
  if (st.length !== 6) return false;
  const targets = [...fields, "#url"];
  for (let k = 0; k < 5; k += 1) {
    const e = exprStmt(st[k]);
    if (!e || !ts.isBinaryExpression(e) || e.operatorToken.kind !== ts.SyntaxKind.EqualsToken) return false;
    const l = e.left;
    const target = targets[k] as string;
    const okLeft = ts.isPropertyAccessExpression(l) && isThis(l.expression) && (target === "#url" ? ts.isPrivateIdentifier(l.name) && l.name.text === "#url" : ts.isIdentifier(l.name) && l.name.text === target);
    if (!okLeft || !ts.isIdentifier(e.right) || declOf(e.right) !== params[k]) return false;
  }
  const fr = exprStmt(st[5]);
  if (!fr || !ts.isCallExpression(fr) || fr.arguments.length !== 1 || !isThis(fr.arguments[0]) || !isFreeze(fr.expression)) return false;
  let ctorReturns = 0;
  walkAst(ctor.body, (n) => {
    if (ts.isReturnStatement(n) || ts.isFunctionLike(n) || ts.isClassLike(n)) ctorReturns += 1;
  });
  if (ctorReturns !== 0) return false;
  // get url(): if (this.#url === null) throw …; return this.#url;
  const us = urlGetter.body.statements;
  const g0 = us[0];
  const g1 = us[1];
  if (us.length !== 2 || !g0 || !ts.isIfStatement(g0) || !isUrlNull(g0.expression) || !ts.isThrowStatement(g0.thenStatement) || g0.elseStatement || !g1 || !ts.isReturnStatement(g1) || !isThisUrl(g1.expression)) return false;
  // the throw is exactly `new Error(\`raster ${this.assetId} was disposed\`)`: one ambient Error
  // construction, one template span bound to this.assetId — no write, call, comma or conditional
  const thrown = g0.thenStatement.expression;
  if (!ts.isNewExpression(thrown) || !ts.isIdentifier(thrown.expression) || thrown.expression.text !== "Error" || declOf(thrown.expression) !== null || thrown.typeArguments || thrown.arguments?.length !== 1) return false;
  const msg = thrown.arguments[0] as ts.Expression;
  if (!ts.isTemplateExpression(msg) || msg.head.text !== "raster " || msg.templateSpans.length !== 1) return false;
  const span = msg.templateSpans[0] as ts.TemplateSpan;
  if (span.literal.text !== " was disposed" || !ts.isPropertyAccessExpression(span.expression) || !isThis(span.expression.expression) || !ts.isIdentifier(span.expression.name) || span.expression.name.text !== "assetId") return false;
  let getterNested = false;
  walkAst(urlGetter.body, (n) => {
    if (ts.isFunctionLike(n) || ts.isClassLike(n)) getterNested = true;
  });
  if (getterNested) return false;
  // get disposed(): return this.#url === null;
  const ds = disposedGetter.body.statements;
  const d0 = ds[0];
  if (ds.length !== 1 || !d0 || !ts.isReturnStatement(d0) || !isUrlNull(d0.expression)) return false;
  // dispose(): if (this.#url === null) return; const u = this.#url; this.#url = null; revokeUrl(u);
  const xs = dispose.body.statements;
  const [x0, x1, x2, x3] = xs;
  if (xs.length !== 4 || !x0 || !ts.isIfStatement(x0) || !isUrlNull(x0.expression) || x0.elseStatement || !ts.isReturnStatement(x0.thenStatement) || x0.thenStatement.expression) return false;
  if (!x1 || !ts.isVariableStatement(x1) || x1.declarationList.declarations.length !== 1 || !(x1.declarationList.flags & ts.NodeFlags.Const)) return false;
  const uDecl = x1.declarationList.declarations[0] as ts.VariableDeclaration;
  if (!ts.isIdentifier(uDecl.name) || !isThisUrl(uDecl.initializer)) return false;
  const e2 = exprStmt(x2);
  if (!e2 || !ts.isBinaryExpression(e2) || e2.operatorToken.kind !== ts.SyntaxKind.EqualsToken || !isThisUrl(e2.left) || e2.right.kind !== ts.SyntaxKind.NullKeyword) return false;
  const e3 = exprStmt(x3);
  if (!e3 || !ts.isCallExpression(e3) || e3.arguments.length !== 1 || declOf(e3.arguments[0]) !== uDecl) return false;
  const revokeInit = moduleConstInit(e3.expression, "revokeUrl");
  // a plain arrow (no async / type parameters) with exactly one plain identifier parameter (no rest,
  // default, `?`, modifiers or destructuring) passed through unchanged
  if (!isPlainArrowNode(revokeInit) || revokeInit.parameters.length !== 1 || !isPlainParamNode(revokeInit.parameters[0])) return false;
  const rb = unwrap(revokeInit.body);
  if (!rb || !ts.isCallExpression(rb) || rb.arguments.length !== 1 || declOf(rb.arguments[0]) !== revokeInit.parameters[0] || !ambientMember(moduleConstInit(rb.expression, "urlRevoke"), "URL", "revokeObjectURL")) return false;
  // top-level freeze(Handle.prototype) and freeze(Handle)
  let protoFrozen = false;
  let classFrozen = false;
  for (const s of sf.statements) {
    const e = exprStmt(s);
    if (!e || !ts.isCallExpression(e) || e.arguments.length !== 1 || !isFreeze(e.expression)) continue;
    const a = e.arguments[0] as ts.Expression;
    if (ts.isIdentifier(a) && declOf(a) === cls) classFrozen = true;
    if (ts.isPropertyAccessExpression(a) && a.name.text === "prototype" && ts.isIdentifier(a.expression) && declOf(a.expression) === cls) protoFrozen = true;
  }
  if (!protoFrozen || !classFrozen) return false;
  // no write anywhere targets Handle or anything reached through it (Handle.prototype.x = …, etc.)
  let handleWrite = false;
  walkAst(sf, (n) => {
    walkAssignmentTarget(writeTargetOf(n) ?? undefined, (leaf) => {
      // the leaf's root, through member accesses and parentheses / `as` / `!` wrappers: any write to the
      // `Handle` binding itself (=, compound, logical, ++ / --, destructuring, for-in / for-of) or to
      // anything reached through it fails
      let root: ts.Node | undefined = leaf.node;
      for (;;) {
        root = unwrap(root);
        if (root && (ts.isPropertyAccessExpression(root) || ts.isElementAccessExpression(root))) root = root.expression;
        else break;
      }
      if (root && ts.isIdentifier(root) && declOf(root) === cls) handleWrite = true;
    });
  });
  return !handleWrite;
}

function isLockedIssuancePath(checker: ts.TypeChecker, sf: ts.SourceFile, mintFn: ts.FunctionDeclaration, call: ts.CallExpression): boolean {
  const body = mintFn.body;
  if (!body) return false;
  const declOf = (e: ts.Node | undefined): ts.Declaration | null => (e && ts.isIdentifier(e) ? declarationOf(checker, e) : null);
  const isTopOf = (d: ts.Node | null | undefined, kind: "let" | "const"): d is ts.VariableDeclaration =>
    !!d && ts.isVariableDeclaration(d) && ts.isVariableDeclarationList(d.parent) && ts.isVariableStatement(d.parent.parent) && d.parent.parent.parent === body && d.parent.declarations.length === 1 && !!(d.parent.flags & (kind === "let" ? ts.NodeFlags.Let : ts.NodeFlags.Const));
  // 1. nearest function-like ancestor is mintRasterSet
  let fnAncestor: ts.Node | undefined = call.parent;
  while (fnAncestor && !ts.isFunctionLike(fnAncestor)) fnAncestor = fnAncestor.parent;
  if (fnAncestor !== mintFn) return false;
  // 2. the call is the only body of the top-level `for (let link = chain; link !== null; link = link.next)`
  const stmt = call.parent;
  if (!ts.isExpressionStatement(stmt)) return false;
  const loop = ts.isBlock(stmt.parent) && stmt.parent.statements.length === 1 ? stmt.parent.parent : stmt.parent;
  if (!ts.isForStatement(loop) || (loop.statement !== stmt && loop.statement !== stmt.parent) || loop.parent !== body) return false;
  const init = loop.initializer;
  if (!init || !ts.isVariableDeclarationList(init) || !(init.flags & ts.NodeFlags.Let) || init.declarations.length !== 1) return false;
  const linkDecl = init.declarations[0] as ts.VariableDeclaration;
  if (!ts.isIdentifier(linkDecl.name) || linkDecl.name.text !== "link" || !linkDecl.initializer || !ts.isIdentifier(linkDecl.initializer)) return false;
  const isLink = (e: ts.Node | undefined): boolean => declOf(e) === linkDecl;
  const cond = loop.condition;
  if (!cond || !ts.isBinaryExpression(cond) || cond.operatorToken.kind !== ts.SyntaxKind.ExclamationEqualsEqualsToken || !isLink(cond.left) || cond.right.kind !== ts.SyntaxKind.NullKeyword) return false;
  const inc = loop.incrementor;
  if (!inc || !ts.isBinaryExpression(inc) || inc.operatorToken.kind !== ts.SyntaxKind.EqualsToken || !isLink(inc.left) || !ts.isPropertyAccessExpression(inc.right) || inc.right.name.text !== "next" || !isLink(inc.right.expression)) return false;
  const arg = call.arguments[0] as ts.Expression;
  if (!ts.isPropertyAccessExpression(arg) || arg.name.text !== "handle" || !isLink(arg.expression)) return false;
  if (writtenIdentifiers(loop).some((id) => isLink(id) && id !== inc.left)) return false;
  // 3. `chain` is the top-level `const chain = issued`
  const chainDecl = declOf(linkDecl.initializer);
  if (!isTopOf(chainDecl, "const") || !ts.isIdentifier(chainDecl.name) || chainDecl.name.text !== "chain" || !chainDecl.initializer || !ts.isIdentifier(chainDecl.initializer)) return false;
  const issuedDecl = declOf(chainDecl.initializer);
  if (!isTopOf(issuedDecl, "let") || !ts.isIdentifier(issuedDecl.name) || issuedDecl.name.text !== "issued" || !issuedDecl.initializer || issuedDecl.initializer.kind !== ts.SyntaxKind.NullKeyword) return false;
  // 4. the only write of `issued` is the success-path assignment of the exact shape
  const issuedRefs: ts.Identifier[] = [];
  walkAst(sf, (n) => {
    if (ts.isIdentifier(n) && n !== issuedDecl.name && declarationOf(checker, n) === issuedDecl) issuedRefs.push(n);
  });
  const writes = writtenIdentifiers(sf).filter((id) => declOf(id) === issuedDecl);
  if (writes.length !== 1) return false;
  const target = writes[0] as ts.Identifier;
  const assign = target.parent;
  if (!ts.isBinaryExpression(assign) || assign.left !== target || assign.operatorToken.kind !== ts.SyntaxKind.EqualsToken || !ts.isExpressionStatement(assign.parent)) return false;
  const obj = assign.right;
  if (!ts.isObjectLiteralExpression(obj) || obj.properties.length !== 2) return false;
  const [hp, np] = obj.properties as unknown as [ts.ObjectLiteralElementLike, ts.ObjectLiteralElementLike];
  if (!ts.isPropertyAssignment(hp) || !ts.isIdentifier(hp.name) || hp.name.text !== "handle" || !ts.isPropertyAssignment(np) || !ts.isIdentifier(np.name) || np.name.text !== "next") return false;
  if (!ts.isIdentifier(np.initializer) || declOf(np.initializer) !== issuedDecl) return false;
  const ctor = hp.initializer;
  if (!ts.isNewExpression(ctor) || !ts.isIdentifier(ctor.expression) || ctor.arguments?.length !== 5) return false;
  const handleClass = declOf(ctor.expression);
  if (!handleClass || !ts.isClassDeclaration(handleClass) || handleClass.parent !== sf || handleClass.name?.text !== "Handle" || !isLockedHandleClass(checker, sf, handleClass)) return false;
  // the assignment: directly in the body of a for loop that is the try block's only statement, in the
  // top-level try of mintRasterSet (no nested function)
  const forBody = assign.parent.parent;
  const issuanceLoop = ts.isBlock(forBody) ? forBody.parent : null;
  if (!issuanceLoop || !ts.isForStatement(issuanceLoop) || !ts.isBlock(issuanceLoop.parent) || issuanceLoop.parent.statements.length !== 1 || !ts.isTryStatement(issuanceLoop.parent.parent) || issuanceLoop.parent.parent.tryBlock !== issuanceLoop.parent || issuanceLoop.parent.parent.parent !== body) return false;
  const idxList = issuanceLoop.initializer;
  if (!idxList || !ts.isVariableDeclarationList(idxList) || idxList.declarations.length !== 1) return false;
  const idxDecl = idxList.declarations[0] as ts.VariableDeclaration;
  // Handle arguments: it.assetId, it.width, it.height, it.entry, url — `it` = prepared[<loop index>] and
  // url = createUrl(it.bytes), both consts of that loop body; prepared a top-level const of mintRasterSet
  const args = ctor.arguments;
  const itDecl = declOf(ts.isPropertyAccessExpression(args[0] as ts.Node) ? (args[0] as ts.PropertyAccessExpression).expression : undefined);
  if (!itDecl || !ts.isVariableDeclaration(itDecl) || itDecl.parent.parent.parent !== forBody || !(itDecl.parent.flags & ts.NodeFlags.Const)) return false;
  const names = ["assetId", "width", "height", "entry"];
  for (let k = 0; k < 4; k += 1) {
    const a = args[k] as ts.Expression;
    if (!ts.isPropertyAccessExpression(a) || a.name.text !== names[k] || declOf(a.expression) !== itDecl) return false;
  }
  const itInit = unwrap(itDecl.initializer);
  if (!itInit || !ts.isElementAccessExpression(itInit) || declOf(itInit.argumentExpression) !== idxDecl) return false;
  // prepared = freeze(list), list = makeArray(count, (i) => snapshot(…)): the frozen snapshots, never caller items
  const preparedDecl = declOf(itInit.expression);
  if (!isTopOf(preparedDecl, "const") || preparedDecl.name.getText() !== "prepared") return false;
  const pInit = unwrap(preparedDecl.initializer);
  const topFn = (e: ts.Node | undefined, name: string): boolean => {
    const d = declOf(e);
    return !!d && ts.isFunctionDeclaration(d) && d.parent === sf && d.name?.text === name;
  };
  /** A module-level `const <name> = <init>` (single declaration), resolved by identity. */
  const moduleConst = (d: ts.Declaration | null, name: string): d is ts.VariableDeclaration =>
    !!d && ts.isVariableDeclaration(d) && ts.isVariableDeclarationList(d.parent) && d.parent.declarations.length === 1 && !!(d.parent.flags & ts.NodeFlags.Const) && ts.isVariableStatement(d.parent.parent) && d.parent.parent.parent === sf && ts.isIdentifier(d.name) && d.name.text === name && !!d.initializer;
  /** The initializer of the module-level const `name` that `e` resolves to (by identity), unwrapped. */
  const moduleConstInit = (e: ts.Node | undefined, name: string): ts.Expression | undefined => {
    const d = declOf(e);
    return moduleConst(d, name) ? (unwrap(d.initializer) as ts.Expression | undefined) : undefined;
  };
  /** `<obj>.<member>` with `<obj>` the ambient (undeclared) global. */
  const ambientMember = (e: ts.Node | undefined, obj: string, member: string): boolean => !!e && ts.isPropertyAccessExpression(e) && e.name.text === member && ts.isIdentifier(e.expression) && e.expression.text === obj && declOf(e.expression) === null;
  /**
   * The module's own `const createUrl = (bytes) => urlCreate(new BlobCtor(ownIterable([bytes]) …, …))`,
   * with `urlCreate` = the captured ambient `URL.createObjectURL`, `BlobCtor` = the captured ambient `Blob`
   * and `ownIterable` the module's function — resolved by declaration, so a local shadow never qualifies.
   */
  function isRealCreateUrl(d: ts.Declaration | null): boolean {
    if (!moduleConst(d, "createUrl")) return false;
    const fn = unwrap(d.initializer);
    if (!isPlainArrow(fn) || fn.parameters.length !== 1) return false;
    const param = fn.parameters[0] as ts.ParameterDeclaration;
    // exactly one plain identifier parameter: no rest / default / optional / modifiers / destructuring
    if (!isPlainParam(param)) return false;
    const call = unwrap(fn.body);
    if (!call || !ts.isCallExpression(call) || call.arguments.length !== 1) return false;
    const urlCreateDecl = declOf(call.expression);
    if (!moduleConst(urlCreateDecl, "urlCreate")) return false;
    const uc = unwrap(urlCreateDecl.initializer);
    if (!uc || !ts.isPropertyAccessExpression(uc) || uc.name.text !== "createObjectURL" || !ts.isIdentifier(uc.expression) || uc.expression.text !== "URL" || declOf(uc.expression) !== null) return false;
    const blob = unwrap(call.arguments[0]);
    if (!blob || !ts.isNewExpression(blob) || !blob.arguments || blob.arguments.length !== 2) return false;
    const blobDecl = declOf(blob.expression);
    if (!moduleConst(blobDecl, "BlobCtor")) return false;
    const bc = unwrap(blobDecl.initializer);
    if (!bc || !ts.isIdentifier(bc) || bc.text !== "Blob" || declOf(bc) !== null) return false;
    const parts = unwrap(blob.arguments[0]);
    if (!parts || !ts.isCallExpression(parts) || !topFn(parts.expression, "ownIterable") || parts.arguments.length !== 1 || parts.typeArguments) return false;
    if (!isLockedOwnIterable(declOf(parts.expression))) return false;
    const arr = unwrap(parts.arguments[0]);
    if (!arr || !ts.isArrayLiteralExpression(arr) || arr.elements.length !== 1) return false;
    const only = arr.elements[0] as ts.Expression;
    if (!ts.isIdentifier(only) || declOf(only) !== param) return false;
    // Blob options are exactly the inert literal `{ type: "image/png" }`
    const opts = blob.arguments[1] as ts.Expression;
    if (!ts.isObjectLiteralExpression(opts) || opts.properties.length !== 1) return false;
    const tp = opts.properties[0] as ts.ObjectLiteralElementLike;
    return ts.isPropertyAssignment(tp) && ts.isIdentifier(tp.name) && tp.name.text === "type" && ts.isStringLiteral(tp.initializer) && tp.initializer.text === "image/png";
  }
  /** An arrow function with zero modifiers (in particular no `async`) and no type parameters. */
  function isPlainArrow(n: ts.Node | undefined): n is ts.ArrowFunction {
    return !!n && ts.isArrowFunction(n) && (n.modifiers?.length ?? 0) === 0 && !n.typeParameters;
  }
  /** A parameter that is one plain identifier (no rest, default, `?`, modifiers or destructuring). */
  function isPlainParam(p: ts.ParameterDeclaration | undefined): p is ts.ParameterDeclaration & { name: ts.Identifier } {
    return !!p && ts.isIdentifier(p.name) && !p.dotDotDotToken && !p.initializer && !p.questionToken && (ts.getModifiers(p)?.length ?? 0) === 0;
  }
  /**
   * The module's `ownIterable`, locked by exact AST (every binding by identity):
   *
   *   function ownIterable<T>(values: readonly T[]): Iterable<T> {
   *     const n = values.length;
   *     return { [ITERATOR]: () => { let i = 0; return { next: () => {
   *       if (i >= n) return { value: undefined, done: true };
   *       const value = values[i] as T; i += 1; return { value, done: false };
   *     } }; } } as Iterable<T>;
   *   }
   *
   * with `ITERATOR` the module-level `const ITERATOR = Symbol.iterator` (ambient Symbol), and the function
   * binding never written — so the Blob part is exactly the single verified byte array passed in.
   */
  function isLockedOwnIterable(d: ts.Declaration | null): boolean {
    if (!d || !ts.isFunctionDeclaration(d) || d.parent !== sf || !d.body || d.asteriskToken || d.modifiers?.length || d.parameters.length !== 1) return false;
    if (writtenIdentifiers(sf).some((id) => declOf(id) === d)) return false;
    const values = d.parameters[0];
    if (!isPlainParam(values)) return false;
    const isValues = (e: ts.Node | undefined): boolean => !!e && ts.isIdentifier(e) && declOf(e) === values;
    const [s0, s1] = d.body.statements;
    if (d.body.statements.length !== 2 || !s0 || !ts.isVariableStatement(s0) || !(s0.declarationList.flags & ts.NodeFlags.Const) || s0.declarationList.declarations.length !== 1) return false;
    const nDecl = s0.declarationList.declarations[0] as ts.VariableDeclaration;
    const nInit = nDecl.initializer;
    if (!ts.isIdentifier(nDecl.name) || !nInit || !ts.isPropertyAccessExpression(nInit) || nInit.name.text !== "length" || !isValues(nInit.expression)) return false;
    if (!s1 || !ts.isReturnStatement(s1)) return false;
    const outer = unwrap(s1.expression);
    if (!outer || !ts.isObjectLiteralExpression(outer) || outer.properties.length !== 1) return false;
    const ip = outer.properties[0] as ts.ObjectLiteralElementLike;
    if (!ts.isPropertyAssignment(ip) || !ts.isComputedPropertyName(ip.name) || !ts.isIdentifier(ip.name.expression)) return false;
    if (!ambientMember(moduleConstInit(ip.name.expression, "ITERATOR"), "Symbol", "iterator")) return false;
    const iterFn = ip.initializer;
    if (!isPlainArrow(iterFn) || iterFn.parameters.length !== 0 || !ts.isBlock(iterFn.body) || iterFn.body.statements.length !== 2) return false;
    const [t0, t1] = iterFn.body.statements;
    if (!t0 || !ts.isVariableStatement(t0) || !(t0.declarationList.flags & ts.NodeFlags.Let) || t0.declarationList.declarations.length !== 1) return false;
    const iDecl = t0.declarationList.declarations[0] as ts.VariableDeclaration;
    if (!ts.isIdentifier(iDecl.name) || !iDecl.initializer || !ts.isNumericLiteral(iDecl.initializer) || iDecl.initializer.text !== "0") return false;
    const isI = (e: ts.Node | undefined): boolean => !!e && ts.isIdentifier(e) && declOf(e) === iDecl;
    const isN = (e: ts.Node | undefined): boolean => !!e && ts.isIdentifier(e) && declOf(e) === nDecl;
    if (!t1 || !ts.isReturnStatement(t1) || !t1.expression || !ts.isObjectLiteralExpression(t1.expression) || t1.expression.properties.length !== 1) return false;
    const np = t1.expression.properties[0] as ts.ObjectLiteralElementLike;
    if (!ts.isPropertyAssignment(np) || !ts.isIdentifier(np.name) || np.name.text !== "next") return false;
    const nextFn = np.initializer;
    if (!isPlainArrow(nextFn) || nextFn.parameters.length !== 0 || !ts.isBlock(nextFn.body) || nextFn.body.statements.length !== 4) return false;
    const [u0, u1, u2, u3] = nextFn.body.statements;
    // if (i >= n) return { value: undefined, done: true };
    if (!u0 || !ts.isIfStatement(u0) || u0.elseStatement || !ts.isBinaryExpression(u0.expression) || u0.expression.operatorToken.kind !== ts.SyntaxKind.GreaterThanEqualsToken || !isI(u0.expression.left) || !isN(u0.expression.right)) return false;
    const doneRet = u0.thenStatement;
    const isResult = (e: ts.Node | undefined, value: (v: ts.Node) => boolean, done: ts.SyntaxKind): boolean => {
      if (!e || !ts.isObjectLiteralExpression(e) || e.properties.length !== 2) return false;
      const [pv, pd] = e.properties as unknown as [ts.ObjectLiteralElementLike, ts.ObjectLiteralElementLike];
      const vNode = ts.isPropertyAssignment(pv) && ts.isIdentifier(pv.name) && pv.name.text === "value" ? pv.initializer : ts.isShorthandPropertyAssignment(pv) && pv.name.text === "value" && !pv.objectAssignmentInitializer ? pv.name : null;
      return !!vNode && value(vNode) && ts.isPropertyAssignment(pd) && ts.isIdentifier(pd.name) && pd.name.text === "done" && pd.initializer.kind === done;
    };
    if (!ts.isReturnStatement(doneRet) || !isResult(doneRet.expression, (v) => ts.isIdentifier(v) && v.text === "undefined" && declOf(v) === null, ts.SyntaxKind.TrueKeyword)) return false;
    // const value = values[i] as T;
    if (!u1 || !ts.isVariableStatement(u1) || !(u1.declarationList.flags & ts.NodeFlags.Const) || u1.declarationList.declarations.length !== 1) return false;
    const vDecl = u1.declarationList.declarations[0] as ts.VariableDeclaration;
    const vInit = unwrap(vDecl.initializer);
    if (!ts.isIdentifier(vDecl.name) || !vInit || !ts.isElementAccessExpression(vInit) || !isValues(vInit.expression) || !isI(vInit.argumentExpression)) return false;
    // i += 1;
    const inc = u2 && ts.isExpressionStatement(u2) ? u2.expression : null;
    if (!inc || !ts.isBinaryExpression(inc) || inc.operatorToken.kind !== ts.SyntaxKind.PlusEqualsToken || !isI(inc.left) || !ts.isNumericLiteral(inc.right) || inc.right.text !== "1") return false;
    // return { value, done: false };
    if (!u3 || !ts.isReturnStatement(u3)) return false;
    // the shorthand `value` resolves to the const above via the shorthand value symbol
    return isResult(u3.expression, (v) => ts.isIdentifier(v) && declOf(v) === vDecl, ts.SyntaxKind.FalseKeyword);
  }
  const freezeDecl = pInit && ts.isCallExpression(pInit) && pInit.arguments.length === 1 ? declOf(pInit.expression) : null;
  const freezeInit = freezeDecl && ts.isVariableDeclaration(freezeDecl) && freezeDecl.parent.parent.parent === sf && freezeDecl.parent.flags & ts.NodeFlags.Const ? unwrap(freezeDecl.initializer) : undefined;
  if (!freezeInit || !ts.isPropertyAccessExpression(freezeInit) || freezeInit.name.text !== "freeze" || !ts.isIdentifier(freezeInit.expression) || freezeInit.expression.text !== "Object" || declOf(freezeInit.expression) !== null) return false;
  const listDecl = declOf((pInit as ts.CallExpression).arguments[0]);
  if (!isTopOf(listDecl, "const")) return false;
  const lInit = unwrap(listDecl.initializer);
  if (!lInit || !ts.isCallExpression(lInit) || !topFn(lInit.expression, "makeArray") || lInit.arguments.length !== 2) return false;
  const mapper = lInit.arguments[1] as ts.Expression;
  if (!ts.isArrowFunction(mapper) || !ts.isCallExpression(mapper.body) || !topFn(mapper.body.expression, "snapshot")) return false;
  if (writtenIdentifiers(sf).some((id) => {
    const d = declOf(id);
    return d === preparedDecl || d === listDecl;
  })) return false;
  const urlDecl = declOf(args[4]);
  if (!urlDecl || !ts.isVariableDeclaration(urlDecl) || urlDecl.parent.parent.parent !== forBody || !(urlDecl.parent.flags & ts.NodeFlags.Const)) return false;
  const urlInit = unwrap(urlDecl.initializer);
  if (!urlInit || !ts.isCallExpression(urlInit) || urlInit.arguments.length !== 1 || !isRealCreateUrl(declOf(urlInit.expression))) return false;
  const bytesArg = urlInit.arguments[0] as ts.Expression;
  if (!ts.isPropertyAccessExpression(bytesArg) || bytesArg.name.text !== "bytes" || declOf(bytesArg.expression) !== itDecl) return false;
  // reads of `issued`: only `next: issued` and `const chain = issued` (no alias)
  const reads = issuedRefs.filter((id) => id !== target);
  if (reads.length !== 2 || !reads.includes(np.initializer) || !reads.includes(chainDecl.initializer)) return false;
  // no property named handle / next is ever written in the module (aliases cannot repoint a link)
  let linkWrite = false;
  walkAst(sf, (n) => {
    walkAssignmentTarget(writeTargetOf(n) ?? undefined, (leaf) => {
      const name = leaf.kind === "property" ? leaf.node.name.text : leaf.kind === "element" ? constantString(leaf.node.argumentExpression) : null;
      if (name === "handle" || name === "next") linkWrite = true;
    });
  });
  return !linkWrite;
}

export function isRealMintSource(file: string, src: string): boolean {
  const { sf, checker } = analyze(file, src);
  const fns = sf.statements.filter((s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && s.name?.text === "isMintedRaster");
  const fn = fns[0];
  if (fns.length !== 1 || !fn?.body || !fn.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) || fn.parameters.length !== 1) return false;
  const param = (fn.parameters[0] as ts.ParameterDeclaration).name;
  if (!ts.isIdentifier(param) || fn.body.statements.length !== 1) return false;
  const ret = fn.body.statements[0] as ts.Statement;
  if (!ts.isReturnStatement(ret) || !ret.expression) return false;
  // the predicate is exactly the pure shape `typeof x === "object" && x !== null && mintedHas(x)`,
  // i.e. `((A && B) && C)` with no other conjunct, no parentheses, and every `x` the one parameter:
  // any call, assignment or update elsewhere in the predicate (e.g. `minted.add(x) && …`) is rejected
  const isParam = (e: ts.Node): boolean => ts.isIdentifier(e) && declarationOf(checker, e) === fn.parameters[0];
  const and = (e: ts.Node): e is ts.BinaryExpression => ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken;
  const top = ret.expression;
  if (!and(top) || !and(top.left)) return false;
  const a = top.left.left;
  const b = top.left.right;
  const tail = top.right;
  const isTypeofObject = ts.isBinaryExpression(a) && a.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken && ts.isTypeOfExpression(a.left) && isParam(a.left.expression) && ts.isStringLiteral(a.right) && a.right.text === "object";
  const isNotNull = ts.isBinaryExpression(b) && b.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken && isParam(b.left) && b.right.kind === ts.SyntaxKind.NullKeyword;
  if (!isTypeofObject || !isNotNull) return false;
  if (!ts.isCallExpression(tail) || !ts.isIdentifier(tail.expression) || tail.typeArguments || tail.questionDotToken || tail.arguments.length !== 1 || !isParam(tail.arguments[0] as ts.Node)) return false;
  const topConst = (d: ts.Declaration | null): d is ts.VariableDeclaration => !!d && ts.isVariableDeclaration(d) && d.parent.parent.parent === sf && !!(d.parent.flags & ts.NodeFlags.Const) && !!d.initializer;
  const ambientWeakSet = (e: ts.Node): boolean => ts.isIdentifier(e) && e.text === "WeakSet" && declarationOf(checker, e) === null;
  const hasDecl = declarationOf(checker, tail.expression);
  if (!topConst(hasDecl)) return false;
  const init = unwrap(hasDecl.initializer);
  // WeakSet.prototype.has.bind(<set>)
  if (!init || !ts.isCallExpression(init) || init.arguments.length !== 1) return false;
  const bind = init.expression;
  if (!ts.isPropertyAccessExpression(bind) || bind.name.text !== "bind") return false;
  const has = bind.expression;
  if (!ts.isPropertyAccessExpression(has) || has.name.text !== "has") return false;
  const proto = has.expression;
  if (!ts.isPropertyAccessExpression(proto) || proto.name.text !== "prototype" || !ambientWeakSet(proto.expression)) return false;
  const setArg = init.arguments[0] as ts.Expression;
  if (!ts.isIdentifier(setArg)) return false;
  const setDecl = declarationOf(checker, setArg);
  if (!topConst(setDecl)) return false;
  const ctor = unwrap(setDecl.initializer);
  if (!ctor || !ts.isNewExpression(ctor) || !ambientWeakSet(ctor.expression) || (ctor.arguments?.length ?? 0) !== 0) return false;
  // `WeakSet.prototype.<method>.bind(<the set>)` with an ambient WeakSet
  const isBoundFrom = (d: ts.VariableDeclaration, method: "has" | "add"): ts.Identifier | null => {
    const i = unwrap(d.initializer);
    if (!i || !ts.isCallExpression(i) || i.arguments.length !== 1 || i.typeArguments) return null;
    const bd = i.expression;
    if (!ts.isPropertyAccessExpression(bd) || bd.name.text !== "bind") return null;
    const m = bd.expression;
    if (!ts.isPropertyAccessExpression(m) || m.name.text !== method) return null;
    const pr = m.expression;
    if (!ts.isPropertyAccessExpression(pr) || pr.name.text !== "prototype" || !ambientWeakSet(pr.expression)) return null;
    const a0 = i.arguments[0] as ts.Expression;
    return ts.isIdentifier(a0) && declarationOf(checker, a0) === setDecl ? a0 : null;
  };
  // (1) mintedAdd: the one top-level const bound from the ambient WeakSet.prototype.add onto the same set
  const addDecls = sf.statements.flatMap((s) => (ts.isVariableStatement(s) ? [...s.declarationList.declarations] : [])).filter((d) => ts.isIdentifier(d.name) && d.name.text === "mintedAdd");
  const addDecl = addDecls[0];
  if (addDecls.length !== 1 || !addDecl || !topConst(addDecl)) return false;
  const hasSetRef = isBoundFrom(hasDecl, "has");
  const addSetRef = isBoundFrom(addDecl, "add");
  if (!hasSetRef || !addSetRef) return false;
  // references (identifiers resolving to a declaration, other than its own name)
  const refsTo = (d: ts.Declaration): ts.Identifier[] => {
    const out: ts.Identifier[] = [];
    walkAst(sf, (n) => {
      if (ts.isIdentifier(n) && n !== (d as ts.VariableDeclaration).name && declarationOf(checker, n) === d) out.push(n);
    });
    return out;
  };
  // (2) the set is referenced only by the has / add binds
  const setRefs = refsTo(setDecl);
  if (setRefs.length !== 2 || !setRefs.includes(hasSetRef) || !setRefs.includes(addSetRef)) return false;
  // (3) mintedAdd is used exactly once: the direct `mintedAdd(link.handle)` call inside the exported mintRasterSet
  const mintFns = sf.statements.filter((s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && s.name?.text === "mintRasterSet");
  const mintFn = mintFns[0];
  if (mintFns.length !== 1 || !mintFn?.body || !mintFn.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) return false;
  const addRefs = refsTo(addDecl);
  const only = addRefs[0];
  if (addRefs.length !== 1 || !only) return false;
  const call = only.parent;
  if (!ts.isCallExpression(call) || call.expression !== only || call.arguments.length !== 1 || call.typeArguments || call.questionDotToken) return false;
  if (!isLockedIssuancePath(checker, sf, mintFn, call)) return false;
  // (4) value exports: exactly the set {isMintedRaster, mintRasterSet, RasterIssuanceError} — none missing,
  // none extra; types (interfaces, type aliases, type-only exports) are fine
  const VALUE_EXPORTS = new Set(["isMintedRaster", "mintRasterSet", "RasterIssuanceError"]);
  const valueExports = new Set<string>();
  for (const s of sf.statements) {
    const exported = ts.canHaveModifiers(s) && ts.getModifiers(s)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (ts.isExportAssignment(s)) return false; // export default / export =
    if (ts.isExportDeclaration(s)) {
      if (s.isTypeOnly) continue;
      if (!s.exportClause || !ts.isNamedExports(s.exportClause)) return false; // export * / export * as ns
      for (const e of s.exportClause.elements) if (!e.isTypeOnly) return false; // any value re-export / alias
      continue;
    }
    if (!exported) continue;
    if (ts.getModifiers(s)?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) return false;
    if (ts.isInterfaceDeclaration(s) || ts.isTypeAliasDeclaration(s)) continue;
    if ((ts.isFunctionDeclaration(s) || ts.isClassDeclaration(s)) && s.name && VALUE_EXPORTS.has(s.name.text) && !valueExports.has(s.name.text)) {
      valueExports.add(s.name.text);
      continue;
    }
    return false; // exported variables, enums, other / duplicate functions or classes
  }
  if (valueExports.size !== VALUE_EXPORTS.size) return false;
  // neither binding is ever written
  return !writtenIdentifiers(sf).some((id) => {
    const d = declarationOf(checker, id);
    return d === hasDecl || d === setDecl || d === addDecl;
  });
}

/**
 * The real brand module: the file must be `REAL_RASTER` itself and define exactly
 * `export function isVerifiedRaster(x: unknown): x is VerifiedRaster { return isMintedRaster(x); }`,
 * with `isMintedRaster` the unaliased import that resolves to `REAL_MINT`, which is the real loader brand.
 * A look-alike tree anywhere else (nested `ui/ro`, a fake `game/formal/rasterMint.ts`) never qualifies.
 */
export function isRealBrandModule(file: string, sources?: GuardSources): boolean {
  if (resolve(file) !== REAL_RASTER || !isFile(file)) return false;
  const { sf, checker } = analyze(file, reader(sources)(file));
  const fns = sf.statements.filter((s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && s.name?.text === "isVerifiedRaster");
  const fn = fns[0];
  if (fns.length !== 1 || !fn?.body || fn.parameters.length !== 1 || !fn.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) return false;
  const p = fn.parameters[0] as ts.ParameterDeclaration;
  const st = fn.body.statements;
  if (!ts.isIdentifier(p.name) || st.length !== 1 || !ts.isReturnStatement(st[0] as ts.Statement)) return false;
  const e = (st[0] as ts.ReturnStatement).expression;
  if (!e || !ts.isCallExpression(e) || !ts.isIdentifier(e.expression) || e.arguments.length !== 1) return false;
  const arg = e.arguments[0] as ts.Expression;
  if (!ts.isIdentifier(arg) || arg.text !== p.name.text) return false;
  const imp = importOf(declarationOf(checker, e.expression));
  if (imp === null || imp.imported !== "isMintedRaster" || imp.aliased || !imp.module.startsWith(".")) return false;
  const target = resolveRelative(file, imp.module);
  return target !== null && isRealMintModule(target, sources);
}

export function guardGraph(entry: string, sources?: GuardSources): { file: string; violations: string[] }[] {
  const read = reader(sources);
  const files = moduleGraph(entry);
  let helpers = 0;
  const rows = files.map((file) => {
    const src = read(file);
    const violations = scanFormalVisual(src, file);
    const refs = specifiers(file, src);
    if (isCode(file)) {
      const h = rasterSourceViolations(file, src).helpers;
      helpers += h;
      // helper provenance across files: the brand check it relies on must be the real one
      // anchored: the helper must live in the real primitives file next to the real brand module
      if (h > 0 && (resolve(file) !== REAL_PRIMITIVES || !isRealBrandModule(join(dirname(file), "raster.ts"), sources))) violations.push("raster-brand-provenance");
      for (const spec of externalRuntimeImports(src, file)) if (!ALLOWED_EXTERNAL_RUNTIME.has(spec)) violations.push(`external-import:${spec}`);
      for (const o of refs.opaque) if (!violations.includes(o)) violations.push(o);
    }
    if (isStyle(file)) for (const { spec } of refs.specs) if (!spec.startsWith(".")) violations.push(`non-relative-css-import:${spec}`);
    for (const { spec } of refs.specs) if (spec.startsWith(".") && !resolveRelative(file, spec)) violations.push(`unresolved-import:${spec}`);
    return { file, violations };
  });
  if (helpers > 1) for (const r of rows) if (!r.violations.includes("duplicate-raster-url-helper") && rasterSourceViolations(r.file, read(r.file)).helpers > 0) r.violations.push("duplicate-raster-url-helper");
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
