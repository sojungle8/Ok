import { z } from "zod";

const sha256Upper = z.string().regex(/^[0-9A-F]{64}$/u, "SHA-256 must be 64 uppercase hex characters");

export const SOURCE_IDS = ["data.grf", "rdata.grf", "bgm"] as const;
export type SourceId = (typeof SOURCE_IDS)[number];

/**
 * Committed lock: expected source fingerprints only. It must never contain absolute paths.
 * Absolute paths live in the ignored `assets/source-lock.local.json` and `.env.local`.
 */
export const sourceLockExampleSchema = z.object({
  schemaVersion: z.literal(1),
  lockId: z.string().min(1),
  pathEncoding: z.literal("cp949"),
  sources: z.object({
    "data.grf": z.object({ bytes: z.number().int().positive(), sha256: sha256Upper, envVar: z.literal("RO_ASSET_SOURCE_DATA_GRF") }),
    "rdata.grf": z.object({ bytes: z.number().int().positive(), sha256: sha256Upper, envVar: z.literal("RO_ASSET_SOURCE_RDATA_GRF") }),
    bgm: z.object({
      envVar: z.literal("RO_ASSET_BGM_DIR"),
      expectedFileCount: z.number().int().positive(),
      pinnedFiles: z.record(z.string(), z.object({ bytes: z.number().int().positive(), sha256: sha256Upper })),
    }),
  }),
});
export type SourceLockExample = z.infer<typeof sourceLockExampleSchema>;

export const sourceLockLocalSchema = z.object({
  schemaVersion: z.literal(1),
  lockId: z.string(),
  scannedAt: z.string(),
  pathEncoding: z.literal("cp949"),
  tool: z.string(),
  sources: z.object({
    "data.grf": z.object({ path: z.string(), bytes: z.number(), sha256: sha256Upper }),
    "rdata.grf": z.object({ path: z.string(), bytes: z.number(), sha256: sha256Upper }),
    bgm: z.object({
      path: z.string(),
      fileCount: z.number(),
      manifestSha256: sha256Upper,
      files: z.array(z.object({ name: z.string(), bytes: z.number(), sha256: sha256Upper })),
    }),
  }),
});
export type SourceLockLocal = z.infer<typeof sourceLockLocalSchema>;

/** A string looks like an absolute filesystem path (POSIX, Windows drive or UNC). */
export function looksLikeAbsolutePath(value: string): boolean {
  return /^(?:[A-Za-z]:[\\/]|\\\\|\/(?!\/))/u.test(value);
}
