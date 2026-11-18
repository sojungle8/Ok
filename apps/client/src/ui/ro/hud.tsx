/**
 * First visible formal HUD assembled only from verified original RO rasters. This module deliberately
 * accepts a view model instead of RunState so the guarded RO visual graph never owns simulation state.
 * Positioning and DOM text are original layout; every visible panel, gauge and icon pixel comes from
 * the pinned KRO2021_CLASSIC_V0_FAN registry.
 */
import type { RasterRegistry, VerifiedRaster } from "./raster.ts";
import { RoGauge, RoRaster, RoThreeSlice } from "./primitives.tsx";

export interface RoHudSkill {
  id: string;
  rank: number;
  hotkey?: string;
  cooldownTicks?: number;
}

export interface RoFormalHudModel {
  playerName: string;
  level: number;
  hp: number;
  maxHp: number;
  xp: number;
  xpNext: number;
  timer: string;
  kills: number;
  keystone?: string;
  skills: RoHudSkill[];
  boss?: { name: string; hp: number; maxHp: number; detail?: string };
  alert?: { text: string; testId: "boss-intro" | "boss-warning" | "outcome" };
}

/** Approved semantic mappings. The pixels remain the unmodified official RO skill icons. */
export const RO_SKILL_ICON: ReadonlyMap<string, string> = new Map<string, string>([
  ["skill.sw.basic_slash", "ui.skill.sm_sword.icon"],
  ["skill.sw.bash", "ui.skill.sm_bash.icon"],
  ["skill.sw.magnum_break", "ui.skill.sm_magnum.icon"],
  ["skill.sw.endure", "ui.skill.sm_endure.icon"],
  ["skill.sw.provoke", "ui.skill.sm_provoke.icon"],
  ["skill.sw.shield_wave", "ui.skill.cr_shieldboomerang.icon"],
  ["skill.sw.fatal_blow", "ui.skill.sm_fatalblow.icon"],
  ["skill.sw.auto_berserk", "ui.skill.sm_autoberserk.icon"],
  ["passive.sw.sword_mastery", "ui.skill.sm_sword.icon"],
  ["passive.sw.twohand_mastery", "ui.skill.sm_twohand.icon"],
  ["passive.sw.hp_recovery", "ui.skill.sm_recovery.icon"],
  ["passive.sw.moving_recovery", "ui.skill.sm_movingrecovery.icon"],
]);

export function roSkillIconId(skillId: string): string | null {
  return RO_SKILL_ICON.get(skillId) ?? null;
}

const EMPTY_GAUGE = ["ui.gauge.empty.left", "ui.gauge.empty.mid", "ui.gauge.empty.right"] as const;
const HP_GAUGE = ["ui.gauge.hp.left", "ui.gauge.hp.mid", "ui.gauge.hp.right"] as const;
const XP_GAUGE = ["ui.gauge.sp.left", "ui.gauge.sp.mid", "ui.gauge.sp.right"] as const;
const TITLE = ["ui.window.title.left", "ui.window.title.mid", "ui.window.title.right"] as const;

function three(rasters: RasterRegistry, ids: readonly [string, string, string]): [VerifiedRaster, VerifiedRaster, VerifiedRaster] {
  return [rasters.get(ids[0]), rasters.get(ids[1]), rasters.get(ids[2])];
}

/** Pure asset plan used by structural tests and content gates. It intentionally excludes selection. */
export function formalHudAssetIds(model: RoFormalHudModel): string[] {
  const ids = new Set<string>([
    "ui.hud.basic.background",
    "ui.hud.basic.background.mini",
    "ui.hotbar.background",
    ...EMPTY_GAUGE,
    ...HP_GAUGE,
    ...XP_GAUGE,
    ...TITLE,
  ]);
  for (const skill of model.skills.slice(0, 9)) {
    const icon = roSkillIconId(skill.id);
    if (icon !== null) ids.add(icon);
  }
  return [...ids].sort();
}

function ratio(value: number, max: number): number {
  return max > 0 ? value / max : 0;
}

