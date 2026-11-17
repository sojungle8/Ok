import { z } from "zod";

/**
 * RO UI reference contracts (CLAUDE-PHASE1-RO-UI.md §3–§4). The manifest is produced on the
 * user's machine from the verified sources (never committed with pixels); the profile and metrics are
 * committed metadata whose measured values stay null until a local client capture provides them.
 */
const sha256 = z.string().regex(/^[0-9A-Fa-f]{64}$/u);
const nullableInt = z.number().int().nonnegative().nullable();

export const UI_REFERENCE_STATUS = ["DISCOVERED", "REVIEWED", "LOCKED"] as const;
export const REFERENCE_KIND = ["OBSERVED", "LOCAL-ORIGINAL"] as const;

export const uiManifestEntrySchema = z
  .object({
    logical_asset_id: z.string().regex(/^ui\.[a-z0-9_.]+$/u),
    source_container: z.enum(["data.grf", "rdata.grf", "filesystem:System"]),
    canonical_cp949_path: z.string().min(1),
    canonical_cp949_raw_hex: z.string().regex(/^(?:[0-9A-F]{2})*$/u),
    source_size: z.number().int().positive(),
    source_sha256: sha256,
    format: z.enum(["bmp", "spr", "act", "otf"]),
    native_width: nullableInt,
    native_height: nullableInt,
    role: z.enum(["frame", "button", "gauge", "slot", "icon", "cursor", "minimap", "chat", "tooltip", "font", "number"]),
    state: z.enum(["off", "on", "hover", "down", "disabled"]).nullable(),
    slice: z.object({ group: z.string(), part: z.enum(["left", "mid", "right"]) }).nullable(),
    nine_slice_insets_or_null: z.object({ top: z.number().int(), right: z.number().int(), bottom: z.number().int(), left: z.number().int() }).nullable(),
    cursor_hotspot_or_null: z.array(z.object({ action: z.number().int().nonnegative(), x: z.number().int(), y: z.number().int() })).nullable(),
    transparent_key_or_alpha_mode: z.enum(["magenta-key", "spr-palette-index0", "opaque", "not-applicable"]),
    reference_profile_id: z.string(),
  })
  .superRefine((e, ctx) => {
    if (e.format === "bmp" && (e.native_width === null || e.native_height === null)) ctx.addIssue({ code: "custom", message: "bitmaps need native dimensions" });
    const insets = e.nine_slice_insets_or_null;
    if (insets && e.native_width !== null && e.native_height !== null && (insets.left + insets.right >= e.native_width || insets.top + insets.bottom >= e.native_height)) {
      ctx.addIssue({ code: "custom", message: "nine-slice insets exceed native dimensions" });
    }
    if (e.role === "cursor" && e.format === "act" && (e.cursor_hotspot_or_null?.length ?? 0) === 0) ctx.addIssue({ code: "custom", message: "cursor ACT needs hotspots" });
  });
export type UiManifestEntry = z.infer<typeof uiManifestEntrySchema>;

export const uiManifestSchema = z.object({
  schemaVersion: z.literal(1),
  profileId: z.string(),
  lockId: z.string(),
  whitelistSha256: sha256,
  entries: z.array(uiManifestEntrySchema),
});
export type UiManifest = z.infer<typeof uiManifestSchema>;

const COMPONENTS = ["BasicInfo", "Shortcut", "MiniMap", "Chat", "Cursor", "CommonWindow", "Button", "Tooltip", "Status", "Inventory", "Skill", "PauseMessageBox", "Font"] as const;
export const UI_PROFILE_COMPONENTS = COMPONENTS;

export const uiReferenceProfileSchema = z.object({
  profile_id: z.string(),
  status: z.enum(UI_REFERENCE_STATUS),
  client_build_identifier: z.object({ lockId: z.string(), dataGrfSha256: sha256, rdataGrfSha256: sha256 }),
  skin_name: z.string(),
  source_container_priority: z.array(z.enum(["rdata.grf", "data.grf", "filesystem:System"])).min(1),
  capture_date: z.string().nullable(),
  capture_viewport: z.object({ width: z.number().int().positive(), height: z.number().int().positive() }).nullable(),
  capture_dpi_scale: z.number().positive().nullable(),
  locale_codepage: z.string(),
  component_version_map: z.record(
    z.enum(COMPONENTS),
    z.object({
      version: z.string(),
      reference_kind: z.enum(REFERENCE_KIND),
      assetIds: z.array(z.string()),
      /** Why an empty or shared asset list is acceptable, or what is still undecided. */
      note: z.string(),
    }),
  ),
  undecided: z.array(z.object({ id: z.string(), question: z.string(), options: z.array(z.string()).min(2) })),
});
export type UiReferenceProfile = z.infer<typeof uiReferenceProfileSchema>;

