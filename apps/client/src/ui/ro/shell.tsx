/**
 * Formal pre-run shell made from the same verified original RO window and button rasters as the
 * in-run HUD. Text and layout are project UI; no substitute bitmap, CSS-drawn panel or copied
 * RO Survivors screen is used.
 */
import { useState } from "preact/hooks";
import type { RasterRegistry } from "./raster.ts";
import { RO_BUTTON_CHROME_IDS, RO_WINDOW_CHROME_IDS, RoRaster, RoThreeSliceButton, RoWindow, type RoChromeButtonState } from "./primitives.tsx";
import "./shell.css";

export type RoShellScreen = "title" | "character-select" | "stage-select";

export interface RoShellSettings {
  flash: boolean;
  shake: boolean;
  damageNumbers: boolean;
  colorBlind: boolean;
  effectOpacity: number;
  volumes: Record<string, number>;
}

const withFlash = (s: RoShellSettings, value: boolean): RoShellSettings => ({ flash: value, shake: s.shake, damageNumbers: s.damageNumbers, colorBlind: s.colorBlind, effectOpacity: s.effectOpacity, volumes: s.volumes });
const withShake = (s: RoShellSettings, value: boolean): RoShellSettings => ({ flash: s.flash, shake: value, damageNumbers: s.damageNumbers, colorBlind: s.colorBlind, effectOpacity: s.effectOpacity, volumes: s.volumes });
const withDamageNumbers = (s: RoShellSettings, value: boolean): RoShellSettings => ({ flash: s.flash, shake: s.shake, damageNumbers: value, colorBlind: s.colorBlind, effectOpacity: s.effectOpacity, volumes: s.volumes });
const withColorBlind = (s: RoShellSettings, value: boolean): RoShellSettings => ({ flash: s.flash, shake: s.shake, damageNumbers: s.damageNumbers, colorBlind: value, effectOpacity: s.effectOpacity, volumes: s.volumes });
const withEffectOpacity = (s: RoShellSettings, value: number): RoShellSettings => ({ flash: s.flash, shake: s.shake, damageNumbers: s.damageNumbers, colorBlind: s.colorBlind, effectOpacity: value, volumes: s.volumes });

const WINDOW_IDS = [
  ...RO_WINDOW_CHROME_IDS.title,
  ...RO_WINDOW_CHROME_IDS.body,
  ...RO_WINDOW_CHROME_IDS.footer,
] as const;

/** Exact verified raster dependencies for fail-closed tests and review. */
export function formalShellAssetIds(screen: RoShellScreen): string[] {
  const ids = new Set<string>([
    ...WINDOW_IDS,
    ...RO_BUTTON_CHROME_IDS.off,
    ...RO_BUTTON_CHROME_IDS.hover,
    ...RO_BUTTON_CHROME_IDS.down,
    ...RO_BUTTON_CHROME_IDS.disabled,
  ]);
  if (screen === "character-select") ids.add("ui.skill.sm_sword.icon");
  if (screen === "stage-select") ids.add("ui.minimap.map.prt_fild08");
  return [...ids].sort();
}

function ShellButton(props: {
  rasters: RasterRegistry;
  width: number;
  label: string;
  testId: string;
  selected?: boolean;
  compact?: boolean;
  onPress: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pressed, setPressed] = useState(false);
  const state: RoChromeButtonState = pressed ? "down" : hovered || focused || props.selected ? "hover" : "off";
  return RoThreeSliceButton({
    rasters: props.rasters,
    width: props.width,
    scale: props.compact ? 1 : 2,
    label: props.label,
    state,
    testId: props.testId,
    onFocus: () => setFocused(true),
    onBlur: () => { setFocused(false); setPressed(false); },
    onPointerEnter: () => setHovered(true),
    onPointerLeave: () => { setHovered(false); setPressed(false); },
    onPointerDown: () => setPressed(true),
    onPointerUp: () => setPressed(false),
    onPointerCancel: () => setPressed(false),
    onPress: props.onPress,
  });
}

function SettingToggle(props: { rasters: RasterRegistry; label: string; checked: boolean; testId: string; onToggle: () => void }) {
  return (
    <div class="ro-shell-setting-row">
      <span>{props.label}</span>
      <ShellButton rasters={props.rasters} width={64} label={props.checked ? "開" : "關"} selected={props.checked} compact testId={props.testId} onPress={props.onToggle} />
    </div>
  );
}

