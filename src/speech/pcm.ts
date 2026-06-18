/** G2 mic format per Even Hub SDK: 16 kHz, 16-bit signed LE mono. */
export const G2_PCM_SAMPLE_RATE = 16_000;

/** Bytes per 100 ms frame at 16 kHz mono 16-bit. */
export const G2_PCM_FRAME_BYTES = 3200;

/** Root-mean-square level for 16-bit little-endian mono PCM (0–1). */
export function pcmRms16le(chunk: Uint8Array): number {
  if (chunk.byteLength < 2) {
    return 0;
  }

  const view = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  let sum = 0;
  const samples = Math.floor(chunk.byteLength / 2);

  for (let i = 0; i < samples; i++) {
    const sample = view.getInt16(i * 2, true) / 32768;
    sum += sample * sample;
  }

  return Math.sqrt(sum / samples);
}

/** Peak amplitude for 16-bit little-endian mono PCM (0–1). */
export function pcmPeak16le(chunk: Uint8Array): number {
  if (chunk.byteLength < 2) {
    return 0;
  }

  const view = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  let peak = 0;
  const samples = Math.floor(chunk.byteLength / 2);

  for (let i = 0; i < samples; i++) {
    peak = Math.max(peak, Math.abs(view.getInt16(i * 2, true)) / 32768);
  }

  return peak;
}

/** Heuristic: does this PCM chunk likely contain speech? */
export function isSpeechChunk(chunk: Uint8Array): boolean {
  return pcmPeak16le(chunk) >= 0.05 || pcmRms16le(chunk) >= 0.02;
}

/** Simple on-lens mic level meter (8 bars). */
export function micLevelMeter(peak: number, bars = 8): string {
  const filled = Math.min(bars, Math.max(0, Math.round(peak * bars * 2.5)));
  return `${"█".repeat(filled)}${"░".repeat(bars - filled)}`;
}

export function concatPcm(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((size, chunk) => size + chunk.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return merged;
}

export function pcmToWav(
  pcm: Uint8Array,
  sampleRate = G2_PCM_SAMPLE_RATE
): Blob {
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcm.byteLength;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  new Uint8Array(buffer, 44).set(pcm);

  return new Blob([buffer], { type: "audio/wav" });
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}
