import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

/** Streaming SHA-256 (uppercase hex); opens the file read-only and never writes to it. */
export async function sha256File(path: string): Promise<{ sha256: string; bytes: number }> {
  const hash = createHash("sha256");
  let bytes = 0;
  const stream = createReadStream(path, { flags: "r", highWaterMark: 4 * 1024 * 1024 });
  for await (const chunk of stream) {
    const buf = chunk as Buffer;
    bytes += buf.length;
    hash.update(buf);
  }
  return { sha256: hash.digest("hex").toUpperCase(), bytes };
}

export function sha256Text(text: string | Uint8Array): string {
  return createHash("sha256").update(text).digest("hex").toUpperCase();
}
