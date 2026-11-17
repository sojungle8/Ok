/**
 * Formal audio: BGM 12 and the RSW-positioned ambient WAVs, only from the user's client via the local
 * gateway. When the browser blocks autoplay the controller reports `needsGesture` and the UI shows a
 * single "點擊啟用音訊" action; no other sound is ever substituted.
 */
import type { AssetWhitelist } from "@ro-survivor/asset-contracts";
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

export class FormalAudio {
  readonly #ctx: AudioContextLike;
  readonly #data: FormalSceneData;
  readonly #decoded = new Map<string, unknown>();
  readonly sources: { assetId: string; source: BufferSourceLike; panner: PannerLike | null }[] = [];
  #started = false;

  constructor(ctx: AudioContextLike, data: FormalSceneData) {
    this.#ctx = ctx;
    this.#data = data;
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

  #startAll(): void {
    const play = (assetId: string, panner: PannerLike | null, volume: number): void => {
      const buffer = this.#decoded.get(assetId);
      if (buffer === undefined) throw new Error(`audio ${assetId} not decoded`);
      const src = this.#ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const gain = this.#ctx.createGain();
      gain.gain.value = volume;
      src.connect(gain);
      if (panner) {
        gain.connect(panner);
        panner.connect(this.#ctx.destination);
      } else gain.connect(this.#ctx.destination);
      src.start();
      this.sources.push({ assetId, source: src, panner });
    };
    play(this.#data.scene.bgm, null, 1);
    for (const s of this.#data.sounds) {
      const p = this.#ctx.createPanner();
      p.refDistance = Math.max(1, s.rangeM / 4);
      p.maxDistance = Math.max(p.refDistance, s.rangeM);
      p.positionX.value = s.world.x;
      p.positionY.value = s.world.height;
      p.positionZ.value = -s.world.y;
      play(s.assetId, p, s.volume);
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
    for (const s of this.sources) s.source.stop();
    void this.#ctx.close();
  }
}