export function RoTitleShell(props: {
  rasters: RasterRegistry;
  settings: RoShellSettings;
  onSettings: (settings: RoShellSettings) => void;
  onStart: () => void;
}) {
  const opacity = Math.round(props.settings.effectOpacity * 100);
  const updateOpacity = (delta: number): void => {
    const next = Math.max(0.2, Math.min(1, Math.round((props.settings.effectOpacity + delta) * 10) / 10));
    props.onSettings(withEffectOpacity(props.settings, next));
  };
  return (
    <div class="ro-shell-screen" data-testid="title" data-ro-shell="original-ro-raster">
      {RoWindow({
        rasters: props.rasters,
        width: 360,
        height: 370,
        title: "RO Survivors · 同人垂直切片",
        children: <div class="ro-shell-content ro-shell-title-content">
          <div class="ro-shell-brand">
            <span class="ro-shell-strong">RAGNAROK SURVIVORS</span>
            <span>以本機 RO 原始素材呈現</span>
          </div>
          <ShellButton rasters={props.rasters} width={160} label="開始冒險" testId="start" onPress={props.onStart} />
          <div class="ro-shell-section-title">遊戲設定</div>
          <div class="ro-shell-settings">
            <SettingToggle rasters={props.rasters} label="閃光效果" checked={props.settings.flash} testId="setting-flash" onToggle={() => props.onSettings(withFlash(props.settings, !props.settings.flash))} />
            <SettingToggle rasters={props.rasters} label="畫面震動" checked={props.settings.shake} testId="setting-shake" onToggle={() => props.onSettings(withShake(props.settings, !props.settings.shake))} />
            <SettingToggle rasters={props.rasters} label="傷害數字" checked={props.settings.damageNumbers} testId="setting-damage" onToggle={() => props.onSettings(withDamageNumbers(props.settings, !props.settings.damageNumbers))} />
            <SettingToggle rasters={props.rasters} label="色弱預警" checked={props.settings.colorBlind} testId="setting-color-blind" onToggle={() => props.onSettings(withColorBlind(props.settings, !props.settings.colorBlind))} />
            <div class="ro-shell-setting-row ro-shell-opacity">
              <span>特效透明度</span>
              <div class="ro-shell-stepper">
                <ShellButton rasters={props.rasters} width={42} label="−" compact testId="setting-opacity-down" onPress={() => updateOpacity(-0.1)} />
                <span>{opacity}%</span>
                <ShellButton rasters={props.rasters} width={42} label="＋" compact testId="setting-opacity-up" onPress={() => updateOpacity(0.1)} />
              </div>
            </div>
          </div>
          <span class="ro-shell-small">首領預警固定顯示，確保各平台都能辨識。</span>
        </div>,
      })}
    </div>
  );
}

export function RoCharacterSelectShell(props: { rasters: RasterRegistry; onChoose: () => void; onBack: () => void }) {
  return (
    <div class="ro-shell-screen" data-testid="character-select" data-ro-shell="original-ro-raster">
      {RoWindow({
        rasters: props.rasters,
        width: 360,
        height: 258,
        title: "選擇職業",
        children: <div class="ro-shell-content ro-shell-choice-content">
          <div class="ro-shell-choice-preview">
            <div class="ro-shell-choice-icon">{RoRaster({ raster: props.rasters.get("ui.skill.sm_sword.icon"), scale: 2 })}</div>
            <div>
              <span class="ro-shell-strong">劍士</span>
              <span>近戰 · 防禦 · 範圍清怪</span>
              <span class="ro-shell-small">使用劍、盾與劍士原始技能素材。</span>
            </div>
          </div>
          <ShellButton rasters={props.rasters} width={160} label="選擇劍士" testId="job-swordsman" onPress={props.onChoose} />
          <ShellButton rasters={props.rasters} width={96} label="返回" compact testId="character-back" onPress={props.onBack} />
        </div>,
      })}
    </div>
  );
}

export function RoStageSelectShell(props: { rasters: RasterRegistry; onChoose: () => void; onBack: () => void }) {
  return (
    <div class="ro-shell-screen" data-testid="stage-select" data-ro-shell="original-ro-raster">
      {RoWindow({
        rasters: props.rasters,
        width: 360,
        height: 338,
        title: "選擇關卡",
        children: <div class="ro-shell-content ro-shell-stage-content">
          <div class="ro-shell-stage-preview">
            <div class="ro-shell-map-crop">{RoRaster({ raster: props.rasters.get("ui.minimap.map.prt_fild08") })}</div>
            <div>
              <span class="ro-shell-strong">普隆德拉原野</span>
              <span>prt_fild08</span>
              <span class="ro-shell-small">10 分鐘 · Mastering</span>
            </div>
          </div>
          <ShellButton rasters={props.rasters} width={176} label="進入原野" testId="stage-prt_fild08" onPress={props.onChoose} />
          <ShellButton rasters={props.rasters} width={96} label="返回" compact testId="stage-back" onPress={props.onBack} />
        </div>,
      })}
    </div>
  );
}
