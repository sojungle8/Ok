import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  announcementObservationSchema,
  designDecisionLinkSchema,
  isRuntimeEligibleDecision,
  publicReferenceSnapshotSchema,
  publicSourceSchema,
  referenceIndexSchema,
  rulesetComparisonSchema,
} from "../src/index.ts";

const plan = new URL("../../../docs/product-plan/", import.meta.url);
const snapshotRaw = JSON.parse(readFileSync(new URL("handoff/reference-snapshot-2026-11-18.json", plan), "utf8")) as unknown;
const indexRaw = JSON.parse(readFileSync(new URL("handoff/reference-index.json", plan), "utf8")) as unknown;

describe("public reference contracts", () => {
  const snapshot = publicReferenceSnapshotSchema.parse(snapshotRaw);
  const index = referenceIndexSchema.parse(indexRaw);

  it("parses the active official plus HANS snapshot and its append-only index", () => {
    expect(new Set(snapshot.sources.map((source) => source.variant))).toEqual(new Set(["official", "hans"]));
    expect(index.activeSnapshotId).toBe(snapshot.snapshotId);
    expect(index.snapshots).toHaveLength(2);
    expect(index.ledgerSegments).toHaveLength(2);
  });

  it("is strict at nested boundaries", () => {
    expect(publicSourceSchema.safeParse({ ...snapshot.sources[0], unexpected: true }).success).toBe(false);
    expect(announcementObservationSchema.safeParse({ ...snapshot.announcements[0], unexpected: true }).success).toBe(false);
    expect(publicReferenceSnapshotSchema.safeParse({ ...snapshot, runtimeImportPolicy: { ...snapshot.runtimeImportPolicy, unexpected: true } }).success).toBe(false);
    expect(referenceIndexSchema.safeParse({ ...index, rules: { ...index.rules, announcementAutoImport: true } }).success).toBe(false);
  });

  it("rejects credentials, query strings, foreign hosts and code artifacts", () => {
    const source = snapshot.sources[0]!;
    for (const url of [
      "http://ro-survivors.com/",
      "https://user:pass@ro-survivors.com/",
      "https://ro-survivors.com/?token=secret",
      "https://ro-survivors.com/#fragment",
      "https://ro-survivors.com:444/",
      "https://evil.example/",
      "https://ro-survivors.com/build/main.js",
      "https://ro-survivors.com/client.js.map",
    ]) expect(publicSourceSchema.safeParse({ ...source, url }).success, url).toBe(false);
    for (const observedAt of ["2026-02-30T12:00:00Z", "2026-11-18T24:00:00Z", "2026-11-18T12:00:00+15:00"]) {
      expect(publicSourceSchema.safeParse({ ...source, observedAt }).success, observedAt).toBe(false);
    }
  });

  it("rejects copied markup, code-like text and long announcement prose", () => {
    const announcement = snapshot.announcements[0]!;
    for (const titleSummary of ["<script>alert(1)</script>", "```js", "https://example.test/raw", "function copied()", "x".repeat(241)]) {
      expect(announcementObservationSchema.safeParse({ ...announcement, titleSummary }).success, titleSummary.slice(0, 20)).toBe(false);
    }
  });

  it("keeps proposed evidence out of runtime and gates accepted overlays", () => {
    const proposed = snapshot.proposedDesignCandidates[0]!;
    expect(isRuntimeEligibleDecision(proposed)).toBe(false);
    expect(designDecisionLinkSchema.safeParse({ ...proposed, contentOverlayRef: "content/overlays/unsafe.json" }).success).toBe(false);
    for (const patch of [
      { status: "accepted" },
      { status: "accepted", contentOverlayRef: "content/overlays/choice-bank.json" },
      { status: "accepted", testIds: ["QA-PENDING-CHOICE-001"] },
      { status: "accepted", contentOverlayRef: "../outside.json", testIds: ["QA-PENDING-CHOICE-001"] },
      { status: "accepted", contentOverlayRef: "content/overlays/x/../../../evil.json", testIds: ["QA-PENDING-CHOICE-001"] },
      { status: "accepted", action: "reject", contentOverlayRef: "content/overlays/choice-bank.json", testIds: ["QA-PENDING-CHOICE-001"] },
    ]) expect(designDecisionLinkSchema.safeParse({ ...proposed, ...patch }).success).toBe(false);
    const accepted = designDecisionLinkSchema.parse({
      ...proposed,
      status: "accepted",
      contentOverlayRef: "content/overlays/choice-bank.json",
      testIds: ["QA-PENDING-CHOICE-001"],
    });
    expect(isRuntimeEligibleDecision(accepted)).toBe(true);
  });

  it("fails closed on an unresolved official/HANS conflict", () => {
    const conflict = {
      featureId: "feature.example",
      officialObservationIds: ["OBS-20261118-OFFICIAL-001"],
      hansObservationIds: ["OBS-20261118-HANS-001"],
      conflict: true,
      resolutionDecisionId: null,
    };
    expect(rulesetComparisonSchema.safeParse(conflict).success).toBe(false);
    expect(rulesetComparisonSchema.safeParse({ ...conflict, resolutionDecisionId: "candidate.example" }).success).toBe(true);
  });

  it("rejects duplicate index paths and zero or multiple active snapshots", () => {
    const duplicatePath = structuredClone(index);
    duplicatePath.snapshots[1]!.path = duplicatePath.snapshots[0]!.path;
    expect(referenceIndexSchema.safeParse(duplicatePath).success).toBe(false);

    const zeroActive = structuredClone(index);
    zeroActive.snapshots = zeroActive.snapshots.map((entry) => ({ ...entry, status: "superseded" as const }));
    expect(referenceIndexSchema.safeParse(zeroActive).success).toBe(false);

    const twoActive = structuredClone(index);
    twoActive.snapshots = twoActive.snapshots.map((entry) => ({ ...entry, status: "active" as const }));
    expect(referenceIndexSchema.safeParse(twoActive).success).toBe(false);
  });
});