const rect = z.object({ x: nullableInt, y: nullableInt, w: nullableInt, h: nullableInt });
export const uiReferenceMetricsSchema = z.object({
  profileId: z.string(),
  /** DEFERRED_LOCAL until a capture of the local client at the fixed viewport exists. */
  measurement: z.enum(["DEFERRED_LOCAL", "MEASURED"]),
  captureSha256: z.array(sha256),
  desktop1024x768: z.object({
    basicInfoExpanded: rect,
    basicInfoMinimized: rect,
    shortcut: z.object({ x: nullableInt, y: nullableInt, w: nullableInt, rowHeight: nullableInt, slots: z.literal(9) }),
    miniMap: z.object({ right: nullableInt, top: nullableInt, w: nullableInt, h: nullableInt }),
    chat: z.object({ left: nullableInt, bottom: nullableInt, w: nullableInt, collapsedH: nullableInt, expandedH: nullableInt }),
  }),
  font: z.object({ family: z.string().nullable(), sizePx: nullableInt, lineHeightPx: nullableInt, weight: nullableInt, outlineOrShadow: z.string().nullable() }),
  /** Search hints only (roBrowserLegacy V0 research); never formal target values. */
  researchHints: z.array(z.object({ component: z.string(), value: z.string(), status: z.literal("HINT_NOT_TARGET") })),
}).superRefine((m, ctx) => {
  if (m.measurement !== "MEASURED") return;
  const hasNull = (v: unknown): boolean => v === null || (typeof v === "object" && v !== null && Object.values(v).some(hasNull));
  if (m.captureSha256.length === 0) ctx.addIssue({ code: "custom", message: "MEASURED metrics must cite capture SHA-256" });
  if (hasNull(m.desktop1024x768) || hasNull(m.font)) ctx.addIssue({ code: "custom", message: "MEASURED metrics cannot contain null values" });
});
export type UiReferenceMetrics = z.infer<typeof uiReferenceMetricsSchema>;

/** Identity carried by every derived UI file (UI-B1): converter, profile, verified lock, canonical whitelist, entry set. */
const derivedUiIdentity = {
  converterVersion: z.number().int(),
  profileId: z.string(),
  lockId: z.string().min(1),
  whitelistSha256: sha256,
  entrySetSha256: sha256,
};
const derivedImage = z.object({ file: z.string(), sha256, width: z.number().int().positive(), height: z.number().int().positive() });

export const derivedUiBitmapSchema = z.object({
  ...derivedUiIdentity,
  entry: uiManifestEntrySchema,
  derived: derivedImage,
  filter: z.literal("nearest"),
});
export type DerivedUiBitmap = z.infer<typeof derivedUiBitmapSchema>;

export const derivedCursorSprSchema = derivedUiBitmapSchema.extend({
  frames: z.array(z.object({ x: z.number().int().nonnegative(), y: z.number().int().nonnegative(), w: z.number().int().positive(), h: z.number().int().positive(), type: z.enum(["indexed", "rgba"]), index: z.number().int().nonnegative() })),
});
export type DerivedCursorSpr = z.infer<typeof derivedCursorSprSchema>;

const actLayer = z.object({
  x: z.number(), y: z.number(), sprIndex: z.number().int(), mirror: z.boolean(),
  color: z.tuple([z.number(), z.number(), z.number(), z.number()]), scaleX: z.number(), scaleY: z.number(), rotation: z.number(),
  sprType: z.enum(["indexed", "rgba"]), width: z.number().int().nullable(), height: z.number().int().nullable(),
});
export const derivedCursorActSchema = z.object({
  ...derivedUiIdentity,
  entry: uiManifestEntrySchema,
  actVersion: z.string(),
  actions: z.array(z.object({ delay: z.number(), frames: z.array(z.object({ layers: z.array(actLayer), soundIndex: z.number().int(), anchors: z.array(z.object({ x: z.number(), y: z.number(), attr: z.number() })) })) })),
  sounds: z.array(z.string()),
  hotspots: z.array(z.object({ action: z.number().int().nonnegative(), x: z.number().int(), y: z.number().int() })),
});
export type DerivedCursorAct = z.infer<typeof derivedCursorActSchema>;
