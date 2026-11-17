/**
 * RO UI asset contract for the locked-candidate reference profile `KRO2021_CLASSIC_V0_FAN`
 * (CLAUDE-PHASE1-RO-UI.md §3). Pure data rules: no pixels are produced here. Every visible UI
 * element must trace back to one of these whitelisted rows; nothing is substituted when one is missing.
 */
import type { WhitelistRow } from "@ro-survivor/content-schema";
import type { AssetWhitelist } from "./whitelist.ts";

export const UI_PROFILE_ID = "KRO2021_CLASSIC_V0_FAN";
export const UI_PROFILE_NOTE_PREFIX = `profile=${UI_PROFILE_ID};`;

export const UI_ROLES = ["frame", "button", "gauge", "slot", "icon", "cursor", "minimap", "chat", "tooltip", "font", "number"] as const;
export type UiRole = (typeof UI_ROLES)[number];
/** Button states supported by the manifest (§3.2). Missing states are never synthesised by CSS. */
export const UI_STATES = ["off", "on", "hover", "down", "disabled"] as const;
export type UiState = (typeof UI_STATES)[number];
export type SlicePart = "left" | "mid" | "right";

export interface UiClassification {
  role: UiRole;
  state: UiState | null;
  /** Three-part horizontal slice: left + repeated mid + right (no nine-slice in this closure). */
  slice: { group: string; part: SlicePart } | null;
  /** Logical key that must be unique: two rows with the same key would be an undecided version collision. */
  logicalKey: string;
}

const STATE_TOKENS: Record<string, UiState> = { normal: "off", off: "off", active: "on", on: "on", hover: "hover", pressed: "down", disabled: "disabled" };

export const isUiRow = (r: Pick<WhitelistRow, "category">): boolean => r.category.startsWith("ui_");

/** Native size declared in the whitelist notes ("…; 24x24 BMP 8bpp"), or null when not declared. */
export function declaredUiDimensions(notes: string): { width: number; height: number } | null {
  const m = /(\d+)x(\d+)\s+BMP/u.exec(notes);
  return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
}

function roleFor(row: Pick<WhitelistRow, "asset_id" | "category">): UiRole {
  const id = row.asset_id;
  switch (row.category) {
    case "ui_cursor":
      return "cursor";
    case "ui_status_hud":
      return id.startsWith("ui.gauge.") ? "gauge" : "frame";
    case "ui_status_control":
    case "ui_main_menu_button":
    case "ui_button_chrome":
    case "ui_scroll_arrow":
      return "button";
    case "ui_hotbar":
      return id === "ui.hotbar.background" ? "frame" : id === "ui.slot.selection" ? "slot" : "button";
    case "ui_window_chrome":
      return "frame";
    case "ui_minimap":
      return id.startsWith("ui.minimap.control.") ? "button" : "minimap";
    case "ui_chat":
      return /\.(?:normal|hover|pressed|active|on|off|locked|unlocked|up|down)$/u.test(id) && !id.startsWith("ui.chat.scroll.track") ? "button" : "chat";
    case "ui_skill_icon":
      return "icon";
    case "ui_number_sheet":
      return "number";
    case "ui_font":
      return "font";
    default:
      throw new Error(`${id}: unknown UI category ${row.category}`);
  }
}

export function classifyUiAsset(row: Pick<WhitelistRow, "asset_id" | "category">): UiClassification {
  const parts = row.asset_id.split(".");
  let state: UiState | null = null;
  let slice: UiClassification["slice"] = null;
  const last = parts[parts.length - 1] ?? "";
  const stem = [...parts];
  // Scroll arrows are directions (arw_left / arw_right), not slices of a three-part strip.
  if ((last === "left" || last === "mid" || last === "right") && row.category !== "ui_scroll_arrow") {
    stem.pop();
    slice = { group: stem.join("."), part: last };
  }
  // State token: final segment for buttons, or the segment before a slice part (ui.button.hover.left).
  const stateIdx = slice ? stem.length - 1 : parts.length - 1;
  const tok = (slice ? stem : parts)[stateIdx] ?? "";
  const role = roleFor(row);
  if (role === "button" && tok in STATE_TOKENS) state = STATE_TOKENS[tok] ?? null;
  return { role, state, slice, logicalKey: row.asset_id };
}

