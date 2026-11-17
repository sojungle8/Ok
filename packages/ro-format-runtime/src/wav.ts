import { BinaryReader, FormatError } from "./binary.ts";

export interface WavInfo {
  audioFormat: number;
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  dataBytes: number;
  durationMs: number;
}

/** RIFF/WAVE header (fmt + data chunks). Samples are not decoded; the browser plays the original bytes. */
export function readWavInfo(bytes: Uint8Array): WavInfo {
  const r = new BinaryReader(bytes, "WAV");
  if (r.ascii(4) !== "RIFF") throw new FormatError("WAV", "missing RIFF header");
  r.skip(4);
  if (r.ascii(4) !== "WAVE") throw new FormatError("WAV", "missing WAVE form type");
  let fmt: Omit<WavInfo, "dataBytes" | "durationMs"> | null = null;
  while (r.remaining >= 8) {
    const id = r.ascii(4);
    const size = r.u32();
    if (size > r.remaining) throw new FormatError("WAV", `chunk ${JSON.stringify(id)} truncated (${size} > ${r.remaining})`);
    if (id === "fmt ") {
      if (size < 16) throw new FormatError("WAV", "short fmt chunk");
      const start = r.offset;
      const audioFormat = r.u16();
      const channels = r.u16();
      const sampleRate = r.u32();
      r.skip(6);
      const bitsPerSample = r.u16();
      r.offset = start + size + (size & 1);
      if (channels === 0 || sampleRate === 0 || bitsPerSample === 0) throw new FormatError("WAV", "invalid fmt values");
      fmt = { audioFormat, channels, sampleRate, bitsPerSample };
    } else if (id === "data") {
      if (!fmt) throw new FormatError("WAV", "data chunk before fmt chunk");
      const bytesPerSecond = fmt.sampleRate * fmt.channels * (fmt.bitsPerSample / 8);
      return { ...fmt, dataBytes: size, durationMs: Math.round((size / bytesPerSecond) * 1000) };
    } else {
      r.skip(Math.min(size + (size & 1), r.remaining));
    }
  }
  throw new FormatError("WAV", "no data chunk");
}
