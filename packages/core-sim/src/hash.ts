/**
 * Canonical state hash: FNV-1a 64-bit (as two 32-bit lanes) over a canonical, key-sorted
 * serialization. Floats are rejected so hashes cannot drift across platforms.
 */
export type HashValue = number | string | boolean | null | readonly HashValue[] | { readonly [k: string]: HashValue };

function canonical(value: HashValue, path: string): string {
  if (value === null) return "n";
  if (typeof value === "boolean") return value ? "t" : "f";
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new TypeError(`state hash only accepts safe integers (at ${path}): ${value}`);
    return `i${value};`;
  }
  if (typeof value === "string") return `s${value.length}:${value}`;
  if (Array.isArray(value)) {
    return `[${(value as readonly HashValue[]).map((v, i) => canonical(v, `${path}[${i}]`)).join(",")}]`;
  }
  const obj = value as { readonly [k: string]: HashValue };
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${k}=${canonical(obj[k] as HashValue, `${path}.${k}`)}`).join(",")}}`;
}

export function hashState(value: HashValue): string {
  const text = canonical(value, "$");
  let h1 = 0x84222325;
  let h2 = 0xcbf29ce4;
  for (let i = 0; i < text.length; i += 1) {
    h1 ^= text.charCodeAt(i);
    // 64-bit multiply by FNV prime 0x100000001b3 split into lanes.
    const lo = Math.imul(h1, 0x1b3);
    const carry = Math.floor(((h1 >>> 0) * 0x1b3) / 0x100000000);
    const hi = (Math.imul(h2, 0x1b3) + Math.imul(h1, 0x100) + carry) >>> 0;
    h1 = lo >>> 0;
    h2 = hi;
  }
  return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
}
