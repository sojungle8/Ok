/**
 * First visible formal HUD assembled only from verified original RO rasters. This module deliberately
 * accepts a view model instead of RunState so the guarded RO visual graph never owns simulation state.
 * Positioning and DOM text are original layout; every visible panel, gauge and icon pixel comes from
 * the pinned KRO2021_CLASSIC_V0_FAN registry.
 */
import { useState } from "preact/hooks";
import type { RasterRegistry, VerifiedRaster } from "./raster.ts";
import { RoButton, RoGauge, RoRaster, RoThreeSlice, type RoButtonState } from "./primitives.tsx";

export interface RoHudSkill {
  id: string;
  rank: number;
  hotkey?: string;
  cooldownTicks?: number;
}

export interface RoFormalHudModel {
  playerName: string;
  jobName: string;
  level: number;
  hp: number;
  maxHp: number;
  xp: number;
  xpNext: number;
  timer: string;
  kills: number;
  keystone?: string;
  skills: RoHudSkill[];
  minimap?: { xPermille: number; yPermille: number; facingDeg: number };
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
const BASIC_SYSTEM = [
  ["ui.control.base.normal", "ui.control.base.hover"],
  ["ui.control.minimize.normal", "ui.control.minimize.hover"],
] as const;
const BASIC_MENU = [
  ["status", "ui.menu.status.normal", "ui.menu.status.active"],
  ["option", "ui.menu.option.normal", "ui.menu.option.active"],
  ["inventory", "ui.menu.inventory.normal", "ui.menu.inventory.active"],
  ["equipment", "ui.menu.equipment.normal", "ui.menu.equipment.active"],
  ["skill", "ui.menu.skill.normal", "ui.menu.skill.active"],
  ["map", "ui.menu.map.normal", "ui.menu.map.active"],
  ["chat", "ui.menu.chat.normal", "ui.menu.chat.active"],
  ["friends", "ui.menu.friends.normal", "ui.menu.friends.active"],
] as const;
const MINIMAP = [
  "ui.minimap.map.prt_fild08",
  "ui.minimap.player_arrow",
  "ui.minimap.control.zoom_in.normal",
  "ui.minimap.control.zoom_in.hover",
  "ui.minimap.control.zoom_out.normal",
  "ui.minimap.control.zoom_out.hover",
] as const;

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
    ...BASIC_SYSTEM.flat(),
    ...BASIC_MENU.flatMap((entry) => entry.slice(1)),
    ...MINIMAP,
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
      <span class="ro-basic-title">Basic Info</span>
      <span class="ro-basic-name">{model.playerName}</span>
      <span class="ro-basic-job">{model.jobName}</span>
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

function SystemButton({ rasters, ids, label, onPress }: { rasters: RasterRegistry; ids: readonly [string, string]; label: string; onPress: () => void }) {
  const [state, setState] = useState<RoButtonState>("off");
  return (
    <span class="ro-basic-system-button" onPointerEnter={() => setState("hover")} onPointerLeave={() => setState("off")}>
      {RoButton({ rasters, declared: { off: ids[0], hover: ids[1] }, state, label, onPress })}
    </span>
  );
}

function RoBasicMenu({ rasters }: { rasters: RasterRegistry }) {
  return (
    <div class="ro-basic-menu" aria-label="RO 主選單">
      {BASIC_MENU.map(([name, normal]) => (
        <span key={name} class="ro-basic-menu-item" data-ro-menu={name} aria-hidden="true">
          {RoRaster({ raster: rasters.get(normal) })}
        </span>
      ))}
    </div>
  );
}

export function RoBasicInfo({ rasters, model }: { rasters: RasterRegistry; model: RoFormalHudModel }) {
  const [minimized, setMinimized] = useState(false);
  return (
    <div class={`ro-basic-anchor${minimized ? " is-minimized" : ""}`}>
      <BasicInfoVariant rasters={rasters} model={model} compact={false} />
      <BasicInfoVariant rasters={rasters} model={model} compact={true} />
      <span class="ro-basic-system ro-basic-system-base">
        <SystemButton rasters={rasters} ids={BASIC_SYSTEM[0]} label="展開基本資訊" onPress={() => setMinimized(false)} />
      </span>
      <span class="ro-basic-system ro-basic-system-minimize">
        <SystemButton rasters={rasters} ids={BASIC_SYSTEM[1]} label="縮小基本資訊" onPress={() => setMinimized(true)} />
      </span>
      <RoBasicMenu rasters={rasters} />
    </div>
  );
}

export interface RoMinimapPlan {
  mapLeft: number;
  mapTop: number;
  arrowLeft: number;
  arrowTop: number;
  facingDeg: number;
  viewport: 128;
}

/** Crop the native 512px map at 1:1; no fractional scaling or synthesized map surface. */
export function planMinimap(map: VerifiedRaster, arrow: VerifiedRaster, model: NonNullable<RoFormalHudModel["minimap"]>): RoMinimapPlan {
  const viewport = 128 as const;
  const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value));
  const x = Math.round(clamp(model.xPermille, 0, 1000) * (map.width - 1) / 1000);
  const y = Math.round(clamp(model.yPermille, 0, 1000) * (map.height - 1) / 1000);
  const mapLeft = clamp(Math.round(viewport / 2 - x), viewport - map.width, 0);
  const mapTop = clamp(Math.round(viewport / 2 - y), viewport - map.height, 0);
  return {
    mapLeft,
    mapTop,
    arrowLeft: clamp(Math.round(x + mapLeft - arrow.width / 2), 0, viewport - arrow.width),
    arrowTop: clamp(Math.round(y + mapTop - arrow.height / 2), 0, viewport - arrow.height),
    facingDeg: Number.isFinite(model.facingDeg) ? model.facingDeg : 0,
    viewport,
  };
}

export function RoMinimap({ rasters, model }: { rasters: RasterRegistry; model: NonNullable<RoFormalHudModel["minimap"]> }) {
  const map = rasters.get(MINIMAP[0]);
  const arrow = rasters.get(MINIMAP[1]);
  const plan = planMinimap(map, arrow, model);
  return (
    <div class="ro-minimap" data-testid="ro-minimap" data-ro-crop="native-1x">
      <div class="ro-minimap-map" style={{ left: `${plan.mapLeft}px`, top: `${plan.mapTop}px` }}>{RoRaster({ raster: map })}</div>
      <div class="ro-minimap-arrow" style={{ left: `${plan.arrowLeft}px`, top: `${plan.arrowTop}px`, transform: `rotate(${plan.facingDeg}deg)` }}>{RoRaster({ raster: arrow })}</div>
      <div class="ro-minimap-controls" aria-hidden="true">
        {RoRaster({ raster: rasters.get("ui.minimap.control.zoom_in.normal") })}
        {RoRaster({ raster: rasters.get("ui.minimap.control.zoom_out.normal") })}
      </div>
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
      {model.minimap ? <RoMinimap rasters={rasters} model={model.minimap} /> : null}
      {model.boss ? <RoBossStatus rasters={rasters} boss={model.boss} /> : null}
      {model.alert ? <RoTitleStrip rasters={rasters} text={model.alert.text} testId={model.alert.testId} className="ro-boss-alert" /> : null}
    </div>
  );
}
