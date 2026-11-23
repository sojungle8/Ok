/**
 * Formal audio: BGM 12, RSW-positioned ambient WAVs, and official hit/skill WAVs, only from the
 * user's client via the local gateway. When the browser blocks autoplay the controller reports
 * `needsGesture` and the UI shows a single "點擊啟用音訊" action; no sound is ever substituted.
 */
import { FORMAL_SKILL_AUDIO, type AssetWhitelist } from "@ro-survivor/asset-contracts";
import type { RunEvent } from "@ro-survivor/core-sim";
import { MissingAssetsError, missingWhitelisted } from "../requirements.ts";
import type { FormalSceneData } from "./load.ts";

/** An original audio asset failed to decode; carries the exact logical asset ID. */
export class AudioDecodeError extends Error {
  readonly assetId: string;
  constructor(assetId: string, cause: unknown) {
    super(`${assetId}: original audio could not be decoded: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
    this.name = "AudioDecodeError";
    this.assetId = assetId;
  }
}

/** Decode every original audio asset; a failure blocks with that asset's ID and canonical path. */
export async function prepareFormalAudio(audio: FormalAudio, whitelist: AssetWhitelist): Promise<void> {
  try {
    await audio.prepare();
  } catch (err) {
    if (err instanceof AudioDecodeError) throw new MissingAssetsError([missingWhitelisted(whitelist, err.assetId, err.message)]);
    throw err;
  }
}

export interface AudioNodeLike {
  connect(dest: unknown): unknown;
}
export interface BufferSourceLike extends AudioNodeLike {
  buffer: unknown;
  loop: boolean;
  onended?: (() => void) | null;
  start(when?: number): void;
  stop(): void;
}
export interface PannerLike extends AudioNodeLike {
  refDistance: number;
  maxDistance: number;
  positionX: { value: number };
  positionY: { value: number };
  positionZ: { value: number };
}
export interface GainLike extends AudioNodeLike {
  gain: { value: number };
}
export interface AudioContextLike {
  state: "suspended" | "running" | "closed";
  destination: unknown;
  listener: { positionX: { value: number }; positionY: { value: number }; positionZ: { value: number } };
  resume(): Promise<void>;
  close(): Promise<void>;
  decodeAudioData(data: ArrayBuffer): Promise<unknown>;
  createBufferSource(): BufferSourceLike;
  createPanner(): PannerLike;
  createGain(): GainLike;
}

const HIT_COOLDOWN_MS = 55;
const SKILL_COOLDOWN_MS = 90;
const MAX_ACTIVE_ONE_SHOTS = 12;
const MAX_ACTIVE_VOICES_PER_CUE = 3;

export class FormalAudio {
  readonly #ctx: AudioContextLike;
  readonly #data: FormalSceneData;
  readonly #now: () => number;
  readonly #decoded = new Map<string, unknown>();
  readonly #lastCueAt = new Map<string, number>();
  readonly sources: { assetId: string; source: BufferSourceLike; panner: PannerLike | null }[] = [];
  #started = false;
  #disposed = false;

  constructor(ctx: AudioContextLike, data: FormalSceneData, now: () => number = () => performance.now()) {
    this.#ctx = ctx;
    this.#data = data;
    this.#now = now;
  }

  /** Decode every original audio asset; a decode failure is an error, never a silent substitute. */
  async prepare(): Promise<void> {
    for (const [id, bytes] of this.#data.audio) {
      try {
        this.#decoded.set(id, await this.#ctx.decodeAudioData(bytes.slice(0)));
      } catch (err) {
        throw new AudioDecodeError(id, err);
      }
    }
  }

  get needsGesture(): boolean {
    return !this.#started && this.#ctx.state !== "running";
  }

  get started(): boolean {
    return this.#started;
  }

  /** Try to start; returns false (and stays silent) while the browser requires a user gesture. */
  tryStart(): boolean {
    if (this.#started) return true;
    if (this.#ctx.state !== "running") return false;
    this.#startAll();
    return true;
  }

  /** Called from the "點擊啟用音訊" action (a user gesture). */
  async enable(): Promise<void> {
    await this.#ctx.resume();
    if (!this.#started) this.#startAll();
  }

  /** Play official one-shot WAVs for this frame's authoritative simulation events. */
  playEvents(events: readonly RunEvent[]): void {
    if (!this.#started || this.#disposed) return;
    const skills = FORMAL_SKILL_AUDIO as Readonly<Record<string, string>>;
    const cues = new Set<string>();
    for (const event of events) {
      const id = event.type === "hit" ? FORMAL_SKILL_AUDIO.hit : event.type === "skill" ? skills[event.source] : undefined;
      if (id) cues.add(id);
    }
    const now = this.#now();
    for (const id of cues) {
      const cooldown = id === FORMAL_SKILL_AUDIO.hit ? HIT_COOLDOWN_MS : SKILL_COOLDOWN_MS;
      const previous = this.#lastCueAt.get(id);
      if (previous !== undefined && now - previous < cooldown) continue;
      const activeOneShots = this.sources.filter((entry) => !entry.source.loop);
      if (activeOneShots.length >= MAX_ACTIVE_ONE_SHOTS) continue;
      if (activeOneShots.filter((entry) => entry.assetId === id).length >= MAX_ACTIVE_VOICES_PER_CUE) continue;
      this.#play(id, null, 1, false);
      this.#lastCueAt.set(id, now);
    }
  }

  #play(assetId: string, panner: PannerLike | null, volume: number, loop: boolean): void {
    const buffer = this.#decoded.get(assetId);
    if (buffer === undefined) throw new Error(`audio ${assetId} not decoded`);
    const src = this.#ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = loop;
    const gain = this.#ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain);
    if (panner) {
      gain.connect(panner);
      panner.connect(this.#ctx.destination);
    } else gain.connect(this.#ctx.destination);
    this.sources.push({ assetId, source: src, panner });
    if (!loop && "onended" in src) src.onended = () => {
      const i = this.sources.findIndex((s) => s.source === src);
      if (i >= 0) this.sources.splice(i, 1);
    };
    src.start();
  }

  #startAll(): void {
    this.#play(this.#data.scene.bgm, null, 1, true);
    for (const s of this.#data.sounds) {
      const p = this.#ctx.createPanner();
      p.refDistance = Math.max(1, s.rangeM / 4);
      p.maxDistance = Math.max(p.refDistance, s.rangeM);
      p.positionX.value = s.world.x;
      p.positionY.value = s.world.height;
      p.positionZ.value = -s.world.y;
      this.#play(s.assetId, p, s.volume, true);
    }
    this.#started = true;
  }

  /** Listener follows the player (world coordinates: x, height, -north). */
  setListener(x: number, height: number, z: number): void {
    const l = this.#ctx.listener;
    l.positionX.value = x;
    l.positionY.value = height;
    l.positionZ.value = z;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const s of this.sources) s.source.stop();
    this.#lastCueAt.clear();
    if (this.#ctx.state !== "closed") void this.#ctx.close();
  }
}
