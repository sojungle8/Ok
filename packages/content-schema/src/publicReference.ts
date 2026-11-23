import { z } from "zod";

const SHA256_UPPER = z.string().regex(/^[0-9A-F]{64}$/u, "SHA-256 must be 64 uppercase hex characters");
const ID = z.string().regex(/^[a-z0-9][a-z0-9.-]{2,127}$/u);
const OBSERVATION_ID = z.string().regex(/^OBS-[0-9]{8}-[A-Z0-9-]+$/u);
const TEST_ID = z.string().regex(/^QA-[A-Z0-9-]+$/u);
const DATE_PATTERN = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/u;
const OFFSET_DATETIME_PATTERN = /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\.[0-9]+)?(Z|([+-])([0-9]{2}):([0-9]{2}))$/u;

function isValidCalendarDate(yearText: string, monthText: string, dayText: string): boolean {
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!Number.isInteger(year) || year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;
  return day <= (days[month - 1] ?? 0);
}

function isValidDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  return match !== null && isValidCalendarDate(match[1] ?? "", match[2] ?? "", match[3] ?? "");
}

function isValidOffsetDateTime(value: string): boolean {
  const match = OFFSET_DATETIME_PATTERN.exec(value);
  if (match === null || !isValidCalendarDate(match[1] ?? "", match[2] ?? "", match[3] ?? "")) return false;
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (hour > 23 || minute > 59 || second > 59) return false;
  if (match[7] === "Z") return true;
  const offsetHour = Number(match[9]);
  const offsetMinute = Number(match[10]);
  return offsetHour <= 14 && offsetMinute <= 59 && (offsetHour < 14 || offsetMinute === 0);
}

const OFFSET_DATETIME = z.string().regex(
  OFFSET_DATETIME_PATTERN,
  "timestamp must include a UTC offset",
).refine(isValidOffsetDateTime, "timestamp must be a real calendar date and time with a valid UTC offset");
const DATE_OR_OFFSET_DATETIME = z.union([
  z.string().regex(DATE_PATTERN).refine(isValidDate, "date must be a real calendar date"),
  OFFSET_DATETIME,
]);

function isAllowedPublicUrl(
  value: string,
  variant: "official" | "hans",
  sourceType: "site" | "legal" | "credits" | "manifest" | "news" | "notice" | "status",
): boolean {
  const origins = variant === "official"
    ? ["https://ro-survivors.com", "https://www.ro-survivors.com"]
    : ["https://ro.hans-webgametw.com"];
  const paths = sourceType === "site" ? ["/"]
    : sourceType === "legal" ? ["/legal.html"]
      : sourceType === "credits" ? ["/credits.html"]
        : sourceType === "manifest" ? ["/app-manifest.json"]
          : sourceType === "news" && variant === "hans" ? ["/hans-news.json"]
            : sourceType === "notice" && variant === "hans" ? ["/api/notice"]
              : sourceType === "status" ? ["/status.json", ...(variant === "hans" ? ["/api/guest-status"] : [])]
                : [];
  return origins.some((origin) => paths.some((path) => value === `${origin}${path}`));
}

