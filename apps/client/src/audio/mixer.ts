/**
 * Audio routing rules (04 §2.8), independent of any sound file: buses with their own volume, voice
 * limits and per-sound cooldowns, and boss warnings that are never culled. Actual playback needs RO
 * audio from the user's client (only BGM/12.mp3 is whitelisted so far), so the WebAudio sink is optional.
 */
export const BUSES = ["bgm-town", "bgm-stage", "bgm-boss", "ui", "player", "enemy", "boss", "ambient"] as const;
export type Bus = (typeof BUSES)[number];

export interface SoundRequest {
  id: string;
  bus: Bus;
  /** Boss warnings and player-hurt cues are "critical": never dropped by voice limits. */
  critical?: boolean;
}

export interface MixerConfig {
  voiceLimit: Record<Bus, number>;
  /** Minimum ms between two plays of the same sound id. */
  cooldownMs: number;
}

export const DEFAULT_MIXER: MixerConfig = {
  voiceLimit: { "bgm-town": 1, "bgm-stage": 1, "bgm-boss": 1, ui: 4, player: 6, enemy: 8, boss: 4, ambient: 2 },
  cooldownMs: 60,
};

export interface Voice { id: string; bus: Bus; critical: boolean; startedAt: number; endsAt: number }

export class Mixer {
  readonly cfg: MixerConfig;
  readonly volume: Record<Bus, number> = Object.fromEntries(BUSES.map((b) => [b, 1])) as Record<Bus, number>;
  master = 1;
  #voices: Voice[] = [];
  #lastPlayed = new Map<string, number>();

  constructor(cfg: MixerConfig = DEFAULT_MIXER) {
    this.cfg = cfg;
  }

  setVolume(bus: Bus, v: number): void {
    this.volume[bus] = Math.max(0, Math.min(1, v));
  }

  /** Effective gain of a bus (master × bus). */
  gain(bus: Bus): number {
    return this.master * this.volume[bus];
  }

  /** Decide whether a sound plays now; returns the voice, or null if culled. Evicts the oldest non-critical voice on the bus when full. */
  request(req: SoundRequest, nowMs: number, durationMs: number): Voice | null {
    this.#voices = this.#voices.filter((v) => v.endsAt > nowMs);
    const last = this.#lastPlayed.get(req.id);
    if (!req.critical && last !== undefined && nowMs - last < this.cfg.cooldownMs) return null;
    const onBus = this.#voices.filter((v) => v.bus === req.bus);
    if (onBus.length >= this.cfg.voiceLimit[req.bus]) {
      const victim = onBus.filter((v) => !v.critical).sort((a, b) => a.startedAt - b.startedAt)[0];
      if (!victim) {
        if (!req.critical) return null;
      } else if (!req.critical && req.bus !== "bgm-town" && req.bus !== "bgm-stage" && req.bus !== "bgm-boss") {
        return null; // full: drop the new low-priority sound rather than cutting one that is playing
      } else this.#voices = this.#voices.filter((v) => v !== victim);
    }
    const voice: Voice = { id: req.id, bus: req.bus, critical: req.critical === true, startedAt: nowMs, endsAt: nowMs + durationMs };
    this.#voices.push(voice);
    this.#lastPlayed.set(req.id, nowMs);
    return voice;
  }

  active(): readonly Voice[] {
    return this.#voices;
  }
}
