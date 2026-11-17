import { z } from "zod";

/** Columns of docs/product-plan/handoff/fan-local-asset-whitelist.csv (header order matters). */
export const WHITELIST_COLUMNS = [
  "asset_id",
  "category",
  "source_container",
  "canonical_cp949_path",
  "normalized_request_path",
  "raw_name_hex",
  "bytes",
  "sha256",
  "source_id",
  "source_key",
  "act_version",
  "act_actions",
  "required",
  "rdata_override",
  "notes",
] as const;

export const SOURCE_CONTAINERS = ["data.grf", "rdata.grf", "filesystem:BGM", "filesystem:System"] as const;
export type SourceContainer = (typeof SOURCE_CONTAINERS)[number];

/** Filesystem containers are read from an exact pinned-file allowlist, never from an arbitrary path. */
export const isFilesystemContainer = (c: string): boolean => c.startsWith("filesystem:");

const hex64 = z.string().regex(/^[0-9a-fA-F]{64}$/u);

export const whitelistRowSchema = z
  .object({
    asset_id: z.string().regex(/^[a-z0-9_]+(?:\.[a-z0-9_]+)+$/u),
    category: z.string().min(1),
    source_container: z.enum(SOURCE_CONTAINERS),
    canonical_cp949_path: z.string().min(1),
    normalized_request_path: z.string().startsWith("/"),
    // Canonical CSVs carry either case (v2 rows upper, RO UI rows lower); lookups use upper case.
    raw_name_hex: z.string().regex(/^(?:[0-9A-Fa-f]{2})*$/u).transform((h) => h.toUpperCase()),
    bytes: z.coerce.number().int().positive(),
    sha256: z.union([z.literal(""), hex64]),
    source_id: z.string(),
    source_key: z.string(),
    act_version: z.union([z.literal(""), z.string().regex(/^\d+\.\d+$/u)]),
    act_actions: z.union([z.literal(""), z.string().regex(/^\d+$/u)]),
    required: z.enum(["true", "false"]),
    rdata_override: z.enum(["true", "false"]),
    notes: z.string(),
  })
  .superRefine((row, ctx) => {
    const fromGrf = !isFilesystemContainer(row.source_container);
    if (fromGrf && row.raw_name_hex === "") {
      ctx.addIssue({ code: "custom", message: "GRF entries must carry raw_name_hex", path: ["raw_name_hex"] });
    }
    if (row.canonical_cp949_path.includes("..") || row.normalized_request_path.includes("..")) {
      ctx.addIssue({ code: "custom", message: "path traversal is not allowed", path: ["canonical_cp949_path"] });
    }
  });

export type WhitelistRow = z.infer<typeof whitelistRowSchema>;