const SAFE_SUMMARY = z.string().min(1).max(240).refine(
  (value) => !/[\r\n<>]/u.test(value)
    && !/(?:```|https?:\/\/|javascript:|source[ -]?map|javascript bundle|\.m?js\b|\beval\s*\(|\bfunction\b|=>)/iu.test(value),
  "summary must be a short, independently written plain-text observation",
);
const REPO_OVERLAY_PATH = z.string()
  .regex(/^content\/overlays\/[a-z0-9][a-z0-9/_.-]*\.json$/u)
  .refine((value) => value.split("/").every((segment) => segment !== "" && segment !== "." && segment !== ".."), "overlay path must not contain empty or dot segments");

export const PUBLIC_VARIANTS = ["official", "hans"] as const;
export const PUBLIC_SOURCE_TYPES = ["site", "legal", "credits", "manifest", "news", "notice", "status"] as const;
export const PUBLIC_AUTHORITIES = ["primary", "author-post", "secondary"] as const;
export const REFERENCE_ACTIONS = ["watch", "adapt", "adopt", "reject", "test", "defer"] as const;
export const REFERENCE_STATUSES = ["proposed", "accepted", "superseded"] as const;

export const publicSourceSchema = z.strictObject({
  sourceId: ID,
  variant: z.enum(PUBLIC_VARIANTS),
  sourceType: z.enum(PUBLIC_SOURCE_TYPES),
  url: z.string().max(512),
  observedAt: OFFSET_DATETIME,
  publishedAt: DATE_OR_OFFSET_DATETIME.optional(),
  versionLabel: z.string().min(1).max(80).optional(),
  locale: z.string().min(1).max(32),
  httpStatus: z.number().int().min(100).max(599),
  etag: z.string().min(1).max(256).optional(),
  lastModified: z.string().min(1).max(128).optional(),
  contentBytesUtf8: z.number().int().positive(),
  contentSha256: SHA256_UPPER,
  authority: z.enum(PUBLIC_AUTHORITIES),
}).superRefine((source, ctx) => {
  if (!isAllowedPublicUrl(source.url, source.variant, source.sourceType)) {
    ctx.addIssue({ code: "custom", path: ["url"], message: "URL must be an allowlisted public page without credentials, query, fragment, bundle or source map" });
  }
});
export type PublicSource = z.infer<typeof publicSourceSchema>;

export const ANNOUNCEMENT_CATEGORIES = [
  "content", "balance", "performance", "mobile", "account", "persistence", "social", "multiplayer", "economy", "mail", "bugfix",
] as const;

export const announcementObservationSchema = z.strictObject({
  announcementId: ID,
  sourceId: ID,
  sourceVersion: z.string().min(1).max(80).optional(),
  revision: z.number().int().nonnegative().optional(),
  titleSummary: SAFE_SUMMARY,
  factSummaries: z.array(SAFE_SUMMARY).min(1).max(20),
  categories: z.array(z.enum(ANNOUNCEMENT_CATEGORIES)).min(1).max(12),
  confidence: z.enum(["observed", "reported", "inferred"]),
  copyrightClass: z.enum(["fact", "idea", "text-do-not-copy", "code-do-not-copy"]),
  supersedesObservationIds: z.array(OBSERVATION_ID).max(20),
});
export type AnnouncementObservation = z.infer<typeof announcementObservationSchema>;

export const designDecisionLinkSchema = z.strictObject({
  candidateId: ID,
  observationIds: z.array(OBSERVATION_ID).min(1),
  action: z.enum(REFERENCE_ACTIONS),
  status: z.enum(REFERENCE_STATUSES),
  rationale: SAFE_SUMMARY,
  contentOverlayRef: REPO_OVERLAY_PATH.optional(),
  testIds: z.array(TEST_ID).min(1).optional(),
}).superRefine((decision, ctx) => {
  if (decision.status !== "accepted") {
    if (decision.contentOverlayRef) ctx.addIssue({ code: "custom", path: ["contentOverlayRef"], message: "only accepted decisions may name a runtime overlay" });
    return;
  }
  if (decision.action !== "adopt" && decision.action !== "adapt") {
    ctx.addIssue({ code: "custom", path: ["action"], message: "accepted runtime decisions must adopt or adapt evidence" });
  }
  if (!decision.contentOverlayRef) ctx.addIssue({ code: "custom", path: ["contentOverlayRef"], message: "accepted decisions require a content overlay" });
  if (!decision.testIds?.length) ctx.addIssue({ code: "custom", path: ["testIds"], message: "accepted decisions require test IDs" });
});
export type DesignDecisionLink = z.infer<typeof designDecisionLinkSchema>;

export function isRuntimeEligibleDecision(decision: DesignDecisionLink): boolean {
  return decision.status === "accepted"
    && (decision.action === "adopt" || decision.action === "adapt")
    && decision.contentOverlayRef !== undefined
    && (decision.testIds?.length ?? 0) > 0;
}

const publicFactSchema = z.strictObject({
  factId: ID,
  sourceIds: z.array(ID).min(1),
  summary: SAFE_SUMMARY,
  decision: z.enum(REFERENCE_ACTIONS),
  testIds: z.array(TEST_ID).min(1),
});

export const rulesetComparisonSchema = z.strictObject({
  featureId: ID,
  officialObservationIds: z.array(OBSERVATION_ID),
  hansObservationIds: z.array(OBSERVATION_ID),
  conflict: z.boolean(),
  resolutionDecisionId: ID.nullable(),
}).superRefine((comparison, ctx) => {
  if (comparison.officialObservationIds.length === 0 || comparison.hansObservationIds.length === 0) {
    ctx.addIssue({ code: "custom", message: "a cross-variant comparison needs observations from both variants" });
  }
  if (comparison.conflict && comparison.resolutionDecisionId === null) {
    ctx.addIssue({ code: "custom", path: ["resolutionDecisionId"], message: "conflicts require a fan-local resolution decision" });
  }
  if (!comparison.conflict && comparison.resolutionDecisionId !== null) {
    ctx.addIssue({ code: "custom", path: ["resolutionDecisionId"], message: "non-conflicts must not claim a resolution decision" });
  }
});
export type RulesetComparison = z.infer<typeof rulesetComparisonSchema>;

export const publicReferenceSnapshotSchema = z.strictObject({
  schemaVersion: z.literal(2),
  snapshotId: ID,
  supersedesSnapshotId: ID,
  observedAt: OFFSET_DATETIME,
  owner: z.string().min(1).max(120),
  consumer: z.string().min(1).max(120),
  cleanRoomPolicy: z.strictObject({
    rawClosedSourceIncluded: z.literal(false),
    sourceMapsFetched: z.literal(false),
    authenticationUsed: z.literal(false),
    privateEndpointsUsed: z.literal(false),
    rawAnnouncementTextRetained: z.literal(false),
    runtimeNetworkDependencyAllowed: z.literal(false),
    instruction: z.string().min(1).max(300),
  }),
  variantPolicy: z.strictObject({
    variants: z.tuple([z.literal("official"), z.literal("hans"), z.literal("fan-local")]),
    officialIsBaselineReference: z.literal(true),
    hansIsDerivativeReference: z.literal(true),
    externalVariantsMayOverwriteEachOther: z.literal(false),
    announcementsAutoApplyToRuntime: z.literal(false),
    conflictsRequireFanLocalDecision: z.literal(true),
  }),
  sources: z.array(publicSourceSchema).min(2),
  announcements: z.array(announcementObservationSchema),
  currentPublicFacts: z.array(publicFactSchema),
  proposedDesignCandidates: z.array(designDecisionLinkSchema),
  variantComparisons: z.array(rulesetComparisonSchema),
  runtimeImportPolicy: z.strictObject({
    activeSnapshotIsBuildInput: z.literal(false),
    networkFetchDuringBuildTestOrRuntime: z.literal(false),
    acceptedDecisionRequired: z.literal(true),
    acceptedDecisionMustHaveTestIds: z.literal(true),
    externalTextMayBeDisplayedInGame: z.literal(false),
    externalNumbersMayAutoReplaceBalance: z.literal(false),
  }),
}).superRefine((snapshot, ctx) => {
  const sourceIds = new Set<string>();
  for (const [index, source] of snapshot.sources.entries()) {
    if (sourceIds.has(source.sourceId)) ctx.addIssue({ code: "custom", path: ["sources", index, "sourceId"], message: "duplicate sourceId" });
    sourceIds.add(source.sourceId);
  }
  for (const variant of PUBLIC_VARIANTS) {
    if (!snapshot.sources.some((source) => source.variant === variant)) ctx.addIssue({ code: "custom", path: ["sources"], message: `missing ${variant} source` });
  }
  const announcementIds = new Set<string>();
  for (const [index, announcement] of snapshot.announcements.entries()) {
    if (announcementIds.has(announcement.announcementId)) ctx.addIssue({ code: "custom", path: ["announcements", index, "announcementId"], message: "duplicate announcementId" });
    announcementIds.add(announcement.announcementId);
    const source = snapshot.sources.find((candidate) => candidate.sourceId === announcement.sourceId);
    if (!source) ctx.addIssue({ code: "custom", path: ["announcements", index, "sourceId"], message: "announcement source does not exist" });
    else if (source.sourceType !== "news" && source.sourceType !== "notice") ctx.addIssue({ code: "custom", path: ["announcements", index, "sourceId"], message: "announcement source must be news or notice" });
  }
  const factIds = new Set<string>();
  for (const [index, fact] of snapshot.currentPublicFacts.entries()) {
    if (factIds.has(fact.factId)) ctx.addIssue({ code: "custom", path: ["currentPublicFacts", index, "factId"], message: "duplicate factId" });
    factIds.add(fact.factId);
    for (const sourceId of fact.sourceIds) if (!sourceIds.has(sourceId)) ctx.addIssue({ code: "custom", path: ["currentPublicFacts", index, "sourceIds"], message: `unknown sourceId ${sourceId}` });
  }
  const candidateIds = new Set<string>();
  for (const [index, decision] of snapshot.proposedDesignCandidates.entries()) {
    if (candidateIds.has(decision.candidateId)) ctx.addIssue({ code: "custom", path: ["proposedDesignCandidates", index, "candidateId"], message: "duplicate candidateId" });
    candidateIds.add(decision.candidateId);
  }
  const comparisonIds = new Set<string>();
  for (const [index, comparison] of snapshot.variantComparisons.entries()) {
    if (comparisonIds.has(comparison.featureId)) ctx.addIssue({ code: "custom", path: ["variantComparisons", index, "featureId"], message: "duplicate featureId" });
    comparisonIds.add(comparison.featureId);
    if (comparison.resolutionDecisionId !== null && !candidateIds.has(comparison.resolutionDecisionId)) {
      ctx.addIssue({ code: "custom", path: ["variantComparisons", index, "resolutionDecisionId"], message: "unknown resolution decision" });
    }
  }
});
export type PublicReferenceSnapshot = z.infer<typeof publicReferenceSnapshotSchema>;

/** The exact legacy payload remains protected by a pinned SHA-256; only its envelope is parsed here. */
export const legacyPublicReferenceSnapshotEnvelopeSchema = z.object({
  schemaVersion: z.literal(1),
  snapshotId: ID,
  observedAt: OFFSET_DATETIME,
  owner: z.string().min(1),
  consumer: z.string().min(1),
}).passthrough();

const snapshotIndexEntrySchema = z.strictObject({
  id: ID,
  observedAt: OFFSET_DATETIME,
  path: z.string().regex(/^docs\/product-plan\/handoff\/reference-snapshot-[0-9]{4}-[0-9]{2}-[0-9]{2}\.json$/u),
  bytes: z.number().int().positive(),
  sha256: SHA256_UPPER,
  status: z.enum(["active", "superseded"]),
});
const ledgerIndexEntrySchema = z.strictObject({
  path: z.string().refine((value) => value === "docs/product-plan/reference-ledger.csv" || /^docs\/product-plan\/handoff\/reference-ledger-delta-[0-9]{4}-[0-9]{2}-[0-9]{2}\.csv$/u.test(value), "invalid ledger path"),
  bytes: z.number().int().positive(),
  sha256: SHA256_UPPER,
  rowCount: z.number().int().positive(),
  status: z.enum(["locked-base", "active-delta", "superseded-delta"]),
});

export const referenceIndexSchema = z.strictObject({
  schemaVersion: z.literal(1),
  activeSnapshotId: ID,
  snapshots: z.array(snapshotIndexEntrySchema).min(1),
  ledgerSegments: z.array(ledgerIndexEntrySchema).min(1),
  integrationPlan: z.strictObject({
    path: z.literal("docs/product-plan/10-PUBLIC-VARIANT-INTEGRATION.md"),
    bytes: z.number().int().positive(),
    sha256: SHA256_UPPER,
  }),
  rules: z.strictObject({
    appendOnly: z.literal(true),
    productionNetworkFetch: z.literal(false),
    announcementAutoImport: z.literal(false),
    acceptedFanLocalDecisionRequired: z.literal(true),
  }),
}).superRefine((index, ctx) => {
  const snapshotIds = new Set<string>();
  const paths = new Set<string>();
  let activeCount = 0;
  for (const [position, snapshot] of index.snapshots.entries()) {
    if (snapshotIds.has(snapshot.id)) ctx.addIssue({ code: "custom", path: ["snapshots", position, "id"], message: "duplicate snapshot id" });
    if (paths.has(snapshot.path)) ctx.addIssue({ code: "custom", path: ["snapshots", position, "path"], message: "duplicate indexed path" });
    snapshotIds.add(snapshot.id);
    paths.add(snapshot.path);
    if (snapshot.status === "active") {
      activeCount += 1;
      if (snapshot.id !== index.activeSnapshotId) ctx.addIssue({ code: "custom", path: ["activeSnapshotId"], message: "activeSnapshotId does not match active entry" });
    }
  }
  for (const [position, ledger] of index.ledgerSegments.entries()) {
    if (paths.has(ledger.path)) ctx.addIssue({ code: "custom", path: ["ledgerSegments", position, "path"], message: "duplicate indexed path" });
    paths.add(ledger.path);
    const base = ledger.path === "docs/product-plan/reference-ledger.csv";
    if (base !== (ledger.status === "locked-base")) {
      ctx.addIssue({ code: "custom", path: ["ledgerSegments", position, "status"], message: "only the canonical baseline ledger may be locked-base" });
    }
  }
  if (activeCount !== 1) ctx.addIssue({ code: "custom", path: ["snapshots"], message: "exactly one snapshot must be active" });
  if (!snapshotIds.has(index.activeSnapshotId)) ctx.addIssue({ code: "custom", path: ["activeSnapshotId"], message: "activeSnapshotId is not indexed" });
  if (index.ledgerSegments.filter((entry) => entry.status === "locked-base").length !== 1) {
    ctx.addIssue({ code: "custom", path: ["ledgerSegments"], message: "exactly one canonical baseline ledger must be locked-base" });
  }
  if (index.ledgerSegments.filter((entry) => entry.status === "active-delta").length !== 1) {
    ctx.addIssue({ code: "custom", path: ["ledgerSegments"], message: "exactly one ledger delta must be active" });
  }
});
export type ReferenceIndex = z.infer<typeof referenceIndexSchema>;

export const referenceLedgerRecordSchema = z.strictObject({
  observation_id: OBSERVATION_ID,
  observed_at: OFFSET_DATETIME,
  source_type: z.enum(["official", "hans", "guide", "community", "playtest", "opensource"]),
  source_url: z.string().min(1).max(512),
  source_version: z.string().max(100),
  region_language: z.string().min(1).max(40),
  claim: z.string().min(1).max(500),
  evidence_method: z.string().min(1).max(200),
  confidence: z.enum(["high", "medium", "low"]),
  copyright_class: z.enum(["fact", "measurement", "idea", "text-do-not-copy", "code-do-not-copy"]),
  design_action: z.enum(["adopt", "adapt", "reject", "test", "watch", "defer"]),
  our_decision: z.string().min(1).max(500),
  test_id: TEST_ID,
  review_status: z.enum(["new", "reviewed", "superseded", "invalid"]),
});
export type ReferenceLedgerRecord = z.infer<typeof referenceLedgerRecordSchema>;