export interface UiProfileIssue {
  assetId: string;
  issue: string;
}

/**
 * Path families that belong to other client generations and must never be mixed into the V0 profile
 * (RO-UI-REFERENCE-EVIDENCE §6.7, ro-ui-original-assets-NOTES): V5 `menu_icon`, minimap V2 `i_*` controls.
 */
const FOREIGN_FAMILIES: { pattern: RegExp; reason: string }[] = [
  { pattern: /\\menu_icon\\/iu, reason: "BasicInfo V5 menu_icon family" },
  { pattern: /\\map\\i_[^\\]*$/iu, reason: "minimap V2 i_* control family" },
];

/** Same-profile check: every UI row is tagged with the profile and none comes from a foreign family. */
export function checkUiProfileCompatibility(rows: readonly WhitelistRow[]): UiProfileIssue[] {
  const issues: UiProfileIssue[] = [];
  const keys = new Map<string, string>();
  for (const r of rows.filter(isUiRow)) {
    if (!r.notes.startsWith(UI_PROFILE_NOTE_PREFIX)) issues.push({ assetId: r.asset_id, issue: `notes do not start with ${UI_PROFILE_NOTE_PREFIX}` });
    for (const f of FOREIGN_FAMILIES) if (f.pattern.test(r.canonical_cp949_path)) issues.push({ assetId: r.asset_id, issue: `mixed profile: ${f.reason}` });
    if ((r.category === "ui_status_hud" || r.category === "ui_status_control" || r.category === "ui_main_menu_button") && !/\\basic_interface\\/iu.test(r.canonical_cp949_path)) {
      issues.push({ assetId: r.asset_id, issue: "BasicInfo element outside basic_interface (V0)" });
    }
    if (r.required !== "true") issues.push({ assetId: r.asset_id, issue: "UI closure rows must be required" });
    if (!/^[0-9a-fA-F]{64}$/u.test(r.sha256)) issues.push({ assetId: r.asset_id, issue: "UI rows must carry SHA-256" });
    let c: UiClassification;
    try {
      c = classifyUiAsset(r);
    } catch (err) {
      issues.push({ assetId: r.asset_id, issue: String(err) });
      continue;
    }
    const prev = keys.get(c.logicalKey);
    if (prev) issues.push({ assetId: r.asset_id, issue: `logical collision with ${prev}` });
    keys.set(c.logicalKey, r.asset_id);
    if (c.slice) {
      for (const part of ["left", "mid", "right"] as const) {
        if (!rows.some((o) => o.asset_id === `${c.slice?.group}.${part}`)) issues.push({ assetId: r.asset_id, issue: `three-part slice ${c.slice.group} lacks ${part}` });
      }
    }
  }
  return issues;
}

/** Every required UI row is a core asset: the formal world canvas is not created without all of them (§3.3). */
export function formalUiRequiredIds(list: AssetWhitelist): string[] {
  return list.rows().filter((r) => isUiRow(r) && r.required === "true").map((r) => r.asset_id);
}

/** Interactive button groups: ids that differ only by state token. Each declared state has a source row. */
export function uiButtonStates(list: AssetWhitelist): Map<string, UiState[]> {
  const out = new Map<string, UiState[]>();
  for (const r of list.rows().filter(isUiRow)) {
    const c = classifyUiAsset(r);
    if (c.role !== "button" || !c.state) continue;
    const group = c.slice ? `${c.slice.group.split(".").slice(0, -1).join(".")}.*.${c.slice.part}` : r.asset_id.split(".").slice(0, -1).join(".");
    out.set(group, [...(out.get(group) ?? []), c.state]);
  }
  return out;
}
