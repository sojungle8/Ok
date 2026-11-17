/**
 * Canonical GRF/BGM path (backslash separated, as stored in the archive) <-> normalized request URI
 * (forward slashes, leading slash, each segment percent-encoded as UTF-8).
 */
export function canonicalPathToRequestUri(canonical: string): string {
  const segments = canonical.split("\\");
  for (const seg of segments) {
    if (seg === "" || seg === "." || seg === "..") throw new Error(`invalid path segment in ${JSON.stringify(canonical)}`);
  }
  return "/" + segments.map((s) => encodeURIComponent(s)).join("/");
}

export function requestUriToCanonicalPath(uri: string): string {
  if (!uri.startsWith("/")) throw new Error("request URI must start with '/'");
  const segments = uri.slice(1).split("/").map((s) => decodeURIComponent(s));
  for (const seg of segments) {
    if (seg === "" || seg === "." || seg === ".." || seg.includes("\\")) {
      throw new Error(`invalid request URI segment in ${JSON.stringify(uri)}`);
    }
  }
  return segments.join("\\");
}