function BasicInfoVariant({ rasters, model, compact }: { rasters: RasterRegistry; model: RoFormalHudModel; compact: boolean }) {
  const empty = three(rasters, EMPTY_GAUGE);
  const hp = three(rasters, HP_GAUGE);
  const xp = three(rasters, XP_GAUGE);
  return (
    <div class={`ro-basic-info ${compact ? "ro-basic-info-mini" : "ro-basic-info-full"}`} data-ro-layout={compact ? "mobile-mini" : "desktop-full"}>
      {RoRaster({ raster: rasters.get(compact ? "ui.hud.basic.background.mini" : "ui.hud.basic.background") })}
      <span class="ro-basic-name">{model.playerName}</span>
      <span class="ro-basic-level">Lv {model.level}</span>
      <div class="ro-basic-hp" aria-label="HP">
        {RoGauge({ empty, fill: hp, ratio: ratio(model.hp, model.maxHp), width: compact ? 90 : 85 })}
      </div>
      <div class="ro-basic-xp" aria-label="XP" data-ro-semantic-reuse="official-sp-gauge-as-xp">
        {RoGauge({ empty, fill: xp, ratio: ratio(model.xp, model.xpNext), width: compact ? 90 : 85 })}
      </div>
      <span class="ro-basic-hp-text">{Math.ceil(model.hp / 100)} / {Math.ceil(model.maxHp / 100)}</span>
      {!compact && model.keystone ? <span class="ro-basic-keystone">{model.keystone}</span> : null}
    </div>
  );
}

export function RoBasicInfo({ rasters, model }: { rasters: RasterRegistry; model: RoFormalHudModel }) {
  return (
    <div class="ro-basic-anchor">
      <BasicInfoVariant rasters={rasters} model={model} compact={false} />
      <BasicInfoVariant rasters={rasters} model={model} compact={true} />
    </div>
  );
}

export function RoShortcut({ rasters, skills }: { rasters: RasterRegistry; skills: RoHudSkill[] }) {
  return (
    <div class="ro-shortcut" data-testid="ro-shortcut">
      {RoRaster({ raster: rasters.get("ui.hotbar.background") })}
      {skills.slice(0, 9).map((skill, index) => {
        const iconId = roSkillIconId(skill.id);
        return (
          <div key={`${skill.id}:${index}`} class={`ro-shortcut-slot ro-shortcut-slot-${index + 1}`} data-ro-skill={skill.id} data-ro-icon={iconId ?? "missing"}>
            {iconId === null ? null : RoRaster({ raster: rasters.get(iconId) })}
            {skill.hotkey ? <span class="ro-shortcut-hotkey">{skill.hotkey}</span> : null}
            <span class="ro-shortcut-rank">{skill.rank}</span>
            {(skill.cooldownTicks ?? 0) > 0 ? <span class="ro-shortcut-cooldown">{Math.ceil((skill.cooldownTicks ?? 0) / 60)}</span> : null}
          </div>
        );
      })}
    </div>
  );
}

function RoTitleStrip({ rasters, text, testId, className = "" }: { rasters: RasterRegistry; text: string; testId?: string; className?: string }) {
  const [left, mid, right] = three(rasters, TITLE);
  return (
    <div class={`ro-title-strip ${className}`} data-testid={testId}>
      {RoThreeSlice({ left, mid, right, width: 180 })}
      <span>{text}</span>
    </div>
  );
}

export function RoStageStatus({ rasters, model }: { rasters: RasterRegistry; model: RoFormalHudModel }) {
  return <RoTitleStrip rasters={rasters} text={`${model.timer}  擊殺 ${model.kills}`} testId="timer" className="ro-stage-status" />;
}

export function RoBossStatus({ rasters, boss }: { rasters: RasterRegistry; boss: NonNullable<RoFormalHudModel["boss"]> }) {
  return (
    <div class="ro-boss-status" data-testid="boss-hp">
      <RoTitleStrip rasters={rasters} text={`${boss.name}${boss.detail ? ` · ${boss.detail}` : ""}`} />
      <div class="ro-boss-gauge">
        {RoGauge({ empty: three(rasters, EMPTY_GAUGE), fill: three(rasters, HP_GAUGE), ratio: ratio(boss.hp, boss.maxHp), width: 180 })}
      </div>
    </div>
  );
}

export function RoFormalHud({ rasters, model }: { rasters: RasterRegistry; model: RoFormalHudModel }) {
  return (
    <div class="ro-run-hud" data-testid="run-hud" data-ro-hud="KRO2021_CLASSIC_V0_FAN">
      <RoBasicInfo rasters={rasters} model={model} />
      <RoStageStatus rasters={rasters} model={model} />
      <RoShortcut rasters={rasters} skills={model.skills} />
      {model.boss ? <RoBossStatus rasters={rasters} boss={model.boss} /> : null}
      {model.alert ? <RoTitleStrip rasters={rasters} text={model.alert.text} testId={model.alert.testId} className="ro-boss-alert" /> : null}
    </div>
  );
}
