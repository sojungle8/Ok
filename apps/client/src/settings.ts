/** Readability / accessibility settings (04 §2.8.5). Telegraphs are never hidden by any setting. */
export interface Settings {
  flash: boolean;
  shake: boolean;
  damageNumbers: boolean;
  /** 0.2–1: opacity of non-critical effects; telegraphs keep full opacity. */
  effectOpacity: number;
  /** Colour-blind safe telegraph palette (orange/blue instead of red/green). */
  colorBlind: boolean;
  volumes: Record<string, number>;
}

export const DEFAULT_SETTINGS: Settings = { flash: true, shake: true, damageNumbers: true, effectOpacity: 1, colorBlind: false, volumes: {} };

export function telegraphColors(s: Settings): { danger: number; warn: number; safe: number } {
  return s.colorBlind ? { danger: 0xff8c00, warn: 0xffd166, safe: 0x3a86ff } : { danger: 0xe53935, warn: 0xffb300, safe: 0x43a047 };
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem("ro-survivor.settings");
    if (!raw) return DEFAULT_SETTINGS;
    const s = { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
    s.effectOpacity = Math.max(0.2, Math.min(1, s.effectOpacity));
    return s;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem("ro-survivor.settings", JSON.stringify(s));
  } catch {
    /* per-viewer convenience only */
  }
}
